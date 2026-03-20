import type { AggregatedRunStats } from './AggregateRunStats.js';

export type ComputedPaperMetrics = {
  totalGames: number;
  matchupCount: number;
  overallFallbackRate: number;
  overallRetrySuccessRate: number;
  overallIllegalMoveAttemptRate: number;
  modelComparison: Array<{
    label: string;
    whiteModel: string;
    blackModel: string;
    avgCplOverall: number;
    fallbackRate: number;
    repetitionRate: number;
    illegalMoveAttemptRate: number;
    retrySuccessRate: number;
  }>;
};

function safeAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computePaperMetrics(aggregated: AggregatedRunStats): ComputedPaperMetrics {
  const overallFallbackRate = safeAverage(
    aggregated.matchups.map((matchup) => matchup.compliance.fallbackRate)
  );
  const overallRetrySuccessRate = safeAverage(
    aggregated.matchups.map((matchup) => matchup.extraMetrics?.retry_success_rate ?? 0)
  );
  const overallIllegalMoveAttemptRate = safeAverage(
    aggregated.matchups.map((matchup) => matchup.extraMetrics?.illegal_move_attempt_rate ?? 0)
  );

  return {
    totalGames: aggregated.totalGames,
    matchupCount: aggregated.matchupCount,
    overallFallbackRate,
    overallRetrySuccessRate,
    overallIllegalMoveAttemptRate,
    modelComparison: aggregated.matchups.map((matchup) => ({
      label: matchup.label,
      whiteModel: matchup.whiteModel,
      blackModel: matchup.blackModel,
      avgCplOverall: matchup.avgCpl.overall,
      fallbackRate: matchup.compliance.fallbackRate,
      repetitionRate: matchup.extraMetrics?.repetition_rate ?? 0,
      illegalMoveAttemptRate: matchup.extraMetrics?.illegal_move_attempt_rate ?? 0,
      retrySuccessRate: matchup.extraMetrics?.retry_success_rate ?? 0
    }))
  };
}
