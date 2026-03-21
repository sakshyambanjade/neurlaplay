import type { GameTrace } from '../types/game.js';

export function computeGameMetrics(trace: GameTrace): {
  retryRate: number;
  fallbackRate: number;
  repetition: boolean;
  reverseMoveRate: number;
  repeatStateRate: number;
  oscillationRate: number;
  noProgressMaxStreak: number;
  collapseRate: number;
} {
  const moveCount = Math.max(1, trace.moveCount);
  return {
    retryRate: trace.moveCount > 0 ? trace.retryAttempts / trace.moveCount : 0,
    fallbackRate: trace.moveCount > 0 ? trace.fallbackMovesUsed / trace.moveCount : 0,
    repetition: trace.termination === 'threefold_repetition',
    reverseMoveRate: (trace.reverseMoveCount ?? 0) / moveCount,
    repeatStateRate: (trace.repeatStateCount ?? 0) / moveCount,
    oscillationRate: (trace.oscillationRejectedCount ?? 0) / moveCount,
    noProgressMaxStreak: trace.noProgressMaxStreak ?? 0,
    collapseRate: trace.collapseDetected ? 1 : 0
  };
}
