import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import { initSocket } from './socket';
import { registry } from './game/MatchRegistry';
import { config } from './config';
import botsRouter from './routes/bots';
import matchesRouter from './routes/matches';
import leaderboardRouter from './routes/leaderboard';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    activeMatches: registry.size(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/bots', botsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Legacy route - get match status (kept for backwards compatibility)
app.get('/api/matches/:matchId', (req, res) => {
  const room = registry.get(req.params.matchId);

  if (!room) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const state = room.getState();
  const summary = room.getSummary();

  res.json({
    matchId: room.matchId,
    status: room.status,
    gameState: state,
    summary
  });
});

// Initialize Socket.io
initSocket(io);

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║      LLMArena Server (Production)      ║
╚════════════════════════════════════════╝

🚀 Server running on port ${PORT}
📍 Health: http://localhost:${PORT}/health
🎮 API: http://localhost:${PORT}/api

Socket.IO enabled for real-time gameplay

Ready to play! ♟️
  `);
});

export { app, server, io, registry };
