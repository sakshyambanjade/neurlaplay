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
      // Get all legal moves for this position
      const legalMoveObjects = chess.moves({ verbose: true });
      const legalMovesInSan = legalMoveObjects.map(m => m.san);
      
      const systemPrompt = `You are a chess AI. Given a current board position in FEN notation and a list of LEGAL moves, choose the best move.

Rules:
- You MUST choose from the provided legal moves list
- Respond with EXACTLY ONE move from the list, nothing else
- Use the exact format supplied in the legal moves list
- No explanations, variations, or alternatives
- Pick the most strategically sound move`;

      const legalMovesStr = legalMovesInSan.join(', ');
      const moveHistory = chess.moves({ verbose: true }).slice(-4).map(m => m.san).join(' ');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `Current position (FEN): ${fen}

Legal moves available (pick ONE): ${legalMovesStr}

Recent moves: ${moveHistory || 'none yet'}

Your move (must be from the legal moves list):` 
            }
          ],
          max_tokens: 5,
          temperature: 0.5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BotMatch] API error ${response.status}:`, errorText);
        return null;
      }

      const data = await response.json();
      let move = data.choices?.[0]?.message?.content?.trim() || '';
      
      // Clean up the move - take first word
      move = move.split('\n')[0].trim();
      move = move.split(/[\s,;.]/)[0].trim();
      
      // Check if this move is in the legal moves list
      if (!legalMovesInSan.includes(move)) {
        // If not, try to find the move by matching pattern
        const possibleMove = legalMovesInSan.find(m => m.toLowerCase().includes(move.toLowerCase()));
        if (possibleMove) {
          console.log(`[BotMatch] LLM ambiguous move "${move}" -> corrected to "${possibleMove}"`);
          move = possibleMove;
        } else {
          console.warn(`[BotMatch] LLM returned illegal move "${move}" for position. Legal: ${legalMovesStr}`);
          // Return null to indicate invalid move
          return null;
        }
      }
      
      console.log(`[BotMatch] LLM chose move: "${move}" for ${color}`);
      
      return move;
    } catch (err) {
      console.error(`[BotMatch] Error getting move from ${color}:`, err);
      return null;
    }
  }

  // Play the match
  let moveCount = 0;
  let lastError: string | null = null;
  
  while (!chess.isGameOver() && moveCount < 150 && !lastError) {
    const isWhiteTurn = chess.turn() === 'w';
    const botName = isWhiteTurn ? whiteBotName : blackBotName;
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
      lastError = `No valid move from ${botName}`;
      console.error(`[BotMatch] ${lastError}`);
      break;
    }

    const legalMovesForDebug = room.legalMovesUCI.slice(0, 5);
    console.log(`[BotMatch] Trying move "${move}" for ${botName} | Legal moves: ${legalMovesForDebug.join(', ')}...`);

    try {
      const moveObj = chess.move(move, { sloppy: true });
      if (!moveObj) {
        lastError = `Invalid move from ${botName}: "${move}". Legal moves are: ${room.legalMovesUCI.slice(0, 5).join(', ')}...`;
        console.error(`[BotMatch] ${lastError}`);
        break;
      }

      moveCount++;
      const halfMoveNumber = moveCount;

      // Create move record
      const moveRecord = {
        moveNumber: halfMoveNumber,
        playerColor: isWhiteTurn ? 'white' : 'black',
        uci: `${moveObj.from}${moveObj.to}`,
        san: moveObj.san,
        reasoning: `${botName}'s move`,
        timestamp: new Date().toISOString()
      };

      room.moves.push(moveRecord);

      const currentFen = chess.fen();
      const currentPgn = chess.pgn();

      // Broadcast move to spectators with FEN update
      io.to(room.matchId).emit('moveMade', {
        moveNumber: halfMoveNumber,
        playerColor: isWhiteTurn ? 'white' : 'black',
        uci: `${moveObj.from}${moveObj.to}`,
        san: moveObj.san,
        reasoning: `${botName}'s move`,
        fen: currentFen,  // Include updated FEN
        pgn: currentPgn,  // Include updated PGN
        isCheck: chess.isCheck(),
        legalMoves: room.legalMovesUCI
      });

      console.log(`[BotMatch] Move ${moveCount}: ${moveObj.san} | FEN is now valid: ${currentFen.substring(0, 30)}...`);
    } catch (err: any) {
      lastError = `Error making move: ${err.message}`;
      console.error(`[BotMatch] ${lastError}`, err);
      break;
    }
  }

  // Determine result based on final state
  const result = room.result;  // Use the getter, don't set it
  const termination = room.termination;  // Use the getter, don't set it

  // End the match
  room.status = 'completed';
  room.endedAt = new Date();

  // Notify spectators game is over
  io.to(room.matchId).emit('gameOver', {
    result,
    termination,
    winner: result === '1-0' ? 'white' : result === '0-1' ? 'black' : null,
    pgn: chess.pgn(),
    totalMoves: moveCount,
    error: lastError
  });

  console.log(`[BotMatch] Match ${room.matchId} ended: ${result} (${termination})${lastError ? ` - Error: ${lastError}` : ''}`);
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
