import { readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { validateRunConfig } from '../config/schema.js';
import { resolvePaperConfigPath } from '../research/PaperPaths.js';
import type { RunConfig } from '../research/types/run.js';

dotenv.config();

function getArgValue(name: string): string | undefined {
  const exactPrefix = `${name}=`;
  for (let i = 0; i < process.argv.length; i += 1) {
    const entry = process.argv[i];
    if (!entry || entry === '--') {
      continue;
    }
    if (entry.startsWith(exactPrefix)) {
      return entry.slice(exactPrefix.length);
    }
    if (entry === name) {
      return process.argv[i + 1];
    }
  }
  return undefined;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function countGamesPerModel(config: RunConfig): Map<string, number> {
  const out = new Map<string, number>();
  for (const matchup of config.matchups) {
    out.set(matchup.white, (out.get(matchup.white) ?? 0) + matchup.games);
    out.set(matchup.black, (out.get(matchup.black) ?? 0) + matchup.games);
  }
  return out;
}

function estimateRequestsForAveragePlies(games: number, averagePlies: number): number {
  return games * averagePlies;
}

function estimateTokens(requests: number, avgInputTokens: number, outputTokens: number): number {
  return requests * (avgInputTokens + outputTokens);
}

async function main(): Promise<void> {
  const configArg = getArgValue('--config');
  const avgInputTokens = Math.max(1, Number(getArgValue('--avgInputTokens') ?? 150));
  const avgOutputTokens = Math.max(1, Number(getArgValue('--avgOutputTokens') ?? 2));

  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : resolvePaperConfigPath('main', 'main_1200_games.json');

  const raw = await readFile(configPath, 'utf-8');
  const config = validateRunConfig(JSON.parse(raw));

  const totalGames = config.matchups.reduce((sum, matchup) => sum + matchup.games, 0);
  const maxPliesPerGame = config.settings.maxMoves;
  const worstCaseRequests = totalGames * maxPliesPerGame;
  const gamesPerModel = countGamesPerModel(config);

  console.log('Paper API budget');
  console.log(`Config: ${configPath}`);
  console.log(`Matchups: ${config.matchups.length}`);
  console.log(`Total games: ${formatNumber(totalGames)}`);
  console.log(`Max plies per game: ${formatNumber(maxPliesPerGame)}`);
  console.log(`Worst-case move requests: ${formatNumber(worstCaseRequests)}`);
  console.log('');
  console.log('Per-model worst-case requests');
  for (const [model, games] of [...gamesPerModel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const worstCaseModelRequests = Math.ceil((games * maxPliesPerGame) / 2);
    console.log(`- ${model}: ${formatNumber(worstCaseModelRequests)} requests across ${formatNumber(games)} games`);
  }

  console.log('');
  console.log(`Token assumption per request: ~${avgInputTokens} input + ${avgOutputTokens} output tokens`);
  for (const averagePlies of [60, 80, 100]) {
    const requests = estimateRequestsForAveragePlies(totalGames, averagePlies);
    const totalTokens = estimateTokens(requests, avgInputTokens, avgOutputTokens);
    console.log(
      `- Avg ${averagePlies} plies/game: ${formatNumber(requests)} requests, ~${formatNumber(totalTokens)} total tokens`
    );
  }
}

main().catch((error: unknown) => {
  console.error('Failed to estimate paper budget:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
