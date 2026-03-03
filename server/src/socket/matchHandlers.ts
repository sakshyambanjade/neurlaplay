import { Server, Socket } from 'socket.io';
import { registry } from '../game/MatchRegistry';
import {
  CreateMatchPayload,
  JoinMatchPayload,
  SetConfigPayload,
  SetReadyPayload,
  PlayerColor,
  PlayerConfig,
  GameStatus
} from '../types';
import { config } from '../config';

/**
 * Match setup handlers - create, join, configure, ready
 */
export function registerMatchHandlers(io: Server, socket: Socket) {
  /**
   * Create a new match
   */
  socket.on('createMatch', (data: CreateMatchPayload) => {
    // Generate 6-character match ID
    const matchId = Math.random().toString(36).slice(2, 8).toUpperCase();

    const room = registry.create(matchId, data.timeoutSeconds || config.DEFAULT_MOVE_TIMEOUT_SECONDS);

    socket.join(`match:${matchId}`);

    socket.emit('matchCreated', {
      matchId,
      color: 'white'
    });

    console.log(`[Match] Created: ${matchId}`);
  });

  /**
   * Join an existing match
   */
  socket.on('joinMatch', (data: JoinMatchPayload) => {
    const room = registry.get(data.matchId);

    if (!room) {
      socket.emit('error', { code: 'MATCH_NOT_FOUND', message: 'Match not found' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { code: 'MATCH_NOT_WAITING', message: 'Match is not accepting new players' });
      return;
    }

    // Determine which color this player gets
    let color: PlayerColor;

    if (!room.white) {
      room.white = { socketId: socket.id, botName: '', model: '', endpointType: 'openai', endpointUrl: '', apiKey: '' };
      color = 'white';
    } else if (!room.black) {
      room.black = { socketId: socket.id, botName: '', model: '', endpointType: 'openai', endpointUrl: '', apiKey: '' };
      color = 'black';
    } else {
      socket.emit('error', { code: 'MATCH_FULL', message: 'This match already has 2 players' });
      return;
    }

    socket.join(`match:${data.matchId}`);

    socket.emit('matchCreated', {
      matchId: data.matchId,
      color
    });

    console.log(`[Match ${data.matchId}] Player joined: ${color}`);
  });

  /**
   * Set player config (bot name, model, API endpoint, etc)
   */
  socket.on('setConfig', (data: SetConfigPayload) => {
    const room = registry.get(data.matchId);

    if (!room) {
      socket.emit('error', { code: 'MATCH_NOT_FOUND' });
      return;
    }

    // Find which player this is
    let config: PlayerConfig | null = null;

    if (room.white?.socketId === socket.id) {
      config = room.white;
    } else if (room.black?.socketId === socket.id) {
      config = room.black;
    }

    if (!config) {
      socket.emit('error', { code: 'NOT_IN_GAME' });
      return;
    }

    // Update config
    config.botName = data.botName;
    config.model = data.model;
    config.endpointType = data.endpointType;
    config.endpointUrl = data.endpointUrl;
    // Don't store API key on server
    config.apiKey = ''; // Client keeps the key in memory

    // Notify opponent
    const opponent = room.white?.socketId === socket.id ? room.black : room.white;
    if (opponent) {
      io.to(`match:${data.matchId}`).emit('opponentConfigured', {
        botName: config.botName,
        model: config.model,
        endpointType: config.endpointType
      });
    }

    console.log(`[Match ${data.matchId}] Config set for ${room.white?.socketId === socket.id ? 'white' : 'black'}`);
  });

  /**
   * Player is ready to start
   */
  socket.on('setReady', (data: SetReadyPayload) => {
    const room = registry.get(data.matchId);

    if (!room) {
      socket.emit('error', { code: 'MATCH_NOT_FOUND' });
      return;
    }

    // Mark this player as ready
    if (room.white?.socketId === socket.id) {
      room.white.isReady = true;
    } else if (room.black?.socketId === socket.id) {
      room.black.isReady = true;
    } else {
      socket.emit('error', { code: 'NOT_IN_GAME' });
      return;
    }

    // Notify both players
    io.to(`match:${data.matchId}`).emit('playerReady', {
      color: room.white?.socketId === socket.id ? 'white' : 'black'
    });

    // If both are ready, start the game
    if (room.bothReady()) {
      startGame(io, room);
    }

    console.log(`[Match ${data.matchId}] Player ready: ${room.white?.socketId === socket.id ? 'white' : 'black'}`);
  });
}

/**
 * Start a match - both players ready
 */
function startGame(io: Server, room: any) {
  room.start(); // Use the new status transition method

  io.to(`match:${room.matchId}`).emit('gameStart', {
    matchId: room.matchId,
    whiteBotName: room.white.botName,
    whiteModel: room.white.model,
    blackBotName: room.black.botName,
    blackModel: room.black.model,
    fen: room.chess.fen(),
    legalMoves: room.legalMovesUCI,
    timeoutSeconds: room.moveTimeoutSeconds
  });

  // Start with white's turn
  io.to(`match:${room.matchId}`).emit('turnStart', {
    color: 'white',
    fen: room.chess.fen(),
    legalMoves: room.legalMovesUCI,
    pgn: room.chess.pgn(),
    timeoutSeconds: room.moveTimeoutSeconds
  });

  // Set initial timeout
  room.activeTimeout = setTimeout(() => {
    if (room.status !== 'in_progress') return;

    io.to(`match:${room.matchId}`).emit('forfeit', {
      loserColor: 'white',
      reason: 'timeout',
      message: `White exceeded the ${room.moveTimeoutSeconds}s time limit`
    });

    // Trigger game end with black winning
    io.to(`match:${room.matchId}`).emit('gameOver', {
      result: '0-1',
      winner: 'black',
      termination: 'timeout',
      finalFen: room.chess.fen(),
      pgn: room.chess.pgn(),
      totalMoves: room.moves.length
    });

    room.complete(); // Use the new status transition method
    setTimeout(() => {
      registry.delete(room.matchId);
    }, 5000);
  }, room.moveTimeoutSeconds * 1000);

  console.log(`[Match ${room.matchId}] Game started - ${room.white.botName} (white) vs ${room.black.botName} (black)`);
}
