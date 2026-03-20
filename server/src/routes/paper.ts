import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import fs from 'node:fs';
import path from 'node:path';
import { validateRunConfig } from '../config/schema.js';
import { findExperimentPreset, getExperimentRegistry } from '../research/ExperimentRegistry.js';
import {
  startPaperRun,
  getRunStatus,
  getArtifacts,
  jobEmitter,
  resumePaperRun
} from '../research/PaperPipeline.js';

type ProgressMap = Record<string, number>;

function matchupKey(white: string, black: string): string {
  return `${white}__vs__${black}`;
}

function collectCompletedGamesByMatchup(): ProgressMap {
  const result: ProgressMap = {};
  const paperRunsRoot = path.resolve(process.cwd(), '../paper/runs');
  if (!fs.existsSync(paperRunsRoot)) {
    return result;
  }

  for (const runDirEntry of fs.readdirSync(paperRunsRoot, { withFileTypes: true })) {
    if (!runDirEntry.isDirectory()) {
      continue;
    }

    const runDir = path.join(paperRunsRoot, runDirEntry.name);
    for (const matchupDirEntry of fs.readdirSync(runDir, { withFileTypes: true })) {
      if (!matchupDirEntry.isDirectory()) {
        continue;
      }
      const statsPath = path.join(runDir, matchupDirEntry.name, 'paper-stats.json');
      const liveGamesPath = path.join(runDir, matchupDirEntry.name, 'paper-games.live.jsonl');
      if (!fs.existsSync(statsPath)) {
        if (!fs.existsSync(liveGamesPath)) {
          continue;
        }
      }

      try {
        if (fs.existsSync(statsPath)) {
          const parsed = JSON.parse(fs.readFileSync(statsPath, 'utf8')) as {
            stats?: {
              whiteModel: string;
              blackModel: string;
              totalGames: number;
            };
          };
          if (!parsed.stats) {
            continue;
          }

          const key = matchupKey(parsed.stats.whiteModel, parsed.stats.blackModel);
          result[key] = Math.max(result[key] ?? 0, parsed.stats.totalGames);
          continue;
        }

        const acceptedConfigPath = path.join(runDir, 'accepted-config.json');
        const acceptedConfig = fs.existsSync(acceptedConfigPath)
          ? (JSON.parse(fs.readFileSync(acceptedConfigPath, 'utf8')) as {
              matchups?: Array<{ white: string; black: string; label: string }>;
            })
          : null;
        const matchup = acceptedConfig?.matchups?.find((entry) => entry.label.replace(/[^a-zA-Z0-9._-]+/g, '_') === matchupDirEntry.name);
        if (!matchup) {
          continue;
        }

        const completed = fs
          .readFileSync(liveGamesPath, 'utf8')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean).length;
        const key = matchupKey(matchup.white, matchup.black);
        result[key] = Math.max(result[key] ?? 0, completed);
      } catch {
        // Ignore malformed partial files.
      }
    }
  }

  return result;
}

function getIncompleteRuns(): Array<{
  runId: string;
  startedAt: string;
  step: string;
  progress: number;
  total: number;
}> {
  const paperRunsRoot = path.resolve(process.cwd(), '../paper/runs');
  if (!fs.existsSync(paperRunsRoot)) {
    return [];
  }

  return fs
    .readdirSync(paperRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const statusPath = path.join(paperRunsRoot, entry.name, 'status.json');
      if (!fs.existsSync(statusPath)) {
        return null;
      }

      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8')) as {
        runId: string;
        startedAt: string;
        step: string;
        progress: number;
        total: number;
        done: boolean;
      };
      if (status.done) {
        return null;
      }

      return {
        runId: status.runId,
        startedAt: status.startedAt,
        step: status.step,
        progress: status.progress,
        total: status.total
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b!.startedAt).localeCompare(String(a!.startedAt))) as Array<{
    runId: string;
    startedAt: string;
    step: string;
    progress: number;
    total: number;
  }>;
}

const DEFAULT_RUN_CONFIG = {
  paperAngle: 'option_b_capability',
  mode: 'constrained_index',
  matchups: [
    {
      white: 'groq:llama-3.1-8b-instant',
      black: 'groq:llama-3.1-8b-instant',
      games: 20,
      label: 'llama31_8b_mirror'
    }
  ],
  seed: 42,
  temperature: 0,
  topP: 1,
  maxTokens: 8,
  contextPolicy: 'fen_only',
  stockfishEvalDepth: 8,
  blunderThresholdCp: 200,
  settings: {
    maxMoves: 120,
    moveTimeoutMs: 10000,
    gameTimeoutMs: 3600000,
    moveDelayMs: 100,
    interGameDelayMs: 100,
    exportInterval: 1,
    seed: 42,
    openingRandomMoves: 4,
    retryCount: 1,
    fallbackPolicy: 'deterministic_first'
  },
  logging: {
    logEveryMove: true,
    schemaVersion: 'paper-run-v2'
  }
} as const;

export function createPaperRouter(ollamaBaseUrl: string, io?: SocketIOServer) {
  const router = Router();

  if (io && !(io as any).__paperBridgeRegistered) {
    jobEmitter.on('paper:status', (payload: any) => {
      io.to(payload.runId).emit('paper:status', payload);
    });
    jobEmitter.on('paper:log', (payload: any) => {
      io.to(payload.runId).emit('paper:log', payload.msg ?? payload);
    });
    jobEmitter.on('paper:done', (payload: any) => {
      io.to(payload.runId).emit('paper:done', payload);
    });
    jobEmitter.on('paper:eta', (payload: any) => {
      io.to(payload.runId).emit('paper:eta', payload);
    });
    jobEmitter.on('paper:health', (payload: any) => {
      io.to(payload.runId).emit('paper:health', payload);
    });
    jobEmitter.on('paper:accepted_config', (payload: any) => {
      io.to(payload.runId).emit('paper:accepted_config', payload);
    });
    jobEmitter.on('game:start', (payload: any) => {
      io.to(payload.runId).emit('game:start', payload);
    });
    jobEmitter.on('game:move', (payload: any) => {
      io.to(payload.runId).emit('game:move', payload);
    });
    jobEmitter.on('game:complete', (payload: any) => {
      io.to(payload.runId).emit('game:complete', payload);
    });
    (io as any).__paperBridgeRegistered = true;
  }

  router.get('/config/default', (_req, res) => {
    res.json({ config: DEFAULT_RUN_CONFIG });
  });

  router.get('/presets', (_req, res) => {
    const presets = getExperimentRegistry().map((preset) => ({
      id: preset.id,
      name: preset.name,
      category: preset.category
    }));
    res.json({ presets });
  });

  router.get('/config/preset', (req, res) => {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const preset = findExperimentPreset(id);
    if (!preset) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    const raw = fs.readFileSync(preset.path, 'utf8');
    res.json({
      preset: {
        id: preset.id,
        name: preset.name,
        category: preset.category
      },
      config: JSON.parse(raw)
    });
  });

  router.post('/run', async (req, res) => {
    try {
      const acceptedConfig = validateRunConfig(
        req.body && Object.keys(req.body).length > 0 ? req.body : DEFAULT_RUN_CONFIG
      );

      const { runId, promise } = startPaperRun(acceptedConfig, { ollamaBaseUrl });
      void promise.catch(() => {
        // status/log emission already handled inside the pipeline
      });

      res.json({
        runId,
        acceptedConfig
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.post('/reset', (_req, res) => {
    try {
      const paperRunsDir = path.resolve(process.cwd(), '../paper/runs');
      if (fs.existsSync(paperRunsDir)) {
        fs.rmSync(paperRunsDir, { recursive: true, force: true });
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.get('/progress', (_req, res) => {
    try {
      res.json({ completedByMatchup: collectCompletedGamesByMatchup() });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.get('/incomplete', (_req, res) => {
    res.json({
      runs: getIncompleteRuns()
    });
  });

  router.get('/status/:runId', (req, res) => {
    const status = getRunStatus(req.params.runId);
    if (!status) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(status);
  });

  router.get('/run/:runId/status', (req, res) => {
    const status = getRunStatus(req.params.runId);
    if (!status) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(status);
  });

  router.get('/artifacts/:runId', async (req, res) => {
    try {
      res.json(await getArtifacts(req.params.runId));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.get('/run/:runId/artifacts', async (req, res) => {
    try {
      res.json(await getArtifacts(req.params.runId));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.post('/resume/:runId', async (req, res) => {
    try {
      res.json(await resumePaperRun(req.params.runId, { ollamaBaseUrl }));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
