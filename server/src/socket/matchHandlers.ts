import { Server, Socket } from 'socket.io';
import { registry } from '../game/MatchRegistry';
import { Matchmaker } from '../matchmaking/Matchmaker';
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

// Export matchmaker instance for global access
let matchmakerInstance: Matchmaker | null = null;

export function setMatchmaker(mm: Matchmaker) {
  matchmakerInstance = mm;
}

/**
 * Match setup handlers - create, join, configure, ready
 */
export function registerMatchHandlers(io: Server, socket: Socket) {
  const isConfigComplete = (config?: PlayerConfig | null) => {
    if (!config) return false;
    return Boolean(
      config.botName?.trim() &&
      config.model?.trim() &&
      config.endpointType &&
      config.endpointUrl?.trim() &&
      config.apiKey?.trim()
    );
  };

  /**
   * Create a new match
   */
  socket.on('createMatch', (data: CreateMatchPayload) => {
    // Generate 6-character match ID
    const matchId = Math.random().toString(36).slice(2, 8).toUpperCase();
    // Generate player session ID (unique per player, persists across socket reconnects)
    const playerSessionId = Math.random().toString(36).slice(2, 12).toUpperCase();

    const room = registry.create(matchId, data.timeoutSeconds || config.DEFAULT_MOVE_TIMEOUT_SECONDS);

    socket.join(`match:${matchId}`);

    // Register creator as white with session ID
    room.white = { socketId: socket.id, playerSessionId, botName: '', model: '', endpointType: 'openai', endpointUrl: '', apiKey: '' };

    socket.emit('matchCreated', {
      matchId,
      playerSessionId,
      color: 'white'
    });

    console.log(`[Match] Created: ${matchId}`);
    console.log(`[Match ${matchId}] Player joined: white (creator) | SessionID: ${playerSessionId}`);
  });

  /**
   * Join an existing match
   */
  socket.on('joinMatch', (data: JoinMatchPayload) => {
    const matchId = data.matchId;
    console.log(`[Socket ${socket.id}] joinMatch event RECEIVED for match: ${matchId}`);
    
    const room = registry.get(matchId);

    if (!room) {
      console.log(`[Socket ${socket.id}] ERROR: Match "${matchId}" not found`);
      socket.emit('error', { code: 'MATCH_NOT_FOUND', message: 'Match not found' });
      return;
    }

    console.log(`[Socket ${socket.id}] Match "${matchId}" found, status: ${room.status}, white: ${!!room.white}, black: ${!!room.black}`);

    if (room.status !== 'waiting') {
      console.log(`[Socket ${socket.id}] ERROR: Match not waiting (status: ${room.status})`);
      socket.emit('error', { code: 'MATCH_NOT_WAITING', message: 'Match is not accepting new players' });
      return;
    }

    // Generate session ID for this player
    const playerSessionId = Math.random().toString(36).slice(2, 12).toUpperCase();

    // Determine which color this player gets
    let color: PlayerColor;

    if (!room.white) {
      room.white = { socketId: socket.id, playerSessionId, botName: '', model: '', endpointType: 'openai', endpointUrl: '', apiKey: '' };
      color = 'white';
      console.log(`[Socket ${socket.id}] Assigned as WHITE (first player to join) | SessionID: ${playerSessionId}`);
    } else if (!room.black) {
      room.black = { socketId: socket.id, playerSessionId, botName: '', model: '', endpointType: 'openai', endpointUrl: '', apiKey: '' };
      color = 'black';
      console.log(`[Socket ${socket.id}] Assigned as BLACK (second player to join) | SessionID: ${playerSessionId}`);
    } else {
      console.log(`[Socket ${socket.id}] ERROR: Match is FULL (both white and black already assigned)`);
      socket.emit('error', { code: 'MATCH_FULL', message: 'This match already has 2 players' });
      return;
    }

    socket.join(`match:${matchId}`);
    console.log(`[Socket ${socket.id}] Joined room: match:${matchId}`);

    socket.emit('matchCreated', {
      matchId: matchId,
      playerSessionId,
      color
    });
    console.log(`[Socket ${socket.id}] Emitted matchCreated event with color: ${color}`);

    // Notify other players in the room that someone joined
    socket.to(`match:${matchId}`).emit('playerJoined', {
      color,
      playerCount: (room.white ? 1 : 0) + (room.black ? 1 : 0)
    });

    console.log(`[Match ${matchId}] PLAYER JOINED: ${color} | White: ${!room.white ? 'EMPTY' : room.white.playerSessionId || room.white.socketId.slice(0, 8)}, Black: ${!room.black ? 'EMPTY' : room.black.playerSessionId || room.black.socketId.slice(0, 8)}`);
  });

  /**
   * Set player config (bot name, model, API endpoint, etc)
   */
  socket.on('setConfig', (data: SetConfigPayload & { playerSessionId?: string }) => {
    console.log(`[Socket ${socket.id}] setConfig event RECEIVED for match: ${data.matchId}`);
    
    const room = registry.get(data.matchId);

    if (!room) {
      console.log(`[Socket ${socket.id}] ERROR: Match ${data.matchId} not found for setConfig`);
      socket.emit('error', { code: 'MATCH_NOT_FOUND' });
      return;
    }

    // Find which player this is using playerSessionId (more reliable than socket.id which can change on reconnect)
    let config: PlayerConfig | null = null;
    let playerColor: PlayerColor = 'white';

    if (data.playerSessionId) {
      // Use playerSessionId to identify player
      if (room.white?.playerSessionId === data.playerSessionId) {
        config = room.white;
        playerColor = 'white';
        room.white.socketId = socket.id; // Update socket ID in case of reconnect
      } else if (room.black?.playerSessionId === data.playerSessionId) {
        config = room.black;
        playerColor = 'black';
        room.black.socketId = socket.id; // Update socket ID in case of reconnect
      }
    }

    // Fallback to socket.id if playerSessionId not provided (for backwards compatibility)
    if (!config) {
      if (room.white?.socketId === socket.id) {
        config = room.white;
        playerColor = 'white';
      } else if (room.black?.socketId === socket.id) {
        config = room.black;
        playerColor = 'black';
      }
    }

    if (!config) {
      console.log(`[Socket ${socket.id}] ERROR: Socket not found in match ${data.matchId} | playerSessionId: ${data.playerSessionId} | white: ${room.white?.playerSessionId}, black: ${room.black?.playerSessionId}`);
      socket.emit('error', { code: 'NOT_IN_GAME' });
      return;
    }

    if (!data.botName?.trim() || !data.model?.trim() || !data.endpointUrl?.trim() || !data.apiKey?.trim()) {
      console.log(`[Socket ${socket.id}] ERROR: Missing required config fields`);
      socket.emit('error', { code: 'INVALID_CONFIG', message: 'botName, model, endpointUrl, and apiKey are required' });
      return;
    }

    // Update config
    config.botName = data.botName.trim();
    config.model = data.model.trim();
    config.endpointType = data.endpointType;
    config.endpointUrl = data.endpointUrl.trim();
    config.apiKey = '__configured__';

    // Notify opponent
    const opponent = room.white?.socketId === socket.id ? room.black : room.white;
    if (opponent) {
      io.to(`match:${data.matchId}`).emit('opponentConfigured', {
        botName: config.botName,
        model: config.model,
        endpointType: config.endpointType
      });
    }

    console.log(`[Match ${data.matchId}] Config set for ${playerColor} | Bot: "${config.botName}" | Model: "${config.model}"`);
    console.log(`[Match ${data.matchId}] Ready status - White: ${room.white?.isReady || false}, Black: ${room.black?.isReady || false}`);
  });

  /**
   * Player is ready to start
   */
  socket.on('setReady', (data: SetReadyPayload & { playerSessionId?: string }) => {
    console.log(`[Socket ${socket.id}] setReady event RECEIVED for match: ${data.matchId}`);
    
    const room = registry.get(data.matchId);

    if (!room) {
      console.log(`[Socket ${socket.id}] ERROR: Match ${data.matchId} not found for setReady`);
      socket.emit('error', { code: 'MATCH_NOT_FOUND' });
      return;
    }

    // Mark this player as ready only if config is complete
    let playerConfig: PlayerConfig | null = null;
    let playerColor: PlayerColor;

    // Use playerSessionId to identify player
    if (data.playerSessionId) {
      if (room.white?.playerSessionId === data.playerSessionId) {
        playerConfig = room.white;
        playerColor = 'white';
        room.white.socketId = socket.id; // Update socket ID in case of reconnect
      } else if (room.black?.playerSessionId === data.playerSessionId) {
        playerConfig = room.black;
        playerColor = 'black';
        room.black.socketId = socket.id; // Update socket ID in case of reconnect
      }
    }

    // Fallback to socket.id
    if (!playerConfig) {
      if (room.white?.socketId === socket.id) {
        playerConfig = room.white;
        playerColor = 'white';
      } else if (room.black?.socketId === socket.id) {
        playerConfig = room.black;
        playerColor = 'black';
      } else {
        console.log(`[Socket ${socket.id}] ERROR: Socket not found in match ${data.matchId} | playerSessionId: ${data.playerSessionId}`);
        socket.emit('error', { code: 'NOT_IN_GAME' });
        return;
      }
    }

    if (!isConfigComplete(playerConfig)) {
      console.log(`[Socket ${socket.id}] ERROR: Config incomplete for ${playerColor} | Bot: "${playerConfig.botName}", API Key: ${!!playerConfig.apiKey}`);
      socket.emit('error', {
        code: 'CONFIG_REQUIRED',
        message: 'Complete bot config with API key before setting ready'
      });
      return;
    }

    playerConfig.isReady = true;

    console.log(`[Match ${data.matchId}] Player READY: ${playerColor} with bot "${playerConfig.botName}"`);

    // Notify both players
    io.to(`match:${data.matchId}`).emit('playerReady', {
      color: playerColor
    });

    // Check if both are ready
    const whiteReady = room.white?.isReady || false;
    const blackReady = room.black?.isReady || false;
    console.log(`[Match ${data.matchId}] Ready check - White: ${whiteReady}, Black: ${blackReady}`);

    // If both are ready, start the game
    if (whiteReady && blackReady) {
      console.log(`[Match ${data.matchId}] ✅ BOTH PLAYERS READY - Starting game!`);
      startGame(io, room);
    } else {
      console.log(`[Match ${data.matchId}] ⏳ Waiting for other player... (${whiteReady ? 'White ready' : 'White waiting'}, ${blackReady ? 'Black ready' : 'Black waiting'})`);
    }
  });

  /**
   * Bot registration - bot joins the matchmaking pool
   */
  socket.on('registerBot', (data: any) => {
    const { botId, botName, elo = 1500 } = data;

    if (!botId || !botName) {
      socket.emit('error', { code: 'INVALID_BOT_DATA', message: 'botId and botName required' });
      return;
    }

    // Register bot with matchmaker
    if (matchmakerInstance) {
      matchmakerInstance.registerBot(botId, botName, elo, socket.id);
      console.log(`[Matchmaker] Bot registered: ${botName} (${botId}) - Elo: ${elo}`);
    }

    socket.emit('botRegistered', { botId, botName });
  });

  /**
   * Bot unregistration - bot leaves the matchmaking pool
   */
  socket.on('unregisterBot', (data: any) => {
    const { botId } = data;

    if (!botId) return;

    if (matchmakerInstance) {
      matchmakerInstance.unregisterBot(botId);
      console.log(`[Matchmaker] Bot unregistered: ${botId}`);
    }
  });
}

/**
 * Start a match - both players ready
 */
function startGame(io: Server, room: any) {
  room.start(); // Use the new status transition method

  console.log(`[Match ${room.matchId}] 🎮 GAME STARTED!`);
  console.log(`[Match ${room.matchId}] White: "${room.white?.botName}" (${room.white?.model})`);
  console.log(`[Match ${room.matchId}] Black: "${room.black?.botName}" (${room.black?.model})`);
  console.log(`[Match ${room.matchId}] Sending gameStart event to room match:${room.matchId}`);

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

  console.log(`[Match ${room.matchId}] ✅ gameStart event emitted`);

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
