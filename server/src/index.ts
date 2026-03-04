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

// Bot match endpoint - needs io instance
app.post('/api/bot-match', async (req, res) => {
  const {
    matchId,
    whiteBotName,
    whiteModel,
    whiteEndpointUrl,
    whiteApiKey,
    blackBotName,
    blackModel,
    blackEndpointUrl,
    blackApiKey,
    moveDelayMs = 3000
  } = req.body;

  if (!matchId || !whiteApiKey || !blackApiKey) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Get or create the match room
    let room = registry.get(matchId);
    if (!room) {
      res.status(400).json({ message: 'Match not found' });
      return;
    }

    // Start the room if not already started
    if (room.status === 'waiting') {
      room.start();
    }

    // Start bot match in background with io instance
    startBotMatch(io, room, {
      whiteBotName,
      whiteModel,
      whiteEndpointUrl,
      whiteApiKey,
      blackBotName,
      blackModel,
      blackEndpointUrl,
      blackApiKey,
      moveDelayMs
    }).catch(err => console.error('[API] Bot match error:', err));

    res.json({ message: 'Bot match started', matchId });
  } catch (err: any) {
    console.error('[API] Error starting bot match:', err);
    res.status(500).json({ message: err.message || 'Failed to start bot match' });
  }
});

/**
 * Helper to start a bot match
 */
async function startBotMatch(io: any, room: any, config: any) {
  const { whiteBotName, whiteModel, whiteEndpointUrl, whiteApiKey, blackBotName, blackModel, blackEndpointUrl, blackApiKey, moveDelayMs } = config;

  const { Chess } = await import('chess.js');
  const chess = room.chess;

  console.log(`[BotMatch] Starting match ${room.matchId} with ${whiteBotName} vs ${blackBotName}`);

  // Update room config
  room.white = { botName: whiteBotName, model: whiteModel, socketId: 'bot-white' };
  room.black = { botName: blackBotName, model: blackModel, socketId: 'bot-black' };

  // Notify spectators game is starting
  io.to(room.matchId).emit('gameState', {
    matchId: room.matchId,
    status: 'in_progress',
    fen: chess.fen(),
    pgn: chess.pgn(),
    currentTurn: 'white',
    whiteBotName,
    blackBotName,
    whiteModel,
    blackModel,
    moveCount: 0,
    moves: []
  });

  // Helper to get next move from LLM
  async function getMove(color: string, fen: string, model: string, endpoint: string, apiKey: string) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a chess AI. Given FEN, respond with just the move in UCI or SAN notation.' },
            { role: 'user', content: `FEN: ${fen}` }
          ],
          max_tokens: 10,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      let move = data.choices?.[0]?.message?.content?.trim() || '';
      move = move.replace(/[^a-zA-Z0-9\-]/g, '');
      return move;
    } catch (err) {
      console.error(`[BotMatch] Error getting move from ${color}:`, err);
      return null;
    }
  }

  // Play the match
  let moveCount = 0;
  while (!chess.isGameOver() && moveCount < 150) {
    const isWhiteTurn = chess.turn() === 'w';
    const model = isWhiteTurn ? whiteModel : blackModel;
    const endpoint = isWhiteTurn ? whiteEndpointUrl : blackEndpointUrl;
    const apiKey = isWhiteTurn ? whiteApiKey : blackApiKey;

    // Delay for dramatic effect
    await new Promise(resolve => setTimeout(resolve, moveDelayMs));

    // Get move from LLM
    const move = await getMove(
      isWhiteTurn ? 'white' : 'black',
      chess.fen(),
      model,
      endpoint,
      apiKey
    );

    if (!move) {
      console.error(`[BotMatch] No valid move from ${isWhiteTurn ? whiteBotName : blackBotName}`);
      break;
    }

    try {
      const moveObj = chess.move(move, { sloppy: true });
      if (!moveObj) {
        console.error(`[BotMatch] Invalid move: ${move}`);
        break;
      }

      moveCount++;

      // Create move record
      const moveRecord = {
        moveNumber: moveCount,
        playerColor: isWhiteTurn ? 'white' : 'black',
        uci: `${moveObj.from}${moveObj.to}`,
        san: moveObj.san,
        reasoning: `${isWhiteTurn ? whiteBotName : blackBotName}'s move`,
        timestamp: new Date().toISOString()
      };

      room.moves.push(moveRecord);

      // Broadcast move to spectators
      io.to(room.matchId).emit('moveMade', {
        ...moveRecord,
        fen: chess.fen(),
        isCheck: chess.isCheck(),
        pgn: chess.pgn()
      });

      console.log(`[BotMatch] Move ${moveCount}: ${moveObj.san}`);
    } catch (err) {
      console.error(`[BotMatch] Error making move:`, err);
      break;
    }
  }

  // Determine result
  let result = '1/2-1/2';
  let termination = 'draw';
  
  if (chess.isCheckmate()) {
    result = chess.turn() === 'w' ? '0-1' : '1-0';
    termination = 'checkmate';
  } else if (chess.isStalemate()) {
    termination = 'stalemate';
  }

  // End the match
  room.status = 'completed';
  room.endedAt = new Date();
  room.result = result;
  room.termination = termination;

  // Notify spectators game is over
  io.to(room.matchId).emit('gameOver', {
    result,
    termination,
    winner: result === '1-0' ? 'white' : result === '0-1' ? 'black' : null,
    pgn: chess.pgn(),
    totalMoves: moveCount
  });

  console.log(`[BotMatch] Match ${room.matchId} ended: ${result}`);
}

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
