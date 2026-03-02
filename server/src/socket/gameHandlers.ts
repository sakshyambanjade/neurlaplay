import { Server, Socket } from 'socket.io';
import { registry } from '../game/MatchRegistry';
import { MatchRoom } from '../game/MatchRoom';
import {
  MovePayload,
  ForfeitPayload,
  GameStatus,
  PlayerColor,
  GameResult,
  Termination
} from '../types';

/**
 * Game event handlers - move submission, forfeit, disconnect
 */
export function registerGameHandlers(io: Server, socket: Socket) {
  /**
   * Move submission from client
   */
  socket.on('move', async (data: MovePayload) => {
    const room = registry.get(data.matchId);

    if (!room || room.status !== 'in_progress') {
      socket.emit('error', { code: 'GAME_NOT_IN_PROGRESS', message: 'Game is not in progress' });
      return;
    }

    // Determine which player is submitting
    const playerColor: PlayerColor | null =
      room.white?.socketId === socket.id ? 'white' :
      room.black?.socketId === socket.id ? 'black' : null;

    if (!playerColor) {
      socket.emit('error', { code: 'NOT_IN_GAME', message: 'You are not in this game' });
      return;
    }

    // Verify it's this player's turn
    if (playerColor !== room.currentTurn) {
      socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'It is not your turn' });
      return;
    }

    // Clear the timeout since we got a move
    room.clearTimeout();

    // Validate and apply the move
    const fenBefore = room.chess.fen();
    const isValid = room.applyMove(data.uci);

    if (!isValid) {
      // Move validation failed - should be impossible if client validated correctly
      await handleGameEnd(
        io,
        room,
        playerColor === 'white' ? 'black' : 'white',
        'forfeit',
        'Invalid move after client validation'
      );
      return;
    }

    // Store the move
    const history = room.chess.history({ verbose: true });
    const lastMove = history[history.length - 1];

    const moveRecord = {
      moveNumber: room.moves.length + 1,
      playerColor,
      uci: data.uci,
      san: lastMove.san,
      fenBefore,
      fenAfter: room.chess.fen(),
      reasoning: data.reasoning,
      timeTakenMs: data.timeTakenMs,
      createdAt: new Date()
    };

    room.moves.push(moveRecord);

    // Broadcast the move to both players
    io.to(data.matchId).emit('moveMade', {
      ...moveRecord,
      fen: room.chess.fen(),
      isCheck: room.chess.isCheck(),
      legalMoves: room.legalMovesUCI,
      pgn: room.chess.pgn()
    });

    // TODO: Save move to Supabase
    // await saveMove(data.matchId, moveRecord);

    // Check for game-ending conditions
    if (room.isOver) {
      const termination: Termination = room.termination;
      let winner: PlayerColor | null = null;

      if (room.result === '1-0') winner = 'white';
      else if (room.result === '0-1') winner = 'black';

      await handleGameEnd(io, room, winner, termination);
      return;
    }

    // Check 200-move cap (400 half-moves)
    if (room.moves.length >= 400) {
      io.to(data.matchId).emit('gameOver', {
        result: '1/2-1/2',
        termination: 'move_cap' as Termination,
        finalFen: room.chess.fen(),
        pgn: room.chess.pgn(),
        totalMoves: room.moves.length,
        winner: null
      });

      await handleGameEnd(io, room, null, 'move_cap');
      return;
    }

    // Set timeout for the next player
    const nextPlayerColor = room.currentTurn;
    room.activeTimeout = setTimeout(async () => {
      if (room.status !== 'in_progress') return;

      const loser = nextPlayerColor;
      const winner = loser === 'white' ? 'black' : 'white';

      io.to(data.matchId).emit('forfeit', {
        loserColor: loser,
        reason: 'timeout',
        message: `${loser} exceeded the ${room.moveTimeoutSeconds}s time limit`
      });

      await handleGameEnd(io, room, winner, 'timeout');
    }, room.moveTimeoutSeconds * 1000);

    // Notify both players of the next turn
    io.to(data.matchId).emit('turnStart', {
      color: room.currentTurn,
      fen: room.chess.fen(),
      legalMoves: room.legalMovesUCI,
      pgn: room.chess.pgn(),
      timeoutSeconds: room.moveTimeoutSeconds
    });
  });

  /**
   * Player forfeit
   */
  socket.on('forfeit', async (data: ForfeitPayload) => {
    const room = registry.get(data.matchId);

    if (!room || room.status !== 'in_progress') {
      socket.emit('error', { code: 'GAME_NOT_IN_PROGRESS' });
      return;
    }

    const playerColor: PlayerColor | null =
      room.white?.socketId === socket.id ? 'white' :
      room.black?.socketId === socket.id ? 'black' : null;

    if (!playerColor) {
      socket.emit('error', { code: 'NOT_IN_GAME' });
      return;
    }

    const winner = playerColor === 'white' ? 'black' : 'white';

    io.to(data.matchId).emit('forfeit', {
      loserColor: playerColor,
      reason: data.reason,
      message: `${playerColor} forfeited: ${data.reason}`
    });

    await handleGameEnd(io, room, winner, 'forfeit');
  });

  /**
   * Player disconnect
   */
  socket.on('disconnect', async () => {
    // Find any active game this player is in
    for (const room of registry.getAll()) {
      if (room.status !== 'in_progress') continue;

      const isWhite = room.white?.socketId === socket.id;
      const isBlack = room.black?.socketId === socket.id;

      if (!isWhite && !isBlack) continue;

      const playerColor = isWhite ? 'white' : 'black';
      const opponent = isWhite ? 'black' : 'white';

      // Notify opponent of disconnect
      io.to(room.matchId).emit('opponentDisconnected', {
        color: playerColor,
        waitSeconds: 60
      });

      // Wait 60 seconds for reconnect, then auto-forfeit
      const timeout = setTimeout(async () => {
        const current = registry.get(room.matchId);
        if (current?.status === 'in_progress') {
          const winner = playerColor === 'white' ? 'black' : 'white';
          io.to(room.matchId).emit('forfeit', {
            loserColor: playerColor,
            reason: 'disconnect',
            message: `${playerColor} disconnected and did not reconnect`
          });
          await handleGameEnd(io, current, winner, 'disconnect');
        }
      }, 60000);

      // Store timeout for potential cleanup
      (room as any).disconnectTimeout = timeout;
    }
  });
}

/**
 * Handle game end - save result, notify players, clean up
 */
async function handleGameEnd(
  io: Server,
  room: MatchRoom,
  winner: PlayerColor | null,
  termination: Termination,
  message?: string
) {
  room.end();

  let result: GameResult = '*';
  if (winner === 'white') result = '1-0';
  else if (winner === 'black') result = '0-1';
  else result = '1/2-1/2';

  const summary = room.getSummary();

  io.to(room.matchId).emit('gameOver', {
    result,
    winner,
    termination,
    finalFen: room.chess.fen(),
    pgn: room.chess.pgn(),
    totalMoves: room.moves.length
  });

  // TODO: Save final match result to Supabase
  // await finalizeMatch(room.matchId, result, termination, winner, room);

  // Clean up the room after a brief delay
  setTimeout(() => {
    registry.delete(room.matchId);
  }, 5000);
}
