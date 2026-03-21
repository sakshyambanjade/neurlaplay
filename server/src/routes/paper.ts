import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import fs from 'node:fs';
import path from 'node:path';
import { validateRunConfig } from '../config/schema.js';
import {
  startPaperRun,
  getRunStatus,
  getArtifacts,
  jobEmitter,
  resumePaperRun
} from '../research/PaperPipeline.js';
import { getPaperConfigsRoot, getPaperRunsRoot } from '../research/PaperPaths.js';
import { getRunStatusFromStore, listIncompleteRunsFromStore } from '../research/SupabaseRunStore.js';

type PaperPresetKind = 'main' | 'pilot';

function paperConfigPath(kind: PaperPresetKind): string {
  const configsRoot = getPaperConfigsRoot();
  return path.join(
    configsRoot,
    kind === 'main' ? 'main/main_1200_games.json' : 'pilot/pilot_300_games.json'
  );
}

function loadPaperPreset(kind: PaperPresetKind) {
  const configPath = paperConfigPath(kind);
  const raw = fs.readFileSync(configPath, 'utf8');
  return validateRunConfig(JSON.parse(raw));
}


function getIncompleteRunsFromFs(): Array<{
  runId: string;
  startedAt: string;
  step: string;
  progress: number;
  total: number;
}> {
  const paperRunsRoot = getPaperRunsRoot();
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

async function getCurrentIncompleteRuns() {
  const storeRuns = await listIncompleteRunsFromStore();
  return storeRuns.length > 0 ? storeRuns : getIncompleteRunsFromFs();
}

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

  router.post('/run/main', async (_req, res) => {
    try {
      const incompleteRuns = await getCurrentIncompleteRuns();
      if (incompleteRuns.length > 0) {
        res.status(409).json({
          error: 'An unfinished run already exists. Resume the latest run instead of starting a new one.',
          runId: incompleteRuns[0]!.runId
        });
        return;
      }
      const acceptedConfig = loadPaperPreset('main');
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

  router.post('/run/pilot', async (_req, res) => {
    try {
      const incompleteRuns = await getCurrentIncompleteRuns();
      if (incompleteRuns.length > 0) {
        res.status(409).json({
          error: 'An unfinished run already exists. Resume the latest run instead of starting a new one.',
          runId: incompleteRuns[0]!.runId
        });
        return;
      }
      const acceptedConfig = loadPaperPreset('pilot');

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

  router.get('/incomplete', async (_req, res) => {
    const runs = await getCurrentIncompleteRuns();
    res.json({
      runs
    });
  });

  router.get('/status/:runId', async (req, res) => {
    const status = getRunStatus(req.params.runId) ?? (await getRunStatusFromStore(req.params.runId));
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
