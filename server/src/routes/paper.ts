import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { 
  startPaperRun, 
  getRunStatus, 
  getArtifacts,
  jobEmitter,
  type PaperRunConfig,
  type MatchupConfig 
} from '../research/PaperPipeline.js';
import { SequentialGameRunner } from '../research/SequentialGameRunner.js';
import type { BatchConfig, PaperCollectionOptions } from '../research/types.js';

type ProgressMap = Record<string, number>;

function matchupKey(white: string, black: string): string {
  return `${white}__vs__${black}`;
}

function collectCompletedGamesByMatchup(): ProgressMap {
  const result: ProgressMap = {};
  const candidateRunDirs = [
    path.resolve(process.cwd(), '../research/runs'),
    path.resolve(process.cwd(), 'research/runs'),
    path.resolve('research/runs')
  ];

  const runRoot = candidateRunDirs.find((d) => fs.existsSync(d));
  if (!runRoot) {
    return result;
  }

  const runDirs = fs.readdirSync(runRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const runDirEntry of runDirs) {
    const rawDir = path.join(runRoot, runDirEntry.name, 'raw');
    if (!fs.existsSync(rawDir)) {
      continue;
    }

    const rawFiles = fs.readdirSync(rawDir).filter((f) => f.endsWith('.json'));
    for (const rawFile of rawFiles) {
      const fullPath = path.join(rawDir, rawFile);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as {
          games?: Array<{ whiteModel: string; blackModel: string }>;
        };

        for (const game of parsed.games ?? []) {
          const key = matchupKey(game.whiteModel, game.blackModel);
          result[key] = (result[key] ?? 0) + 1;
        }
      } catch {
        // Ignore malformed partial files and continue scanning.
      }
    }
  }

  return result;
}

export function createPaperRouter(ollamaBaseUrl: string, io?: SocketIOServer) {
  const router = Router();
  const gameRunner = new SequentialGameRunner(ollamaBaseUrl);

  // Bridge pipeline emitter events into Socket.IO so the UI gets live status/log updates.
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
    (io as any).__paperBridgeRegistered = true;
  }

  router.post('/run', async (req, res) => {
    try {
      const body = req.body as Partial<PaperRunConfig>;
      const config: PaperRunConfig = {
        ...body,
        paperAngle: body.paperAngle ?? 'option_a_tension'
      } as PaperRunConfig;

      if (config.paperAngle !== 'option_a_tension' && config.paperAngle !== 'option_b_capability') {
        res.status(400).json({ error: 'paperAngle must be option_a_tension or option_b_capability' });
        return;
      }

      const runId = `paper-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const runStartedAtMs = Date.now();
      const totalGamesInRun = config.matchups.reduce((sum, m) => sum + m.games, 0);
      let completedGamesInRun = 0;
      
      // Game batch function that integrates with SequentialGameRunner
      const runBatchFn = async (matchup: MatchupConfig, runDir: string, cfg: PaperRunConfig): Promise<string> => {
        // Convert matchup to BatchConfig format
        const batchConfig: BatchConfig = {
          games: matchup.games,
          models: {
            white: matchup.white,
            black: matchup.black
          },
          outputDir: path.join(runDir, 'raw'),
          settings: {
            maxMoves: 120, // 120 moves max - most games end by move 80
            moveTimeoutMs: 5000, // 5s - Ryzen 5 4600H can do TinyLlama in 1-2s
            gameTimeoutMs: 180000, // 3 min per game
            moveDelayMs: 0, // ZERO delays - full throttle!
            interGameDelayMs: 0, // No waiting between games
            exportInterval: 1, // Save EVERY game immediately (crash-safe)
            stockfishEvalDepth: cfg.stockfishEvalDepth,
            blunderThresholdCp: cfg.blunderThresholdCp
          }
        };

        const collectionOptions: PaperCollectionOptions = {
          enabled: true,
          trackReasoning: true,
          trackConfidence: true
        };

        // Emit initial game start
        io?.to(runId).emit('game:start', {
          gameInfo: {
            white: matchup.white,
            black: matchup.black,
            moveNumber: 0,
            gameNum: 1,
            totalGames: matchup.games
          }
        });

        // Run games with live per-move updates.
        let currentGameNum = 0;
        let illegalSuggestions = 0;
        let correctionsApplied = 0;
        const result = await gameRunner.runPaperBatch(batchConfig, collectionOptions, {
          onGameComplete: (summary) => {
            currentGameNum++;
            completedGamesInRun++;

            const elapsedSec = Math.max(1, Math.floor((Date.now() - runStartedAtMs) / 1000));
            const gamesPerHour = (completedGamesInRun / elapsedSec) * 3600;
            const remainingGames = Math.max(0, totalGamesInRun - completedGamesInRun);
            const etaSec = gamesPerHour > 0 ? Math.round((remainingGames / gamesPerHour) * 3600) : null;

            io?.to(runId).emit('paper:eta', {
              completedGames: completedGamesInRun,
              totalGames: totalGamesInRun,
              gamesPerHour,
              etaSec
            });

            io?.to(runId).emit('game:complete', {
              gameInfo: {
                white: matchup.white,
                black: matchup.black,
                gameNum: currentGameNum,
                totalGames: matchup.games
              },
              result: summary.result,
              termination: summary.termination,
              moveCount: summary.moveCount
            });

            setTimeout(() => {
              io?.to(runId).emit('game:start', {
                gameInfo: {
                  white: matchup.white,
                  black: matchup.black,
                  moveNumber: 0,
                  gameNum: currentGameNum + 1,
                  totalGames: matchup.games
                },
                quality: {
                  illegalSuggestions,
                  correctionsApplied
                }
              });
            }, 100);
          },
          onDatapoint: (data) => {
            if (data.illegalSuggestion) {
              illegalSuggestions += 1;
            }
            if (data.correctionApplied) {
              correctionsApplied += 1;
            }

            if (data.fenAfter) {
              io?.to(runId).emit('game:move', {
                fen: data.fenAfter,
                move: data.move,
                side: data.side,
                model: data.model,
                gameInfo: {
                  white: matchup.white,
                  black: matchup.black,
                  moveNumber: data.moveNumber,
                  gameNum: currentGameNum + 1,
                  totalGames: matchup.games
                },
                quality: {
                  illegalSuggestion: data.illegalSuggestion,
                  correctionApplied: data.correctionApplied,
                  illegalSuggestions,
                  correctionsApplied
                }
              });
            }
          }
        });

        // Extract PGNs and write to file
        const pgnPath = path.join(runDir, `${matchup.label.replace(/\s+/g, '_')}.pgn`);
        const pgnContent = result.games.map(g => g.pgn).join('\n\n');
        fs.writeFileSync(pgnPath, pgnContent);
        
        return pgnPath;
      };

      // Start the pipeline (non-blocking)
      void startPaperRun(runId, config, runBatchFn);
      
      res.json({ runId });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.post('/reset', (_req, res) => {
    try {
      const candidateRunDirs = [
        path.resolve(process.cwd(), '../research/runs'),
        path.resolve(process.cwd(), 'research/runs'),
        path.resolve('research/runs')
      ];

      for (const dir of candidateRunDirs) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
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

  router.get('/run/:runId/status', (req, res) => {
    const status = getRunStatus(req.params.runId);
    if (!status) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(status);
  });

  router.get('/run/:runId/artifacts', async (req, res) => {
    try {
      const artifacts = getArtifacts(req.params.runId);
      if (!artifacts) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      res.json(artifacts);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
