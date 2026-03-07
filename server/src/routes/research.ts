import { Router } from 'express';
import type { Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { PaperDataCollector } from '../research/PaperDataCollector.js';
import { SequentialGameRunner } from '../research/SequentialGameRunner.js';
import type { BatchConfig, PaperCollectionOptions, PaperDatapoint } from '../research/types.js';

type StreamClient = {
  id: number;
  send: (event: string, payload: unknown) => void;
  close: () => void;
};

let streamClientCounter = 0;

function createSseClient(res: Response): StreamClient {
  const id = ++streamClientCounter;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return {
    id,
    send(event: string, payload: unknown) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
    close() {
      res.end();
    }
  };
}

export function createResearchRouter(ollamaBaseUrl: string, io?: SocketIOServer) {
  const router = Router();
  const runner = new SequentialGameRunner(ollamaBaseUrl);
  const streamClients = new Map<number, StreamClient>();

  const broadcast = (event: string, payload: unknown) => {
    for (const client of streamClients.values()) {
      client.send(event, payload);
    }
  };

  router.get('/stream', (_req, res) => {
    const client = createSseClient(res);
    streamClients.set(client.id, client);
    client.send('connected', { ok: true, clientId: client.id });

    const keepAlive = setInterval(() => {
      client.send('ping', { ts: Date.now() });
    }, 20000);

    res.on('close', () => {
      clearInterval(keepAlive);
      streamClients.delete(client.id);
    });
  });

  router.post('/quick', async (_req, res) => {
    try {
      const configPath = path.resolve(process.cwd(), '../research/configs/batch_config_ollama_quick_test.json');
      const raw = await readFile(configPath, 'utf-8');
      const config = JSON.parse(raw) as BatchConfig;
      const result = await runner.run(config);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.post('/batch-paper', async (req, res) => {
    try {
      const body = req.body as {
        totalGames?: number;
        whiteModel?: string;
        blackModel?: string;
        collect?: string[];
      };

      const totalGames = Math.max(1, Math.min(200, Number(body.totalGames ?? 50)));
      const whiteModel = String(body.whiteModel ?? 'tinyllama:latest');
      const blackModel = String(body.blackModel ?? 'phi3:latest');

      const configPath = path.resolve(process.cwd(), '../research/configs/batch_config_ollama_quick_test.json');
      const raw = await readFile(configPath, 'utf-8');
      const baseConfig = JSON.parse(raw) as BatchConfig;

      const config: BatchConfig = {
        ...baseConfig,
        games: totalGames,
        models: {
          white: whiteModel,
          black: blackModel
        },
        outputDir: baseConfig.outputDir ?? 'server/game-data'
      };

      const collectSet = new Set((body.collect ?? []).map((value) => value.toLowerCase()));
      const collectionOptions: PaperCollectionOptions = {
        enabled: collectSet.size === 0 || collectSet.has('cpl'),
        trackReasoning: collectSet.size === 0 || collectSet.has('reasoning'),
        trackConfidence: collectSet.size === 0 || collectSet.has('confidence')
      };

      const paperOutputDir = path.resolve(process.cwd(), '../research');
      const collector = new PaperDataCollector(whiteModel, blackModel, {
        blunderThresholdCpl: config.settings.blunderThresholdCp,
        stockfishEvalDepth: config.settings.stockfishEvalDepth,
        stockfishEngine: 'stockfish-17.1-lite',
        runManifestRef: 'run_manifest.json'
      });

      broadcast('batch-status', {
        status: 'running',
        totalGames,
        whiteModel,
        blackModel
      });
      io?.to('research').emit('batch-status', {
        status: 'running',
        totalGames,
        whiteModel,
        blackModel
      });

      const runResult = await runner.runPaperBatch(config, collectionOptions, {
        onDatapoint: (point: PaperDatapoint) => {
          collector.addDatapoint(point);
          const updatePayload = {
            gameId: point.gameId,
            gameIndex: point.gameIndex,
            moveNumber: point.moveNumber,
            move: point.move,
            fen: point.fenAfter,
            side: point.side,
            model: point.model,
            reasoning: point.reasoning,
            confidence: point.confidence,
            cpl: point.cpl,
            gamePhase: point.gamePhase,
            stats: {
              ...collector.getLiveStats(),
              totalGames: point.gameIndex
            }
          };

          broadcast('game-update', updatePayload);
          io?.to('research').emit('game-update', updatePayload);
        },
        onGameComplete: (gameSummary) => {
          collector.addGameSummary(gameSummary);
          broadcast('game-complete', {
            gameId: gameSummary.gameId,
            gameIndex: gameSummary.gameIndex,
            result: gameSummary.result,
            moveCount: gameSummary.moveCount,
            averageCplWhite: gameSummary.averageCplWhite,
            averageCplBlack: gameSummary.averageCplBlack,
            stats: collector.getLiveStats()
          });
        }
      });

      const artifacts = await collector.generatePaperArtifacts(paperOutputDir);

      const stats = artifacts.statsSummary;
      const paperOutput = {
        generatedAt: new Date().toISOString(),
        framing: {
          headline: 'Zero-shot LLM chess move compliance',
          summary:
            'This run measures legal move compliance and fallback dependence before interpreting playing strength metrics.'
        },
        totalGames: stats.totalGames,
        models: {
          white: whiteModel,
          black: blackModel
        },
        outcomes: {
          whiteWins: stats.whiteWins,
          blackWins: stats.blackWins,
          draws: stats.draws,
          whiteWinRate: stats.whiteWinRate,
          blackWinRate: stats.blackWinRate,
          drawRate: stats.drawRate,
          confidenceInterval95: stats.confidenceInterval95,
          pValueWhiteVsBlack: stats.pValueWhiteVsBlack
        },
        quality: {
          avgCpl: stats.avgCpl,
          blunderRate: stats.blunderRate,
          phasePerformance: stats.phasePerformance,
          cplSourceOfTruth: 'paper-stats.json.stats.avgCpl.overall'
        },
        compliance: stats.compliance,
        reliability: stats.reliability,
        dataPath: './research',
        sourceOfTruth: {
          stats: './research/paper-stats.json',
          datapoints: './research/paper-datapoints.json',
          games: './research/all-games.pgn'
        }
      };

      fs.writeFileSync(path.resolve(process.cwd(), '../research/paper-results.json'), JSON.stringify(paperOutput, null, 2));

      broadcast('batch-complete', {
        status: 'complete',
        outputFile: runResult.outputFile,
        artifacts
      });
      io?.to('research').emit('batch-complete', paperOutput);

      res.json({ ok: true, outputFile: runResult.outputFile, summary: runResult.summary, artifacts });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      broadcast('batch-status', { status: 'failed', error: message });
      io?.to('research').emit('batch-status', { status: 'failed', error: message });
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.post('/live-batch', async (req, res) => {
    try {
      const body = req.body as {
        totalGames?: number;
        whiteModel?: string;
        blackModel?: string;
        maxMoves?: number;
      };

      const totalGames = Math.max(1, Math.min(200, Number(body.totalGames ?? 200)));
      const whiteModel = String(body.whiteModel ?? 'tinyllama:latest');
      const blackModel = String(body.blackModel ?? 'phi3:latest');
      const maxMoves = Math.max(40, Math.min(600, Number(body.maxMoves ?? 200)));

      console.log(`🔴 LIVE MODE: ${totalGames} games ${whiteModel} vs ${blackModel} (maxMoves=${maxMoves})`);

      const configPath = path.resolve(process.cwd(), '../research/configs/batch_config_ollama_quick_test.json');
      const raw = await readFile(configPath, 'utf-8');
      const baseConfig = JSON.parse(raw) as BatchConfig;

      const config: BatchConfig = {
        ...baseConfig,
        games: totalGames,
        models: {
          white: whiteModel,
          black: blackModel
        },
        outputDir: baseConfig.outputDir ?? 'server/game-data',
        settings: {
          ...baseConfig.settings,
          maxMoves,
          moveDelayMs: 100,
          interGameDelayMs: 100,
          moveTimeoutMs: 8000
        }
      };

      const collectionOptions: PaperCollectionOptions = {
        enabled: true,
        trackReasoning: true,
        trackConfidence: true
      };

      const paperOutputDir = path.resolve(process.cwd(), '../research');
      const collector = new PaperDataCollector(whiteModel, blackModel, {
        blunderThresholdCpl: config.settings.blunderThresholdCp,
        stockfishEvalDepth: config.settings.stockfishEvalDepth,
        stockfishEngine: 'stockfish-17.1-lite',
        runManifestRef: 'run_manifest.json'
      });

      // Send immediate response
      res.json({ success: true, message: 'Live batch started!', totalGames });

      // Start batch in background
      broadcast('batch-status', {
        status: 'running',
        totalGames,
        whiteModel,
        blackModel
      });
      io?.to('research').emit('batch-status', {
        status: 'running',
        totalGames,
        whiteModel,
        blackModel
      });

      const runResult = await runner.runPaperBatch(config, collectionOptions, {
        onDatapoint: (point: PaperDatapoint) => {
          collector.addDatapoint(point);
          
          // LIVE FEN updates
          const liveUpdate = {
            fen: point.fenAfter,
            stats: {
              ...collector.getLiveStats(),
              currentGame: point.gameIndex,
              totalGames: totalGames
            }
          };

          broadcast('game-update', liveUpdate);
          io?.to('research').emit('game-update', liveUpdate);
        },
        onGameComplete: (gameSummary) => {
          collector.addGameSummary(gameSummary);
          
          broadcast('batch-progress', {
            currentGame: gameSummary.gameIndex,
            totalGames: totalGames
          });
          io?.to('research').emit('batch-progress', {
            currentGame: gameSummary.gameIndex,
            totalGames: totalGames
          });
        }
      });

      const artifacts = await collector.generatePaperArtifacts(paperOutputDir);
      
      broadcast('batch-complete', {
        status: 'complete',
        outputFile: runResult.outputFile,
        artifacts
      });
      io?.to('research').emit('batch-complete', {
        status: 'complete',
        artifacts
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Live batch error:', message);
      broadcast('batch-status', { status: 'failed', error: message });
      io?.to('research').emit('batch-status', { status: 'failed', error: message });
    }
  });

  return router;
}
