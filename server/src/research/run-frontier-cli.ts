import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SequentialGameRunner } from './SequentialGameRunner.js';
import { PaperDataCollector } from './PaperDataCollector.js';
import type { BatchConfig, PaperCollectionOptions } from './types.js';

type FrontierConfig = {
  paperAngle?: string;
  matchups: Array<{
    white: string;
    black: string;
    games: number;
    label?: string;
  }>;
  seed?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  contextPolicy?: string;
  stockfishEvalDepth?: number;
  blunderThresholdCp?: number;
};

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function loadJson<T>(p: string): Promise<T> {
  const raw = await readFile(p, 'utf-8');
  return JSON.parse(raw) as T;
}

async function main() {
  const baseConfigPath = path.resolve(process.cwd(), '../research/configs/batch_config_ollama_quick_test.json');
  const frontierPath = path.resolve(process.cwd(), '../research/configs/frontier_capability.json');

  const baseConfig = await loadJson<BatchConfig>(baseConfigPath);
  const frontier = await loadJson<FrontierConfig>(frontierPath);

  const runId = `frontier-run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runRoot = path.resolve(process.cwd(), '../research/archive', runId);
  await mkdir(runRoot, { recursive: true });

  const runner = new SequentialGameRunner(process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434');
  const summaries: any[] = [];

  for (const matchup of frontier.matchups) {
    const label = sanitizeLabel(matchup.label || `${matchup.white}_vs_${matchup.black}`);
    const matchupDir = path.join(runRoot, label);
    await mkdir(matchupDir, { recursive: true });

    const config: BatchConfig = {
      ...baseConfig,
      games: matchup.games,
      outputDir: path.join(matchupDir, 'raw'),
      models: {
        white: matchup.white,
        black: matchup.black
      },
      settings: {
        ...baseConfig.settings,
        stockfishEvalDepth: frontier.stockfishEvalDepth ?? baseConfig.settings.stockfishEvalDepth,
        blunderThresholdCp: frontier.blunderThresholdCp ?? baseConfig.settings.blunderThresholdCp
      }
    };

    const options: PaperCollectionOptions = {
      enabled: true,
      trackReasoning: true,
      trackConfidence: true
    };

    const collector = new PaperDataCollector(matchup.white, matchup.black, {
      blunderThresholdCpl: config.settings.blunderThresholdCp,
      stockfishEvalDepth: config.settings.stockfishEvalDepth,
      stockfishEngine: 'stockfish-17.1-lite',
      runManifestRef: 'run_manifest.json'
    });

    console.log(`Starting ${label}: ${matchup.games} games (${matchup.white} vs ${matchup.black})`);
    const runResult = await runner.runPaperBatch(config, options, {
      onDatapoint: (p) => collector.addDatapoint(p),
      onGameComplete: (g) => collector.addGameSummary(g)
    });

    const artifacts = await collector.generatePaperArtifacts(matchupDir);
    console.log(`Finished ${label}`);
    console.log(`  Output JSON: ${runResult.outputFile}`);
    console.log(`  Artifacts dir: ${matchupDir}`);

    summaries.push({
      label,
      whiteModel: matchup.white,
      blackModel: matchup.black,
      games: matchup.games,
      runOutputFile: runResult.outputFile,
      artifacts: {
        stats: artifacts.statsSummary,
        files: artifacts
      }
    });
  }

  await writeFile(path.join(runRoot, 'summary.json'), JSON.stringify({ runId, matchups: summaries }, null, 2));
  console.log(`✅ Frontier run complete. Summary -> ${path.join(runRoot, 'summary.json')}`);
}

main().catch((err) => {
  console.error('Frontier run failed:', err);
  process.exitCode = 1;
});
