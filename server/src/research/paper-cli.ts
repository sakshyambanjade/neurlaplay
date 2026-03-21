import { readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { validateRunConfig } from '../config/schema.js';
import { runPaperPipeline } from './PaperPipeline.js';
import { resolvePaperConfigPath } from './PaperPaths.js';

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

async function main() {
  const configArg = getArgValue('--config');
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : resolvePaperConfigPath('main', 'main_1200_games.json');

  const raw = await readFile(configPath, 'utf-8');
  const config = validateRunConfig(JSON.parse(raw));
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

  const result = await runPaperPipeline(config, { ollamaBaseUrl: baseUrl });

  console.log('Paper pipeline complete.');
  console.log(`Run ID: ${result.runId}`);
  console.log(`Run dir: ${result.runDir}`);
  console.log(`Artifacts: ${result.artifacts.files.length}`);
  if (result.artifacts.zipPath) {
    console.log(`Zip: ${result.artifacts.zipPath}`);
  }
}

main().catch((error: unknown) => {
  console.error('Paper pipeline failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
