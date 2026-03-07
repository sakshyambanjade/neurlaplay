import { readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { PaperDataCollector } from './PaperDataCollector.js';
import { SequentialGameRunner } from './SequentialGameRunner.js';
import type { BatchConfig, PaperCollectionOptions } from './types.js';

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

function parseArgNumber(name: string, defaultValue: number): number {
  const raw = getArgValue(name);
  if (!raw) {
    return defaultValue;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }
  return Math.floor(value);
}

function parseArgString(name: string, defaultValue: string): string {
  const raw = getArgValue(name);
  if (!raw) {
    return defaultValue;
  }
  const value = raw.trim();
  return value ? value : defaultValue;
}

async function main() {
  const games = parseArgNumber('--games', 50);
  const whiteModel = parseArgString('--white', 'tinyllama:latest');
  const blackModel = parseArgString('--black', 'phi3:latest');

  const configPath = path.resolve(process.cwd(), '../research/configs/batch_config_ollama_quick_test.json');
  const raw = await readFile(configPath, 'utf-8');
  const baseConfig = JSON.parse(raw) as BatchConfig;

  const config: BatchConfig = {
    ...baseConfig,
    games,
    models: {
      white: whiteModel,
      black: blackModel
    }
  };

  const options: PaperCollectionOptions = {
    enabled: true,
    trackReasoning: true,
    trackConfidence: true
  };

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const runner = new SequentialGameRunner(baseUrl);
  const collector = new PaperDataCollector(whiteModel, blackModel, {
    blunderThresholdCpl: config.settings.blunderThresholdCp,
    stockfishEvalDepth: config.settings.stockfishEvalDepth,
    stockfishEngine: 'stockfish-17.1-lite',
    runManifestRef: 'run_manifest.json'
  });

  console.log(`PAPER MODE: ${games} games ${whiteModel} vs ${blackModel}`);

  const runResult = await runner.runPaperBatch(config, options, {
    onDatapoint: (point) => collector.addDatapoint(point),
    onGameComplete: (game) => collector.addGameSummary(game)
  });

  const artifacts = await collector.generatePaperArtifacts(path.resolve(process.cwd(), '../research'));

  console.log('Paper run complete.');
  console.log(`Output file: ${runResult.outputFile}`);
  console.log(`PGN file: ${artifacts.pgnFile}`);
  console.log(`Datapoints: ${artifacts.datapointsFile}`);
  console.log('Stats summary:');
  console.log(JSON.stringify(artifacts.statsSummary, null, 2));
}

main().catch((error: unknown) => {
  console.error('Paper run failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
