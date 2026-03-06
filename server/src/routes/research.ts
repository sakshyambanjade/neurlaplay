import { Express } from 'express';
import { SequentialGameRunner, GameConfig, SequentialBatchConfig } from '../research/SequentialGameRunner';
import { Server as SocketServer } from 'socket.io';
import * as path from 'path';

let activeBatchRunner: SequentialGameRunner | null = null;

type ProviderConfig = {
  env: false;
  endpoint: string;
  apiModel: string;
};

const PROVIDER_KEYS: Record<string, ProviderConfig> = {
  'ollama-qwen3-32b': {
    env: false,
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiModel: 'qwen2.5-coder:32b'
  },
  'ollama-mistral': {
    env: false,
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiModel: 'mistral:latest'
  },
  'ollama-neural-chat': {
    env: false,
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiModel: 'neural-chat:latest'
  },
  'ollama-dolphin': {
    env: false,
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiModel: 'dolphin-mixtral:latest'
  }
};

function getModelConfig(modelKey: string) {
  const config = PROVIDER_KEYS[modelKey];
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  // Ollama models don't need API keys
  return {
    ...config,
    apiKey: 'ollama-no-auth'
  };
}

function toGameConfig(
  whiteModel: string,
  blackModel: string,
  whiteConfig: ReturnType<typeof getModelConfig>,
  blackConfig: ReturnType<typeof getModelConfig>
): GameConfig {
  return {
    whiteModel,
    whiteApiModel: whiteConfig.apiModel,
    whiteEndpointUrl: whiteConfig.endpoint,
    whiteApiKey: whiteConfig.apiKey,
    blackModel,
    blackApiModel: blackConfig.apiModel,
    blackEndpointUrl: blackConfig.endpoint,
    blackApiKey: blackConfig.apiKey,
    enableStockfish: false,
    moveDelayMs: 500
  };
}

export function setupResearchRoutes(app: Express, io: SocketServer): void {
  app.post('/api/research/batch', async (req, res) => {
    if (activeBatchRunner) {
      return res.status(400).json({ success: false, error: 'Batch already running' });
    }

    try {
      const { whiteModel, blackModel, games = 50, balanced = true } = req.body;

      if (!whiteModel || !blackModel) {
        return res.status(400).json({ success: false, error: 'whiteModel and blackModel are required' });
      }

      const whiteConfig = getModelConfig(whiteModel);
      const blackConfig = getModelConfig(blackModel);

      const batchId = `batch_${Date.now()}`;
      const outputDir = path.resolve(`./batches/${batchId}`);

      const gameConfigs: GameConfig[] = [];
      for (let i = 0; i < games; i++) {
        const isWhiteFirst = !balanced || i % 2 === 0;

        if (isWhiteFirst) {
          gameConfigs.push(toGameConfig(whiteModel, blackModel, whiteConfig, blackConfig));
        } else {
          gameConfigs.push(toGameConfig(blackModel, whiteModel, blackConfig, whiteConfig));
        }
      }

      const config: SequentialBatchConfig = {
        totalGames: games,
        games: gameConfigs,
        outputDir,
        moveTimeoutMs: 30000,
        gameTimeoutMs: 600000,
        moveDelayMs: 500,
        interGameDelayMs: 1000,
        exportInterval: 1
      };

      activeBatchRunner = new SequentialGameRunner(config);

      activeBatchRunner.on('progress', (data) => {
        io.emit('batch:progress', {
          current: data.completedGames,
          total: data.totalGames,
          status: 'running'
        });
      });

      activeBatchRunner.on('game_done', (gameData) => {
        io.emit('batch:game_done', {
          fen: gameData.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: gameData.moves || [],
          result: gameData.result || 'pending'
        });
      });

      activeBatchRunner.on('complete', (finalResults) => {
        io.emit('batch:complete', {
          whiteWins: finalResults.whiteWins || 0,
          blackWins: finalResults.blackWins || 0,
          draws: finalResults.draws || 0,
          whiteCpl: finalResults.whiteCpl || 0,
          blackCpl: finalResults.blackCpl || 0
        });
        activeBatchRunner = null;
      });

      activeBatchRunner.run(io).catch((error) => {
        console.error('Batch error:', error);
        io.emit('batch:error', { error: error.message });
        activeBatchRunner = null;
      });

      return res.json({ success: true, batchId, outputDir });
    } catch (error) {
      console.error('Batch setup error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/research/status', (_req, res) => {
    res.json({ isRunning: activeBatchRunner !== null });
  });

  app.get('/api/research/export/latex', (_req, res) => {
    const latex = `\\begin{table}[h]
\\centering
\\begin{tabular}{|c|c|c|c|}
\\hline
\\textbf{Model} & \\textbf{Wins} & \\textbf{Draws} & \\textbf{Loss Rate} \\\\
\\hline
Results Coming Soon & -- & -- & -- \\\\
\\hline
\\end{tabular}
\\caption{Chess LLM Comparison Results}
\\label{table:chess_llm_results}
\\end{table}`;

    res.set('Content-Type', 'text/plain');
    res.send(latex);
  });

  app.get('/api/research/export/all', (_req, res) => {
    const csv = 'Model,Wins,Draws,Losses\nResults Coming Soon,,,';
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="research_results.csv"');
    res.send(csv);
  });

  app.post('/api/research/test-apis', async (req, res) => {
    try {
      const { models } = req.body;

      if (!models || !Array.isArray(models) || models.length === 0) {
        return res.status(400).json({ success: false, error: 'models array is required' });
      }

      const results: Record<string, { status: string; error?: string }> = {};

      for (const modelKey of models) {
        try {
          getModelConfig(modelKey);
          results[modelKey] = { status: 'valid' };
        } catch (error) {
          results[modelKey] = {
            status: 'invalid',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      const allValid = Object.values(results).every((r) => r.status === 'valid');
      return res.json({ success: allValid, allValid, results });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      });
    }
  });

  app.post('/api/research/tournament', async (req, res) => {
    if (activeBatchRunner) {
      return res.status(400).json({ success: false, error: 'Batch already running' });
    }

    try {
      const { models } = req.body;

      if (!models || !Array.isArray(models) || models.length < 2 || models.length > 5) {
        return res.status(400).json({ success: false, error: 'Select 2-5 models for tournament' });
      }

      const configs: Record<string, ReturnType<typeof getModelConfig>> = {};
      for (const modelKey of models) {
        configs[modelKey] = getModelConfig(modelKey);
      }

      const gameConfigs: GameConfig[] = [];
      for (let i = 0; i < models.length; i++) {
        for (let j = i + 1; j < models.length; j++) {
          const m1 = models[i];
          const m2 = models[j];
          const c1 = configs[m1];
          const c2 = configs[m2];

          gameConfigs.push(toGameConfig(m1, m2, c1, c2));
          gameConfigs.push(toGameConfig(m2, m1, c2, c1));
        }
      }

      const tournamentId = `tournament_${Date.now()}`;
      const outputDir = path.resolve(`./tournaments/${tournamentId}`);

      const config: SequentialBatchConfig = {
        totalGames: gameConfigs.length,
        games: gameConfigs,
        outputDir,
        moveTimeoutMs: 30000,
        gameTimeoutMs: 600000,
        moveDelayMs: 500,
        interGameDelayMs: 1000,
        exportInterval: 1
      };

      activeBatchRunner = new SequentialGameRunner(config);

      activeBatchRunner.on('progress', (data) => {
        io.emit('tournament:progress', {
          current: data.completedGames,
          total: data.totalGames,
          status: 'running',
          tournamentId
        });
      });

      activeBatchRunner.on('game_done', (gameData) => {
        io.emit('tournament:game_done', {
          fen: gameData.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: gameData.moves || [],
          result: gameData.result || 'pending',
          whiteModel: gameData.whiteModel,
          blackModel: gameData.blackModel
        });
      });

      activeBatchRunner.on('complete', (finalResults) => {
        io.emit('tournament:complete', {
          tournamentId,
          ...finalResults
        });
        activeBatchRunner = null;
      });

      activeBatchRunner.run(io).catch((error) => {
        console.error('Tournament error:', error);
        io.emit('tournament:error', { error: error.message });
        activeBatchRunner = null;
      });

      return res.json({
        success: true,
        tournamentId,
        totalGames: gameConfigs.length,
        models,
        matchups: gameConfigs.map((gc, idx) => ({ gameNumber: idx + 1, white: gc.whiteModel, black: gc.blackModel }))
      });
    } catch (error) {
      console.error('Tournament setup error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
