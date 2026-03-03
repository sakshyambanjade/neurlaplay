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
import { config } from '../config';
import { saveMove, getBotElo, updateBotElo, finalizeMatch } from '../db';
import { newRatings } from '../rating/Elo';

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
      // Invalid move - forfeit the player
      console.log(`[Game ${data.matchId}] Invalid move from ${playerColor}: ${data.uci}`);
      
      socket.emit('error', { 
        code: 'INVALID_MOVE', 
        message: `Move ${data.uci} is not legal` 
      });

      await handleForfeit(
        io,
        room,
        playerColor,
        'invalid_move',
        `Invalid move: ${data.uci}`
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
      reasoning: data.reasoning
    };

    room.moves.push(moveRecord);

    // Broadcast to the match room (both players and spectators)
    io.to(data.matchId).emit('moveMade', {
      ...moveRecord,
      fen: room.chess.fen(),
      isCheck: room.chess.isCheck(),
      legalMoves: room.legalMovesUCI,
      pgn: room.chess.pgn()
    });

    // Save move to database
    // TODO: Save move to Supabase
    // await saveMove(data.matchId, moveRecord);

    // Check for game-ending conditions
    if (room.isOver) {
      const termination: Termination = room.termination;
      let winner: PlayerColor | null = null;

      if (room.chess.isCheckmate()) {
        winner = room.currentTurn === 'white' ? 'black' : 'white';
      }

      await handleGameEnd(io, room, winner, termination);
      return;
    }

    // Check for move cap
    if (room.hasReachedMoveCap) {
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
      
      await handleForfeit(io, room, loser, 'timeout', 
        `${loser} exceeded the ${room.moveTimeoutSeconds}s time limit`);
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

    await handleForfeit(io, room, playerColor, data.reason);
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
        waitSeconds: config.DISCONNECT_GRACE_PERIOD_MS / 1000
      });

      // Wait for reconnect, then auto-forfeit
      const timeout = setTimeout(async () => {
        const current = registry.get(room.matchId);
        if (current?.status === 'in_progress') {
          await handleForfeit(io, current, playerColor, 'disconnect',
            `${playerColor} disconnected and did not reconnect`);
        }
      }, config.DISCONNECT_GRACE_PERIOD_MS);

      // Store timeout for potential cleanup
      (room as any).disconnectTimeout = timeout;
    }
  });
}

/**
 * Handle a player forfeit - emit event and trigger game end
 */
async function handleForfeit(
  io: Server,
  room: MatchRoom,
  loserColor: PlayerColor,
  reason: string,
  message?: string
) {
  const winner = loserColor === 'white' ? 'black' : 'white';

  io.to(room.matchId).emit('forfeit', {
    loserColor,
    reason,
    message: message || `${loserColor} forfeited: ${reason}`
  });

  await handleGameEnd(io, room, winner, 'forfeit');
}

/**
 * Handle game end - save result, update Elo, notify players, clean up
 */
async function handleGameEnd(
  io: Server,
  room: MatchRoom,
  winner: PlayerColor | null,
  termination: Termination,
  message?: string
) {
  // Prevent multiple calls
  if (room.status === 'completed') {
    return;
  }

  room.complete();

  // Calculate result
  let result: GameResult = '*';
  if (winner === 'white') result = '1-0';
  else if (winner === 'black') result = '0-1';
  else result = '1/2-1/2';

  // Get bot IDs (if available)
  const whiteBotId = room.white?.botId;
  const blackBotId = room.black?.botId;
  const winnerBotId = winner === 'white' ? whiteBotId : winner === 'black' ? blackBotId : null;

  // Calculate Elo changes
  let eloChanges: { white: number; black: number } | undefined;
  
  if (whiteBotId && blackBotId) {
    // Get current Elo ratings from database
    const whiteElo = await getBotElo(whiteBotId);
    const blackElo = await getBotElo(blackBotId);

    // Calculate new ratings
    const { white: newWhiteElo, black: newBlackElo, whiteChange, blackChange } = 
      newRatings(whiteElo, blackElo, result);

    eloChanges = { white: whiteChange, black: blackChange };

    // Update Elo in database
    await updateBotElo(whiteBotId, newWhiteElo, whiteChange);
    await updateBotElo(blackBotId, newBlackElo, blackChange);

    // Finalize match in database
    await finalizeMatch({
      id: room.matchId,
      result,
      termination,
      winner_bot_id: winnerBotId || null,
      white_elo_after: newWhiteElo,
      black_elo_after: newBlackElo,
      final_fen: room.chess.fen(),
      pgn: room.chess.pgn(),
      total_moves: room.moves.length
    });

    console.log(`[Game ${room.matchId}] Ended - Result: ${result}, Elo changes: White ${whiteChange > 0 ? '+' : ''}${whiteChange}, Black ${blackChange > 0 ? '+' : ''}${blackChange}`);
  }

  // Emit game over event
  io.to(room.matchId).emit('gameOver', {
    result,
    winner,
    termination,
    finalFen: room.chess.fen(),
    pgn: room.chess.pgn(),
    totalMoves: room.moves.length,
    eloChanges
  });

  // Clean up the room after a brief delay
  setTimeout(() => {
    registry.delete(room.matchId);
  }, 5000);
}
