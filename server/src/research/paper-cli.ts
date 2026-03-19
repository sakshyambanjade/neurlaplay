import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
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

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function main() {
  // Allow an explicit config path; default to paper_capability_3model.json if provided.
  const configArg = getArgValue('--config');
  const configPath = configArg
    ? path.resolve(process.cwd(), configArg)
    : path.resolve(process.cwd(), '../research/configs/batch_config_ollama_quick_test.json');
  const raw = await readFile(configPath, 'utf-8');
  const baseConfig = JSON.parse(raw) as BatchConfig & {
    matchups?: Array<{ white: string; black: string; games: number; label?: string }>;
  };

  // If matchups present, run them all; otherwise fall back to single CLI args.
  const matchups =
    baseConfig.matchups && baseConfig.matchups.length > 0
      ? baseConfig.matchups
      : [
          {
            white: parseArgString('--white', 'tinyllama:latest'),
            black: parseArgString('--black', 'phi3:latest'),
            games: parseArgNumber('--games', 50),
            label: undefined
          }
        ];

  const options: PaperCollectionOptions = {
    enabled: true,
    trackReasoning: true,
    trackConfidence: true
  };

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const runner = new SequentialGameRunner(baseUrl);
  const runId = `paper-run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const runRoot = path.resolve(process.cwd(), '../research/runs', runId);
  await mkdir(runRoot, { recursive: true });

  for (const m of matchups) {
    const label = sanitizeLabel(m.label || `${m.white}_vs_${m.black}`);
    const outDir = path.join(runRoot, label);
    await mkdir(outDir, { recursive: true });

    const config: BatchConfig = {
      ...baseConfig,
      games: m.games,
      outputDir: outDir,
      models: { white: m.white, black: m.black },
      settings: {
        ...baseConfig.settings
      }
    };

    console.log(`PAPER MODE: ${config.games} games ${m.white} vs ${m.black}`);

    const collector = new PaperDataCollector(m.white, m.black, {
      blunderThresholdCpl: config.settings.blunderThresholdCp,
      stockfishEvalDepth: config.settings.stockfishEvalDepth,
      stockfishEngine: 'stockfish-17.1-lite',
      runManifestRef: 'run_manifest.json'
    });

    const runResult = await runner.runPaperBatch(config, options, {
      onDatapoint: (point) => collector.addDatapoint(point),
      onGameComplete: (game) => collector.addGameSummary(game)
    });

    const artifacts = await collector.generatePaperArtifacts(outDir);

    console.log('Paper run complete.');
    console.log(`Output file: ${runResult.outputFile}`);
    console.log(`PGN file: ${artifacts.pgnFile}`);
    console.log(`Datapoints: ${artifacts.datapointsFile}`);
    console.log('Stats summary:');
    console.log(JSON.stringify(artifacts.statsSummary, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error('Paper run failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
