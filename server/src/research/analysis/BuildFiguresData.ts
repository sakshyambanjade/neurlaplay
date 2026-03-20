import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AggregatedRunStats } from './AggregateRunStats.js';
import type { ComputedPaperMetrics } from './ComputePaperMetrics.js';

export async function buildFiguresData(
  runDir: string,
  aggregated: AggregatedRunStats,
  metrics: ComputedPaperMetrics
): Promise<string> {
  const figuresData = {
    generatedAt: new Date().toISOString(),
    runDir,
    overview: {
      totalGames: aggregated.totalGames,
      matchupCount: aggregated.matchupCount,
      overallFallbackRate: metrics.overallFallbackRate,
      overallRetrySuccessRate: metrics.overallRetrySuccessRate,
      overallIllegalMoveAttemptRate: metrics.overallIllegalMoveAttemptRate
    },
    figures: {
      modelComparison: metrics.modelComparison,
      reliability: aggregated.matchups.map((matchup) => ({
        label: matchup.label,
        fallbackRate: matchup.compliance.fallbackRate,
        llmMoveRate: matchup.compliance.llmMoveRate,
        illegalMoveAttemptRate: matchup.extraMetrics?.illegal_move_attempt_rate ?? 0,
        retrySuccessRate: matchup.extraMetrics?.retry_success_rate ?? 0
      })),
      quality: aggregated.matchups.map((matchup) => ({
        label: matchup.label,
        avgCplOverall: matchup.avgCpl.overall,
        blunderRateOverall: matchup.blunderRate.overall,
        repetitionRate: matchup.extraMetrics?.repetition_rate ?? 0,
        moveSelectionEntropy: matchup.extraMetrics?.move_selection_entropy ?? 0
      }))
    }
  };

  const figuresPath = path.join(runDir, 'figures_data.json');
  await writeFile(figuresPath, JSON.stringify(figuresData, null, 2), 'utf-8');
  return figuresPath;
}
