import fs from 'node:fs';
import path from 'node:path';
import type { ResumeState } from './types/run.js';

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

  const directories = fs.readdirSync(runDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const completedMatchups: string[] = [];
  const incompleteMatchups: string[] = [];

  for (const dir of directories) {
    const matchupDir = path.join(runDir, dir.name);
    if (fs.existsSync(path.join(matchupDir, 'paper-results.json'))) {
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
