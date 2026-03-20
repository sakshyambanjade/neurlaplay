import type { GameTrace } from '../types/game.js';

export function computeGameMetrics(trace: GameTrace): {
  retryRate: number;
  fallbackRate: number;
  repetition: boolean;
} {
  return {
    retryRate: trace.moveCount > 0 ? trace.retryAttempts / trace.moveCount : 0,
    fallbackRate: trace.moveCount > 0 ? trace.fallbackMovesUsed / trace.moveCount : 0,
    repetition: trace.termination === 'threefold_repetition'
  };
}
