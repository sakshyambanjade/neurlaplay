import { readdir, readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

export type AggregatedMatchupStats = {
  label: string;
  statsPath: string;
  resultsPath: string;
  datapointsPath: string;
  whiteModel: string;
  blackModel: string;
  totalGames: number;
  avgCpl: {
    white: number;
    black: number;
    overall: number;
  };
  blunderRate: {
    white: number;
    black: number;
    overall: number;
  };
  compliance: {
    fallbackRate: number;
    llmMoveRate: number;
    fallbackMoves: number;
    totalMoves: number;
  };
  extraMetrics?: {
    illegal_move_attempt_rate: number;
    retry_success_rate: number;
    fallback_rate: number;
    move_selection_entropy: number;
    repetition_rate: number;
  };
};

export type AggregatedRunStats = {
  runDir: string;
  matchupCount: number;
  totalGames: number;
  matchups: AggregatedMatchupStats[];
};

export async function aggregateRunStats(runDir: string): Promise<AggregatedRunStats> {
  const entries = await readdir(runDir, { withFileTypes: true });
  const matchups: AggregatedMatchupStats[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const statsPath = path.join(runDir, entry.name, 'paper-stats.json');
    const resultsPath = path.join(runDir, entry.name, 'paper-results.json');
    const datapointsPath = path.join(runDir, entry.name, 'paper-datapoints.json');
    if (!fs.existsSync(statsPath)) {
      continue;
    }

    const parsed = JSON.parse(await readFile(statsPath, 'utf-8')) as {
      stats?: AggregatedMatchupStats;
    };
    const stats = parsed.stats;
    if (!stats) {
      continue;
    }

    matchups.push({
      label: entry.name,
      statsPath,
      resultsPath,
      datapointsPath,
      whiteModel: stats.whiteModel,
      blackModel: stats.blackModel,
      totalGames: stats.totalGames,
      avgCpl: stats.avgCpl,
      blunderRate: stats.blunderRate,
      compliance: {
        fallbackRate: stats.compliance.fallbackRate,
        llmMoveRate: stats.compliance.llmMoveRate,
        fallbackMoves: stats.compliance.fallbackMoves,
        totalMoves: stats.compliance.totalMoves
      },
      extraMetrics: stats.extraMetrics
    });
  }

  return {
    runDir,
    matchupCount: matchups.length,
    totalGames: matchups.reduce((sum, matchup) => sum + matchup.totalGames, 0),
    matchups
  };
}
