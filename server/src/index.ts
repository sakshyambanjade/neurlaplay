import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import { config } from './config';
import { setupResearchRoutes } from './routes/research';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests from localhost on any port
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
    version: '2.0.0-research'
  });
});

// Research batch routes
setupResearchRoutes(app, io);

// Socket.io - Batch events only
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 Research Chess Batch Server        ║
║  Port: ${PORT}                              ║
║  Status: Ready                         ║
╚════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, io };
