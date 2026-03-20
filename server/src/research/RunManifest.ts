import { writeFile, mkdir } from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { RunConfig, RunManifest } from './types/run.js';

export const PAPER_PROMPT_TEMPLATE = {
  system:
    'Return exactly one integer index for the best chess move. No words. No punctuation.',
  user:
    'FEN: {fen}\nLegal moves:\n{moves}\nOutput only the integer index.'
};

export function hashAcceptedConfig(config: RunConfig): string {
  return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

export function createRunManifest(runId: string, gitCommit: string, config: RunConfig): RunManifest {
  return {
    runId,
    createdAt: new Date().toISOString(),
    gitCommit,
    nodeVersion: process.version,
    acceptedConfigHash: hashAcceptedConfig(config),
    schemaVersion: config.logging.schemaVersion,
    config,
    promptTemplate: PAPER_PROMPT_TEMPLATE,
    decodingParams: {
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens
    },
    contextPolicy: config.contextPolicy,
    hardware: {
      platform: os.platform(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model ?? 'unknown',
      totalMemoryGB: (os.totalmem() / 1e9).toFixed(1)
    },
    randomSeed: config.seed
  };
}

export async function writeRunManifest(runDir: string, manifest: RunManifest): Promise<string> {
  await mkdir(runDir, { recursive: true });
  const manifestPath = path.join(runDir, 'run_manifest.json');
  const manifestJson = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, manifestJson, 'utf-8');
  await writeFile(path.join(runDir, 'manifest.json'), manifestJson, 'utf-8');
  return manifestPath;
}
