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
import { NeuroAgent } from './agents/NeuroAgent';
import botsRouter from './routes/bots';
import matchesRouter from './routes/matches';
import leaderboardRouter from './routes/leaderboard';
import challengesRouter from './routes/challenges';
import { setupGameDataRoutes } from './routes/gameDataRoutes';
import { setupBatchRoutes } from './routes/batchRoutes';
import { GameLogger } from './game/GameLogger';

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

// Initialize game logger
const gameLogger = new GameLogger('./game-data');

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
setupGameDataRoutes(app);
setupBatchRoutes(app, io);

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
 * Neuro Bot Match - LLM + SNN Hybrid Arena
 * Uses NeuroAgent for brain-like move selection
 */
app.post('/api/neuro-bot-match', async (req, res) => {
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

    // Start neuro bot match in background
    startNeuroBotMatch(io, room, {
      whiteBotName,
      whiteModel,
      whiteEndpointUrl,
      whiteApiKey,
      blackBotName,
      blackModel,
      blackEndpointUrl,
      blackApiKey,
      moveDelayMs
    }, gameLogger).catch(err => console.error('[NeuroAPI] Bot match error:', err));

    res.json({ message: 'Neuro bot match started (LLM+SNN)', matchId });
  } catch (err: any) {
    console.error('[NeuroAPI] Error starting neuro bot match:', err);
    res.status(500).json({ message: err.message || 'Failed to start neuro bot match' });
  }
});

/**
 * Neuro Bot Match - NeuroAgent-powered decision making
 */
async function startNeuroBotMatch(io: any, room: any, config: any, gameLogger: GameLogger) {
  const { whiteBotName, whiteModel, whiteEndpointUrl, whiteApiKey, blackBotName, blackModel, blackEndpointUrl, blackApiKey, moveDelayMs } = config;

  const { Chess } = await import('chess.js');
  const chess = room.chess;

  console.log(`[NeuroBotMatch] Starting SNN-enhanced match ${room.matchId}`);
  console.log(`[NeuroBotMatch] ${whiteBotName} (${whiteModel}) vs ${blackBotName} (${blackModel})`);

  // Initialize NeuroAgents for each player
  const whiteAgent = new NeuroAgent(whiteModel);
  const blackAgent = new NeuroAgent(blackModel);

  // Update room config
  room.white = { botName: whiteBotName, model: whiteModel, socketId: 'neuro-white' };
  room.black = { botName: blackBotName, model: blackModel, socketId: 'neuro-black' };

  // Notify spectators game is starting with SNN
  io.to(room.matchId).emit('gameState', {
    matchId: room.matchId,
    status: 'in_progress',
    fen: chess.fen(),
    pgn: chess.pgn(),
    currentTurn: 'white',
    whiteBotName,
    blackBotName,
    isNeuroMatch: true
  });

  let moveCount = 0;
  let lastError: string | null = null;

  while (!chess.isGameOver() && moveCount < 150 && !lastError) {
    const isWhiteTurn = chess.turn() === 'w';
    const agent = isWhiteTurn ? whiteAgent : blackAgent;
    const botName = isWhiteTurn ? whiteBotName : blackBotName;
    const color = isWhiteTurn ? 'white' : 'black';

    // Delay for dramatic effect
    await new Promise(resolve => setTimeout(resolve, moveDelayMs));

    try {
      // Get NeuroAgent decision (LLM + SNN)
      const legalMoves = room.legalMovesUCI;
      const fenBefore = chess.fen();

      const neuroDecision = await agent.decideMove(
        fenBefore,
        legalMoves,
        `${botName} making move`
      );

      const moveUCI = neuroDecision.move;

      // Validate move
      const from = moveUCI.slice(0, 2);
      const to = moveUCI.slice(2, 4);
      const promotion = moveUCI.length === 5 ? moveUCI[4] : undefined;

      const moveObj = chess.move({ from, to, promotion: promotion as any });

      if (!moveObj) {
        lastError = `Invalid move from ${botName}: ${moveUCI}`;
        console.error(`[NeuroBotMatch] ${lastError}`);
        break;
      }

      moveCount++;

      // Record move with SNN metrics in reasoning
      const reasoningWithNeuro = `${neuroDecision.reasoning} (Spike Vote: [${neuroDecision.spikeVotes.map(v => v.toFixed(2)).join(', ')}])`;

      await room.recordMove(
        moveCount,
        color as 'white' | 'black',
        moveUCI,
        moveObj.san,
        fenBefore,
        chess.fen(),
        reasoningWithNeuro,
        neuroDecision.latencyMs
      );

      const moveRecord = room.moves[room.moves.length - 1];

      // Log move to game data storage
      gameLogger.logMove(room.matchId, {
        moveNumber: moveCount,
        color: color as 'white' | 'black',
        move: moveUCI,
        fen: chess.fen(),
        confidence: neuroDecision.finalConfidence,
        spikeEfficiency: neuroDecision.spikeEfficiency,
        latencyMs: neuroDecision.latencyMs,
        reasoning: reasoningWithNeuro,
        timestamp: new Date().toISOString()
      });

      // Broadcast move with SNN metrics
      io.to(room.matchId).emit('moveMade', {
        ...moveRecord,
        fen: chess.fen(),
        isCheck: chess.isCheck(),
        legalMoves: room.legalMovesUCI,
        pgn: chess.pgn(),
        // SNN metrics for display
        spikeVotes: neuroDecision.spikeVotes,
        spikeEfficiency: neuroDecision.spikeEfficiency,
        neuroLatencyMs: neuroDecision.latencyMs
      });

      console.log(
        `[NeuroBotMatch] Move ${moveCount}: ${moveObj.san} | ` +
        `${botName} | ${neuroDecision.reasoning}`
      );
    } catch (err: any) {
      lastError = `Error in neuro move decision: ${err.message}`;
      console.error(`[NeuroBotMatch] ${lastError}`, err);
      break;
    }

    // Check for game-ending conditions
    if (room.isOver) {
      break;
    }
  }

  // Cleanup NeuroAgents
  whiteAgent.dispose();
  blackAgent.dispose();

  // Determine result
  const result = room.result;
  const termination = room.termination;
  const resultType: 'white' | 'black' | 'draw' = result === '1-0' ? 'white' : result === '0-1' ? 'black' : 'draw';

  // End the match
  room.status = 'completed';
  room.endedAt = new Date();

  // Export research metrics
  const whiteMetrics = whiteAgent.getResearchMetrics();
  const blackMetrics = blackAgent.getResearchMetrics();

  // Save game to persistent storage
  const startTime = new Date(room.startedAt);
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();

  gameLogger.saveGameResult({
    matchId: room.matchId,
    timestamp: startTime.toISOString(),
    whiteBotName: whiteBotName,
    whiteModel: whiteModel,
    blackBotName: blackBotName,
    blackModel: blackModel,
    result: resultType,
    pgn: chess.pgn(),
    fen: chess.fen(),
    moves: gameLogger.getMoveHistory(room.matchId),
    totalMoves: moveCount,
    gameStatus: termination,
    duration_ms: durationMs
  });

  // Notify spectators game is over
  io.to(room.matchId).emit('gameOver', {
    result,
    termination,
    winner: result === '1-0' ? 'white' : result === '0-1' ? 'black' : null,
    pgn: chess.pgn(),
    totalMoves: moveCount,
    error: lastError,
    neuroMetrics: {
      white: whiteMetrics,
      black: blackMetrics
    }
  });

  console.log(`[NeuroBotMatch] Match ${room.matchId} ended: ${result} (${termination})`);
  console.log(`[NeuroBotMatch] White SNN metrics:`, whiteMetrics);
  console.log(`[NeuroBotMatch] Black SNN metrics:`, blackMetrics);
}

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
      const fenBefore = chess.history({ verbose: true })[chess.history({ verbose: true }).length - 1]?.before || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const currentFen = chess.fen();
      const currentPgn = chess.pgn();

      // Record move with Stockfish analysis
      await room.recordMove(
        halfMoveNumber,
        isWhiteTurn ? 'white' : 'black',
        `${moveObj.from}${moveObj.to}`,
        moveObj.san,
        fenBefore,
        currentFen,
        `${botName}'s move`,
        0
      );

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

// Research data export endpoint - JSON format
app.get('/api/research/export/:matchId/json', (req, res) => {
  const room = registry.get(req.params.matchId);

  if (!room) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const jsonData = room.exportResearchJSON();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="research-${room.matchId}.json"`);
  res.send(jsonData);
});

// Research data export endpoint - CSV format
app.get('/api/research/export/:matchId/csv', (req, res) => {
  const room = registry.get(req.params.matchId);

  if (!room) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const csvData = room.exportResearchCSV();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="research-${room.matchId}.csv"`);
  res.send(csvData);
});

// Research data summary endpoint
app.get('/api/research/summary/:matchId', (req, res) => {
  const room = registry.get(req.params.matchId);

  if (!room) {
    return res.status(404).json({ error: 'Match not found' });
  }

  res.json({
    matchId: room.matchId,
    totalMoves: room.moves.length,
    averageCPL: room.getAverageCentipawnLoss(),
    totalCPL: room.getTotalCentipawnLoss(),
    whiteBotName: room.white?.botName,
    whiteModel: room.white?.model,
    blackBotName: room.black?.botName,
    blackModel: room.black?.model,
    result: room.result,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    researchDataPoints: room.researchLog.length
  });
});

// NeuroAgent spike raster data endpoint (for visualization)
app.get('/api/research/spikes/:matchId', (req, res) => {
  const room = registry.get(req.params.matchId);

  if (!room) {
    return res.status(404).json({ error: 'Match not found' });
  }

  // Return spike raster plot data
  res.json({
    matchId: room.matchId,
    totalMoves: room.moves.length,
    averageCPL: room.getAverageCentipawnLoss(),
    dataType: 'spike_raster',
    note: 'Spike pattern data from SNN motor cortex simulation'
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
