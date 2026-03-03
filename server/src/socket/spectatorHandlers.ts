/**
 * Spectator socket handlers - watch live games
 */

import { Server, Socket } from 'socket.io';
import { registry } from '../game/MatchRegistry';

export function registerSpectatorHandlers(io: Server, socket: Socket) {
  /**
   * Spectate a match
   */
  socket.on('spectate', ({ matchId }: { matchId: string }) => {
    const room = registry.get(matchId);

    if (!room) {
      socket.emit('error', { 
        code: 'MATCH_NOT_FOUND', 
        message: 'Match not found or already completed' 
      });
      return;
    }

    // Join the match room
    socket.join(matchId);

    // Send current game state
    const state = room.getState();
    const summary = room.getSummary();

    socket.emit('gameState', {
      matchId: room.matchId,
      status: room.status,
      fen: room.chess.fen(),
      pgn: room.chess.pgn(),
      currentTurn: room.currentTurn,
      legalMoves: room.legalMovesUCI,
      moves: room.moves,
      whiteBotName: room.white?.botName || 'White',
      blackBotName: room.black?.botName || 'Black',
      whiteModel: room.white?.model || '',
      blackModel: room.black?.model || '',
      isGameOver: room.isOver,
      moveCount: room.moves.length,
      startedAt: room.startedAt
    });

    console.log(`[Spectator] ${socket.id} joined match ${matchId}`);
  });

  /**
   * Stop spectating
   */
  socket.on('unspectate', ({ matchId }: { matchId: string }) => {
    socket.leave(matchId);
    console.log(`[Spectator] ${socket.id} left match ${matchId}`);
  });
}
