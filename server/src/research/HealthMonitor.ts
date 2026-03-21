export type HealthSnapshot = {
  totalMoves: number;
  fallbackMoves: number;
  retryAttempts: number;
  retrySuccesses: number;
  repeatStateMoves: number;
  oscillationRejectedCount: number;
  collapseDetectedGames: number;
  noProgressMaxStreak: number;
};

export function evaluateRunHealth(snapshot: HealthSnapshot): {
  ok: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const fallbackRate = snapshot.totalMoves > 0 ? snapshot.fallbackMoves / snapshot.totalMoves : 0;
  const retrySuccessRate = snapshot.retryAttempts > 0 ? snapshot.retrySuccesses / snapshot.retryAttempts : 0;
  const repeatStateRate = snapshot.totalMoves > 0 ? snapshot.repeatStateMoves / snapshot.totalMoves : 0;
  const oscillationRate =
    snapshot.totalMoves > 0 ? snapshot.oscillationRejectedCount / snapshot.totalMoves : 0;

  if (fallbackRate > 0.25) {
    warnings.push(`High fallback rate detected (${fallbackRate.toFixed(3)}).`);
  }
  if (snapshot.retryAttempts > 0 && retrySuccessRate < 0.25) {
    warnings.push(`Low retry success rate detected (${retrySuccessRate.toFixed(3)}).`);
  }
  if (repeatStateRate > 0.1) {
    warnings.push(`High repeat-state rate detected (${repeatStateRate.toFixed(3)}).`);
  }
  if (oscillationRate > 0.05) {
    warnings.push(`Oscillation rejections are elevated (${oscillationRate.toFixed(3)}).`);
  }
  if (snapshot.noProgressMaxStreak >= 12) {
    warnings.push(`No-progress streak reached ${snapshot.noProgressMaxStreak} plies.`);
  }
  if (snapshot.collapseDetectedGames > 0) {
    warnings.push(`Behavioral collapse detected in ${snapshot.collapseDetectedGames} completed game(s).`);
  }

  return {
    ok: warnings.length === 0,
    warnings
  };
}
