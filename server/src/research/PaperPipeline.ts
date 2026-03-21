import { EventEmitter } from 'node:events';
import { appendFile, mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { validateRunConfig, runConfigToBatchConfig } from '../config/schema.js';
import { createRunManifest, writeRunManifest } from './RunManifest.js';
import { runPreflightChecks } from './Preflight.js';
import { resumeRunIfPossible } from './ResumeManager.js';
import { packageArtifacts } from './ArtifactPackager.js';
import { GameRunner } from './runner/GameRunner.js';
import { PaperDataCollector } from './PaperDataCollector.js';
import { evaluateRunHealth } from './HealthMonitor.js';
import { aggregateRunStats } from './analysis/AggregateRunStats.js';
import { computePaperMetrics } from './analysis/ComputePaperMetrics.js';
import { buildFiguresData } from './analysis/BuildFiguresData.js';
import { getPaperRunsRoot } from './PaperPaths.js';
import { upsertMatchupRecord, upsertRunRecord } from './SupabaseRunStore.js';
import { sendRunNotification } from './NotificationService.js';
import type { GamePaperSummary, PaperDatapoint, PaperCollectionOptions } from './types.js';
import type {
  MatchupConfig,
  RunConfig,
  RunStatus
} from './types/run.js';
import type { PaperPipelineResult } from './types/paper.js';

export type PaperRunConfig = RunConfig;

export const jobEmitter = new EventEmitter();

const activeRuns = new Map<string, RunStatus>();
const activeRunPromises = new Map<string, Promise<PaperPipelineResult>>();

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function getRunDir(runId: string): string {
  return path.join(getPaperRunsRoot(), runId);
}

function getStatusPath(runId: string): string {
  return path.join(getRunDir(runId), 'status.json');
}

function emit(runId: string, event: string, data: Record<string, unknown>): void {
  jobEmitter.emit(event, { runId, ...data });
}

async function appendPipelineLog(runId: string, line: string): Promise<void> {
  const runDir = getRunDir(runId);
  await mkdir(runDir, { recursive: true });
  const logFile = path.join(runDir, 'pipeline.log');
  const payload = `[${new Date().toISOString()}] ${line}`;
  await appendFile(logFile, payload + '\n', 'utf-8');
  emit(runId, 'paper:log', { msg: payload });
}

async function saveStatus(
  status: RunStatus,
  extras?: {
    runDir?: string;
    acceptedConfig?: RunConfig;
    manifest?: Awaited<ReturnType<typeof createRunManifest>>;
    preflight?: Awaited<ReturnType<typeof runPreflightChecks>>;
    artifacts?: { files: string[]; zipPath: string | null };
  }
): Promise<void> {
  const runDir = getRunDir(status.runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(getStatusPath(status.runId), JSON.stringify(status, null, 2), 'utf-8');
  activeRuns.set(status.runId, status);
  await upsertRunRecord(status, {
    runDir: extras?.runDir,
    acceptedConfig: extras?.acceptedConfig,
    manifest: extras?.manifest,
    preflight: extras?.preflight,
    artifacts: extras?.artifacts
  });
  emit(status.runId, 'paper:status', status as unknown as Record<string, unknown>);
}

async function notifyRunStatus(
  status: RunStatus,
  runDir: string,
  artifactZipPath?: string | null
): Promise<void> {
  try {
    const sent = await sendRunNotification({
      status,
      runDir,
      artifactZipPath
    });
    if (sent) {
      await appendPipelineLog(status.runId, `Notification sent for run ${status.runId}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendPipelineLog(status.runId, `Notification failed: ${message}`);
  }
}

export function getRunStatus(runId: string): RunStatus | null {
  const inMemory = activeRuns.get(runId);
  if (inMemory) {
    return inMemory;
  }

  const statusPath = getStatusPath(runId);
  if (!fs.existsSync(statusPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(statusPath, 'utf8')) as RunStatus;
}

async function listFilesRecursive(root: string, base: string = root): Promise<string[]> {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath, base)));
    } else {
      files.push(path.relative(base, fullPath));
    }
  }
  return files.sort();
}

export async function getArtifacts(runId: string): Promise<{ files: string[]; zipPath: string | null }> {
  const runDir = getRunDir(runId);
  if (!fs.existsSync(runDir)) {
    return { files: [], zipPath: null };
  }

  const manifestPath = path.join(runDir, 'artifacts_manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as {
      files?: string[];
      zipPath?: string | null;
    };
    return {
      files: manifest.files ?? [],
      zipPath: manifest.zipPath ?? null
    };
  }

  return {
    files: await listFilesRecursive(runDir),
    zipPath: null
  };
}

async function mergeMatchupPgns(runDir: string): Promise<string | null> {
  const dirs = await readdir(runDir, { withFileTypes: true });
  const pgns: string[] = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      continue;
    }
    const pgnPath = path.join(runDir, dir.name, 'all-games.pgn');
    if (fs.existsSync(pgnPath)) {
      pgns.push(pgnPath);
    }
  }

  if (pgns.length === 0) {
    return null;
  }

  const mergedPath = path.join(runDir, 'all-games.pgn');
  const chunks: string[] = [];
  for (const pgn of pgns) {
    chunks.push((await readFile(pgn, 'utf-8')).trim());
  }
  await writeFile(mergedPath, chunks.filter(Boolean).join('\n\n'), 'utf-8');
  return mergedPath;
}

async function copySingleMatchupArtifactsToRoot(runDir: string, matchupLabel: string): Promise<void> {
  const matchupDir = path.join(runDir, matchupLabel);
  const candidates = [
    'paper-results.json',
    'paper-stats.json',
    'paper-datapoints.json',
    'raw-games.json',
    'paper-latex-table3.tex',
    'rule-audit-summary.json'
  ];

  for (const filename of candidates) {
    const source = path.join(matchupDir, filename);
    const target = path.join(runDir, filename);
    if (fs.existsSync(source)) {
      await copyFile(source, target);
    }
  }
}

function buildCollectionOptions(): PaperCollectionOptions {
  return {
    enabled: true,
    trackReasoning: true,
    trackConfidence: true
  };
}

function createInitialStatus(runId: string, config: RunConfig): RunStatus {
  return {
    runId,
    step: 'initializing',
    progress: 0,
    total: config.matchups.reduce((sum, matchup) => sum + matchup.games, 0),
    done: false,
    startedAt: new Date().toISOString()
  };
}

type MatchupRunArtifacts = {
  label: string;
  dir: string;
  outputFile: string;
  statsPath: string;
  resultsPath: string;
  datapointsPath: string;
  pgnPath: string;
  completedGames: number;
};

async function appendJsonl<T>(filePath: string, entry: T): Promise<void> {
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = await readFile(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function runMatchup(
  runId: string,
  runDir: string,
  config: RunConfig,
  matchup: MatchupConfig,
  ollamaBaseUrl: string,
  totalGames: number,
  completedGamesSoFar: number,
  onCompletedGame?: (completedGamesInMatchup: number) => Promise<void> | void
): Promise<MatchupRunArtifacts> {
  const matchupLabel = sanitizeLabel(matchup.label);
  const matchupDir = path.join(runDir, matchupLabel);
  await mkdir(matchupDir, { recursive: true });
  const liveDatapointsPath = path.join(matchupDir, 'paper-datapoints.live.jsonl');
  const liveGamesPath = path.join(matchupDir, 'paper-games.live.jsonl');

  const restoredDatapoints = await readJsonl<PaperDatapoint>(liveDatapointsPath);
  const restoredGames = await readJsonl<GamePaperSummary>(liveGamesPath);

  const runner = new GameRunner(ollamaBaseUrl);
  runner.setRunDirectory(matchupDir);

  const batchConfig = runConfigToBatchConfig(config, matchup, matchupDir);
  batchConfig.resumeFromGameIndex = restoredGames.length;
  const collector = new PaperDataCollector(matchup.white, matchup.black, {
    blunderThresholdCpl: config.blunderThresholdCp,
    stockfishEvalDepth: config.stockfishEvalDepth,
    stockfishEngine: 'stockfish-17.1-lite',
    runManifestRef: '../run_manifest.json'
  });
  collector.hydrate(restoredDatapoints, restoredGames);

  let currentGameNum = restoredGames.length;
  let illegalSuggestions = restoredDatapoints.filter((point) => point.illegalSuggestion).length;
  let correctionsApplied = restoredDatapoints.filter((point) => point.correctionApplied).length;
  let repeatStateMoves = restoredDatapoints.filter((point) => point.recreatesPriorFen).length;
  let oscillationRejectedCount = restoredDatapoints.filter((point) => point.oscillationRejected).length;
  let oscillationOverrideCount = restoredDatapoints.filter((point) => point.oscillationOverrideUsed).length;
  const runStartedAt = Date.now();

  if (restoredGames.length > 0) {
    await appendPipelineLog(
      runId,
      `Resuming ${matchup.label} from game ${restoredGames.length + 1} of ${matchup.games}.`
    );
  }

  let outputFile = path.join(matchupDir, 'paper-research-match-resumed.json');
  if (restoredGames.length < matchup.games) {
    emit(runId, 'game:start', {
      gameInfo: {
        white: matchup.white,
        black: matchup.black,
        moveNumber: 0,
        gameNum: restoredGames.length + 1,
        totalGames: matchup.games
      },
      quality: {
        illegalSuggestions,
        correctionsApplied,
        repeatStateMoves,
        oscillationRejected: oscillationRejectedCount,
        oscillationOverrides: oscillationOverrideCount
      }
    });

    const result = await runner.runPaperMatchup(batchConfig, buildCollectionOptions(), {
      onDatapoint: (point: PaperDatapoint) => {
        collector.addDatapoint(point);
        void appendJsonl(liveDatapointsPath, point);
        if (point.illegalSuggestion) {
          illegalSuggestions += 1;
        }
        if (point.correctionApplied) {
          correctionsApplied += 1;
        }
        if (point.recreatesPriorFen) {
          repeatStateMoves += 1;
        }
        if (point.oscillationRejected) {
          oscillationRejectedCount += 1;
        }
        if (point.oscillationOverrideUsed) {
          oscillationOverrideCount += 1;
        }

        emit(runId, 'game:move', {
          fen: point.fenAfter,
          move: point.move,
          side: point.side,
          model: point.model,
          gameInfo: {
            white: matchup.white,
            black: matchup.black,
            moveNumber: point.moveNumber,
            gameNum: currentGameNum + 1,
            totalGames: matchup.games
          },
          quality: {
            illegalSuggestion: point.illegalSuggestion,
            correctionApplied: point.correctionApplied,
            illegalSuggestions,
            correctionsApplied,
            repeatStateMoves,
            oscillationRejected: oscillationRejectedCount,
            oscillationOverrides: oscillationOverrideCount
          }
        });
      },
      onGameComplete: (summary: GamePaperSummary) => {
        collector.addGameSummary(summary);
        void appendJsonl(liveGamesPath, summary);
        currentGameNum += 1;
        void onCompletedGame?.(currentGameNum);

        const datapointsSnapshot = collector.getDatapointsSnapshot();
        const gameSnapshot = collector.getGameSummariesSnapshot();
        const health = evaluateRunHealth({
          totalMoves: datapointsSnapshot.length,
          fallbackMoves: gameSnapshot.reduce((sum, game) => sum + game.ruleAudit.fallbackMovesUsed, 0),
          retryAttempts: gameSnapshot.reduce((sum, game) => sum + (game.ruleAudit.retryAttempts ?? 0), 0),
          retrySuccesses: gameSnapshot.reduce((sum, game) => sum + (game.ruleAudit.retrySuccesses ?? 0), 0),
          repeatStateMoves: gameSnapshot.reduce((sum, game) => sum + (game.repeatStateCount ?? 0), 0),
          oscillationRejectedCount: gameSnapshot.reduce(
            (sum, game) => sum + (game.ruleAudit.oscillationRejectedCount ?? 0),
            0
          ),
          collapseDetectedGames: gameSnapshot.filter((game) => game.collapseDetected).length,
          noProgressMaxStreak: gameSnapshot.reduce(
            (max, game) => Math.max(max, game.noProgressMaxStreak ?? 0),
            0
          )
        });
        const healthPayload = {
          matchupLabel,
          totalMoves: datapointsSnapshot.length,
          completedGames: currentGameNum,
          fallbackMoves: gameSnapshot.reduce((sum, game) => sum + game.ruleAudit.fallbackMovesUsed, 0),
          repeatStateMoves: gameSnapshot.reduce((sum, game) => sum + (game.repeatStateCount ?? 0), 0),
          oscillationRejectedCount: gameSnapshot.reduce(
            (sum, game) => sum + (game.ruleAudit.oscillationRejectedCount ?? 0),
            0
          ),
          collapseDetectedGames: gameSnapshot.filter((game) => game.collapseDetected).length,
          noProgressMaxStreak: gameSnapshot.reduce(
            (max, game) => Math.max(max, game.noProgressMaxStreak ?? 0),
            0
          ),
          ok: health.ok,
          warnings: health.warnings
        };
        void writeFile(path.join(matchupDir, 'health.json'), JSON.stringify(healthPayload, null, 2), 'utf-8');
        emit(runId, 'paper:health', healthPayload);

        const completedGames = completedGamesSoFar + currentGameNum;
        const elapsedSec = Math.max(1, Math.floor((Date.now() - runStartedAt) / 1000));
        const gamesPerHour = (completedGames / elapsedSec) * 3600;
        const remainingGames = Math.max(0, totalGames - completedGames);
        const etaSec = gamesPerHour > 0 ? Math.round((remainingGames / gamesPerHour) * 3600) : null;

        emit(runId, 'paper:eta', {
          completedGames,
          totalGames,
          gamesPerHour,
          etaSec
        });

        emit(runId, 'game:complete', {
          gameInfo: {
            white: matchup.white,
            black: matchup.black,
            gameNum: currentGameNum,
            totalGames: matchup.games
          },
          result: summary.result,
          termination: summary.termination,
          moveCount: summary.moveCount,
          collapseDetected: summary.collapseDetected,
          collapseReason: summary.collapseReason
        });
      }
    });
    outputFile = result.outputFile;
  }

  await appendPipelineLog(
    runId,
    `Finalizing ${matchup.label}: post-run CPL ${config.settings.enablePostRunCpl === false ? 'disabled' : 'enabled'}.`
  );
  await collector.generatePaperArtifacts(matchupDir, {
    enablePostRunCpl: config.settings.enablePostRunCpl ?? true
  });
  await upsertMatchupRecord({
    runId,
    matchup,
    matchupDir,
    completedGames: collector.getGameSummariesSnapshot().length,
    status: 'completed'
  });

  return {
    label: matchupLabel,
    dir: matchupDir,
    outputFile,
    statsPath: path.join(matchupDir, 'paper-stats.json'),
    resultsPath: path.join(matchupDir, 'paper-results.json'),
    datapointsPath: path.join(matchupDir, 'paper-datapoints.json'),
    pgnPath: path.join(matchupDir, 'all-games.pgn'),
    completedGames: collector.getGameSummariesSnapshot().length
  };
}

export async function runPaperPipeline(
  rawConfig: unknown,
  opts: { ollamaBaseUrl: string; runId?: string }
): Promise<PaperPipelineResult> {
  const config = validateRunConfig(rawConfig);
  if (config.mode === 'move_scoring') {
    throw new Error('move_scoring mode is scaffolded but not implemented yet.');
  }
  const runId = opts.runId ?? `paper-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const runDir = getRunDir(runId);
  await mkdir(runDir, { recursive: true });
  const resumeState = await resumeRunIfPossible(runDir);

  const status = createInitialStatus(runId, config);
  await saveStatus(status, { runDir, acceptedConfig: config });

  try {
    await writeFile(path.join(runDir, 'accepted-config.json'), JSON.stringify(config, null, 2), 'utf-8');
    emit(runId, 'paper:accepted_config', { config });

    const manifest = createRunManifest(runId, getGitCommit(), config);
    await writeRunManifest(runDir, manifest);
    await saveStatus(status, { runDir, acceptedConfig: config, manifest });
    await appendPipelineLog(runId, `Manifest written for ${runId}.`);

    const preflight = await runPreflightChecks(config, { runDir, ollamaBaseUrl: opts.ollamaBaseUrl });
    await writeFile(path.join(runDir, 'preflight.json'), JSON.stringify(preflight, null, 2), 'utf-8');
    await saveStatus(status, { runDir, acceptedConfig: config, manifest, preflight });
    if (!preflight.ok) {
      throw new Error(
        `Preflight failed: ${preflight.checks
          .filter((check) => !check.ok)
          .map((check) => `${check.name}=${check.detail}`)
          .join('; ')}`
      );
    }

    const totalGames = status.total;
    const artifacts: MatchupRunArtifacts[] = [];
    let completedGames = 0;
    const completedMatchupLabels = new Set(resumeState.completedMatchups.map((label) => sanitizeLabel(label)));

    for (const matchup of config.matchups) {
      if (completedMatchupLabels.has(sanitizeLabel(matchup.label))) {
        completedGames += matchup.games;
        await appendPipelineLog(runId, `Skipping completed matchup ${matchup.label}.`);
        continue;
      }

      status.step = `running:${matchup.label}`;
      status.progress = completedGames;
      await saveStatus(status, { runDir, acceptedConfig: config, manifest, preflight });
      await upsertMatchupRecord({
        runId,
        matchup,
        matchupDir: path.join(runDir, sanitizeLabel(matchup.label)),
        completedGames: 0,
        status: 'running'
      });
      await appendPipelineLog(
        runId,
        `Starting matchup ${matchup.label}: ${matchup.white} vs ${matchup.black} (${matchup.games} games).`
      );

      const matchupArtifacts = await runMatchup(
        runId,
        runDir,
        config,
        matchup,
        opts.ollamaBaseUrl,
        totalGames,
        completedGames,
        async (completedGamesInMatchup) => {
          status.step = `running:${matchup.label}`;
          status.progress = completedGames + completedGamesInMatchup;
          await saveStatus(status, { runDir, acceptedConfig: config, manifest, preflight });
          await upsertMatchupRecord({
            runId,
            matchup,
            matchupDir: path.join(runDir, sanitizeLabel(matchup.label)),
            completedGames: completedGamesInMatchup,
            status: 'running'
          });
        }
      );
      artifacts.push(matchupArtifacts);
      completedGames += matchupArtifacts.completedGames;

      status.step = `completed:${matchup.label}`;
      status.progress = completedGames;
      await saveStatus(status, { runDir, acceptedConfig: config, manifest, preflight });
    }

    if (artifacts.length === 1) {
      await copySingleMatchupArtifactsToRoot(runDir, artifacts[0]!.label);
    }

    await mergeMatchupPgns(runDir);
    const aggregated = await aggregateRunStats(runDir);
    const metrics = computePaperMetrics(aggregated);
    await writeFile(path.join(runDir, 'stats.json'), JSON.stringify(metrics, null, 2), 'utf-8');
    await buildFiguresData(runDir, aggregated, metrics);
    await writeFile(
      path.join(runDir, 'run_summary.json'),
      JSON.stringify(
        {
          runId,
          createdAt: new Date().toISOString(),
          acceptedConfigHash: manifest.acceptedConfigHash,
          totalGames,
          matchupCount: aggregated.matchupCount,
          matchups: aggregated.matchups.map((matchup) => ({
            label: matchup.label,
            whiteModel: matchup.whiteModel,
            blackModel: matchup.blackModel,
            totalGames: matchup.totalGames,
            fallbackRate: matchup.compliance.fallbackRate,
            avgCplOverall: matchup.avgCpl.overall
          })),
          metrics
        },
        null,
        2
      ),
      'utf-8'
    );

    const packaged = await packageArtifacts(runDir);
    await appendPipelineLog(runId, `Packaged ${packaged.files.length} artifacts.`);

    status.step = 'completed';
    status.progress = totalGames;
    status.done = true;
    status.finishedAt = new Date().toISOString();
    await saveStatus(status, {
      runDir,
      acceptedConfig: config,
      manifest,
      preflight,
      artifacts: packaged
    });
    emit(runId, 'paper:done', status as unknown as Record<string, unknown>);
    await notifyRunStatus(status, runDir, packaged.zipPath);

    return {
      runId,
      runDir,
      status,
      manifest,
      preflight,
      artifacts: {
        files: packaged.files,
        zipPath: packaged.zipPath
      }
    };
  } catch (error) {
    status.step = 'failed';
    status.done = true;
    status.error = error instanceof Error ? error.message : String(error);
    status.finishedAt = new Date().toISOString();
    await saveStatus(status, { runDir, acceptedConfig: config });
    await appendPipelineLog(runId, `Pipeline failed: ${status.error}`);
    emit(runId, 'paper:done', status as unknown as Record<string, unknown>);
    await notifyRunStatus(status, runDir, null);
    throw error;
  }
}

export function startPaperRun(
  rawConfig: unknown,
  opts: { ollamaBaseUrl: string; runId?: string }
): { runId: string; promise: Promise<PaperPipelineResult> } {
  const config = validateRunConfig(rawConfig);
  if (config.mode === 'move_scoring') {
    throw new Error('move_scoring mode is scaffolded but not implemented yet.');
  }
  const runId = opts.runId ?? `paper-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const existing = activeRunPromises.get(runId);
  if (existing) {
    return { runId, promise: existing };
  }
  const promise = runPaperPipeline(config, { ...opts, runId });
  activeRunPromises.set(runId, promise);
  void promise.finally(() => {
    activeRunPromises.delete(runId);
  });
  return { runId, promise };
}

export async function resumePaperRun(
  runId: string,
  opts: { ollamaBaseUrl: string }
): Promise<{
  runId: string;
  state: Awaited<ReturnType<typeof resumeRunIfPossible>>;
  restarted: boolean;
}> {
  const runDir = getRunDir(runId);
  const state = await resumeRunIfPossible(runDir);
  if (!state.exists || state.done) {
    return {
      runId,
      state,
      restarted: false
    };
  }

  const configPath = path.join(runDir, 'accepted-config.json');
  if (!fs.existsSync(configPath)) {
    return {
      runId,
      state,
      restarted: false
    };
  }

  const rawConfig = JSON.parse(await readFile(configPath, 'utf-8'));
  const { promise } = startPaperRun(rawConfig, { ollamaBaseUrl: opts.ollamaBaseUrl, runId });
  void promise.catch(() => {
    // status/log propagation already handled in the pipeline
  });

  return {
    runId,
    state,
    restarted: true
  };
}

export async function waitForRun(runId: string): Promise<PaperPipelineResult | null> {
  return activeRunPromises.get(runId) ?? null;
}
