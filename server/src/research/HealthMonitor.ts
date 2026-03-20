export type HealthSnapshot = {
  totalMoves: number;
  fallbackMoves: number;
  retryAttempts: number;
  retrySuccesses: number;
};

export function evaluateRunHealth(snapshot: HealthSnapshot): {
  ok: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const fallbackRate = snapshot.totalMoves > 0 ? snapshot.fallbackMoves / snapshot.totalMoves : 0;
  const retrySuccessRate = snapshot.retryAttempts > 0 ? snapshot.retrySuccesses / snapshot.retryAttempts : 0;

  if (fallbackRate > 0.25) {
    warnings.push(`High fallback rate detected (${fallbackRate.toFixed(3)}).`);
  }
  if (snapshot.retryAttempts > 0 && retrySuccessRate < 0.25) {
    warnings.push(`Low retry success rate detected (${retrySuccessRate.toFixed(3)}).`);
  }

  return {
    ok: warnings.length === 0,
    warnings
  };
}
