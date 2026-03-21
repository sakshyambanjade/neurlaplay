import { Router } from 'express';
import type { Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { Chess } from 'chess.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runConfigToBatchConfig, validateRunConfig } from '../config/schema.js';
import { SequentialGameRunner } from '../research/SequentialGameRunner.js';
import { chooseMoveWithOllamaDetailed } from '../research/ollama.js';
import { getPaperRunsRoot, resolvePaperConfigPath } from '../research/PaperPaths.js';

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

function getLegalMoveOptions(chess: Chess) {
  return chess.moves({ verbose: true }).map((move) => ({
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ''}`
  }));
}

export function createResearchRouter(ollamaBaseUrl: string, io?: SocketIOServer) {
  const router = Router();
  const runner = new SequentialGameRunner(ollamaBaseUrl);
  const streamClients = new Map<number, StreamClient>();

  const broadcast = (event: string, payload: unknown) => {
    for (const client of streamClients.values()) {
      client.send(event, payload);
    }
    io?.to('research').emit(event, payload);
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

  router.get('/backend-health', async (_req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: controller.signal });
      res.json({
        ok: response.ok,
        provider: 'ollama',
        baseUrl: ollamaBaseUrl,
        status: response.status
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        provider: 'ollama',
        baseUrl: ollamaBaseUrl,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      clearTimeout(timer);
    }
  });

  router.post('/smoke', async (_req, res) => {
    try {
      const configPath = resolvePaperConfigPath('debug', 'smoke_10_games.json');
      const raw = await readFile(configPath, 'utf-8');
      const config = validateRunConfig(JSON.parse(raw));
      const matchup = config.matchups[0];
      if (!matchup) {
        throw new Error('Smoke config has no matchups.');
      }
      const batchConfig = runConfigToBatchConfig(
        config,
        matchup,
        path.join(getPaperRunsRoot(), 'debug-smoke')
      );
      const result = await runner.run(batchConfig);
      broadcast('smoke:complete', result);
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      broadcast('smoke:error', { error: message });
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.post('/position', async (req, res) => {
    try {
      const fen =
        typeof req.body?.fen === 'string' && req.body.fen.trim().length > 0
          ? req.body.fen.trim()
          : new Chess().fen();
      const model =
        typeof req.body?.model === 'string' && req.body.model.trim().length > 0
          ? req.body.model.trim()
          : 'tinyllama:latest';
      const timeoutMs = Math.max(1000, Number(req.body?.timeoutMs ?? 10000));

      const chess = new Chess(fen);
      const legalMoves = getLegalMoveOptions(chess);
      const result = await chooseMoveWithOllamaDetailed(
        ollamaBaseUrl,
        model,
        fen,
        legalMoves,
        timeoutMs
      );

      res.json({
        ok: true,
        fen,
        legalMoves,
        result
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
