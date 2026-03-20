export type GameTerminationReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'threefold_repetition'
  | 'insufficient_material'
  | 'timeout'
  | 'max_moves_white_ahead'
  | 'max_moves_black_ahead'
  | 'max_moves_draw'
  | 'timeout_white_ahead'
  | 'timeout_black_ahead'
  | 'timeout_draw'
  | 'unknown';

export type GameTrace = {
  schemaVersion: string;
  runId: string;
  matchupLabel: string;
  gameId: string;
  gameIndex: number;
  whiteModel: string;
  blackModel: string;
  result: string;
  termination: GameTerminationReason;
  moveCount: number;
  pgn: string;
  startedAt: string;
  endedAt: string;
  fallbackMovesUsed: number;
  retryAttempts: number;
  retrySuccesses: number;
};
