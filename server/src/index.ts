import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import { initSocket } from './socket';
import { setMatchmaker } from './socket/matchHandlers';
import { registry } from './game/MatchRegistry';
import { config } from './config';
import { Matchmaker } from './matchmaking/Matchmaker';
import botsRouter from './routes/bots';
import matchesRouter from './routes/matches';
import leaderboardRouter from './routes/leaderboard';
import challengesRouter from './routes/challenges';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests from localhost on any port (5173, 5174, etc.)
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const PORT = config.PORT;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow localhost on any port
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));
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
app.use('/api/challenges', challengesRouter);

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

// Create and start matchmaker
const matchmaker = new Matchmaker(io);
setMatchmaker(matchmaker);
matchmaker.start();

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
🎯 Matchmaker: Pairing bots every 60s

Ready to play! ♟️
  `);
});

export { app, server, io, registry };
