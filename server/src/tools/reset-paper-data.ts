import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { getPaperAuditRoot, getPaperLogsRoot, getPaperRunsRoot } from '../research/PaperPaths.js';

dotenv.config();

async function clearDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') {
      continue;
    }
    await rm(path.join(dir, entry.name), { recursive: true, force: true });
  }

  const remainingEntries = await readdir(dir, { withFileTypes: true });
  for (const entry of remainingEntries) {
    if (entry.isDirectory() && entry.name !== '.gitkeep') {
      await rm(path.join(dir, entry.name), { recursive: true, force: true });
    }
  }
}

async function main(): Promise<void> {
  const targets = [getPaperRunsRoot(), getPaperLogsRoot(), getPaperAuditRoot()];
  for (const target of targets) {
    await clearDirectory(target);
    console.log(`Cleared ${target}`);
  }
}

main().catch((error: unknown) => {
  console.error('Failed to reset paper data:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
