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
      overallIllegalMoveAttemptRate: metrics.overallIllegalMoveAttemptRate,
      overallOscillationRate: metrics.overallOscillationRate,
      overallBehavioralCollapseRate: metrics.overallBehavioralCollapseRate
    },
    figures: {
      systemIntegrity: aggregated.matchups.map((matchup) => ({
        label: matchup.label,
        fallbackRate: matchup.compliance.fallbackRate,
        retrySuccessRate: matchup.extraMetrics?.retry_success_rate ?? 0,
        illegalMoveAttemptRate: matchup.extraMetrics?.illegal_move_attempt_rate ?? 0
      })),
      behaviorCollapse: aggregated.matchups.map((matchup) => ({
        label: matchup.label,
        repetitionRate: matchup.extraMetrics?.repetition_rate ?? 0,
        reverseMoveRate: matchup.extraMetrics?.reverse_move_rate ?? 0,
        repeatStateRate: matchup.extraMetrics?.repeat_state_rate ?? 0,
        oscillationRate: matchup.extraMetrics?.oscillation_rate ?? 0,
        behavioralCollapseRate: matchup.extraMetrics?.behavioral_collapse_rate ?? 0,
        noProgressMaxStreak: matchup.extraMetrics?.no_progress_max_streak ?? 0,
        avgCplOverall: matchup.avgCpl.overall
      })),
      modelComparison: metrics.modelComparison,
      reliability: aggregated.matchups.map((matchup) => ({
        label: matchup.label,
        fallbackRate: matchup.compliance.fallbackRate,
        llmMoveRate: matchup.compliance.llmMoveRate,
        illegalMoveAttemptRate: matchup.extraMetrics?.illegal_move_attempt_rate ?? 0,
        retrySuccessRate: matchup.extraMetrics?.retry_success_rate ?? 0
      })),
      behavior: aggregated.matchups.map((matchup) => ({
        label: matchup.label,
        repetitionRate: matchup.extraMetrics?.repetition_rate ?? 0,
        reverseMoveRate: matchup.extraMetrics?.reverse_move_rate ?? 0,
        repeatStateRate: matchup.extraMetrics?.repeat_state_rate ?? 0,
        oscillationRate: matchup.extraMetrics?.oscillation_rate ?? 0,
        behavioralCollapseRate: matchup.extraMetrics?.behavioral_collapse_rate ?? 0,
        noProgressMaxStreak: matchup.extraMetrics?.no_progress_max_streak ?? 0
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
