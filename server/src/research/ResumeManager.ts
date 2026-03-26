import fs from 'node:fs';
import path from 'node:path';
import type { ResumeState } from './types/run.js';

function countUniqueCompletedGames(matchupDir: string): number {
  const liveGamesPath = path.join(matchupDir, 'paper-games.live.jsonl');
  if (!fs.existsSync(liveGamesPath)) {
    return 0;
  }

  const raw = fs.readFileSync(liveGamesPath, 'utf8');
  const byGameIndex = new Set<number>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const entry = JSON.parse(trimmed) as { gameIndex?: number };
      if (typeof entry.gameIndex === 'number') {
        byGameIndex.add(entry.gameIndex);
      }
    } catch {
      // Ignore malformed lines during resume detection.
    }
  }

  return byGameIndex.size;
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function detectIncompleteRun(runDir: string): ResumeState {
  const runId = path.basename(runDir);
  if (!fs.existsSync(runDir)) {
    return {
      runId,
      exists: false,
      resumable: false,
      done: false,
      completedMatchups: [],
      incompleteMatchups: []
    };
  }

  const statusPath = path.join(runDir, 'status.json');
  const status = fs.existsSync(statusPath)
    ? JSON.parse(fs.readFileSync(statusPath, 'utf8')) as { done?: boolean }
    : null;
  const acceptedConfigPath = path.join(runDir, 'accepted-config.json');
  const acceptedConfig = fs.existsSync(acceptedConfigPath)
    ? JSON.parse(fs.readFileSync(acceptedConfigPath, 'utf8')) as {
        matchups?: Array<{ label: string; games: number }>;
      }
    : null;
  const targetGamesByMatchup = new Map<string, number>(
    (acceptedConfig?.matchups ?? []).map((matchup) => [sanitizeLabel(matchup.label), matchup.games])
  );

  const directories = fs.readdirSync(runDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const completedMatchups: string[] = [];
  const incompleteMatchups: string[] = [];

  for (const dir of directories) {
    const matchupDir = path.join(runDir, dir.name);
    const hasFinalArtifacts = fs.existsSync(path.join(matchupDir, 'paper-results.json'));
    const completedGames = countUniqueCompletedGames(matchupDir);
    const targetGames = targetGamesByMatchup.get(dir.name) ?? Number.POSITIVE_INFINITY;
    if (hasFinalArtifacts && completedGames >= targetGames) {
      completedMatchups.push(dir.name);
    } else {
      incompleteMatchups.push(dir.name);
    }
  }

  return {
    runId,
    exists: true,
    resumable: !status?.done,
    done: Boolean(status?.done),
    completedMatchups,
    incompleteMatchups
  };
}

export async function resumeRunIfPossible(runDir: string): Promise<ResumeState> {
  return detectIncompleteRun(runDir);
}
