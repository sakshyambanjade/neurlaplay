import express from 'express';
import http from 'node:http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { createResearchRouter } from './routes/research.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/research', createResearchRouter(ollamaBaseUrl, io));

io.on('connection', (socket) => {
  socket.join('research');
});

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
