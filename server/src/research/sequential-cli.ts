import { readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import type { BatchConfig } from './types.js';
import { SequentialGameRunner } from './SequentialGameRunner.js';

dotenv.config();

function parseConfigArg(): string {
  const argIndex = process.argv.findIndex((arg) => arg === '--config');
  if (argIndex === -1 || !process.argv[argIndex + 1]) {
    throw new Error('Missing --config path');
  }
  return process.argv[argIndex + 1]!;
}

async function main() {
  const configPath = parseConfigArg();
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  const configRaw = await readFile(absoluteConfigPath, 'utf-8');
  const config = JSON.parse(configRaw) as BatchConfig;

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const runner = new SequentialGameRunner(baseUrl);
  await runner.run(config);
}

main().catch((error: unknown) => {
  console.error('Batch run failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
