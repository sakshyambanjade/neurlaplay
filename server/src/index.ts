import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { createResearchRouter } from './routes/research.js';
import { createPaperRouter } from './routes/paper.js';
import { getPaperDataRoot } from './research/PaperPaths.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const httpServer = http.createServer(app);
const paperArtifactsDir = getPaperDataRoot();
const clientDistDir =
  [path.resolve(process.cwd(), 'public'), path.resolve(process.cwd(), '../client/dist')].find((candidate) =>
    fs.existsSync(candidate)
  ) ?? null;
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/artifacts', express.static(paperArtifactsDir));
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/research', createResearchRouter(ollamaBaseUrl, io));
app.use('/api/paper', createPaperRouter(ollamaBaseUrl, io));

if (clientDistDir) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (
      req.path === '/health' ||
      req.path.startsWith('/api/') ||
      req.path.startsWith('/artifacts/')
    ) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.join('research');

  socket.on('join:paper', (runId: string) => {
    if (typeof runId === 'string' && runId.trim().length > 0) {
      socket.join(runId);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
