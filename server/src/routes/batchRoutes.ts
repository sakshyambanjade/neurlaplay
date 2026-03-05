import { Express } from 'express';
import { SequentialGameRunner, SequentialBatchConfig } from '../research/SequentialGameRunner';
import * as fs from 'fs';
import * as path from 'path';
import { Server as SocketServer } from 'socket.io';

let activeBatchRunner: SequentialGameRunner | null = null;
let batchStatus: 'idle' | 'running' | 'completed' | 'failed' = 'idle';

export function setupBatchRoutes(app: Express, io: SocketServer): void {
  
  /**
   * POST /api/batch/start - Start a batch of games
   */
  app.post('/api/batch/start', async (req, res) => {
    if (activeBatchRunner) {
      return res.status(400).json({ 
        success: false, 
        error: 'Batch already running' 
      });
    }

    try {
      const { configPath, totalGames } = req.body;
      
      // Load config
      let configFilePath: string;
      if (configPath) {
        configFilePath = path.resolve(configPath);
      } else {
        // Use default 50-game research config
        configFilePath = path.resolve('./research/configs/batch_config_research_50games.json');
      }

      if (!fs.existsSync(configFilePath)) {
        return res.status(404).json({ 
          success: false, 
          error: `Config file not found: ${configFilePath}` 
        });
      }

      let config: SequentialBatchConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      
      // Replace environment variables in API keys
      config.games = config.games.map(game => ({
        ...game,
        whiteApiKey: replaceEnvVars(game.whiteApiKey),
        blackApiKey: replaceEnvVars(game.blackApiKey)
      }));
      
      // Override total games if provided
      if (totalGames && totalGames > 0) {
        config.totalGames = totalGames;
      }

      // Create and start runner
      activeBatchRunner = new SequentialGameRunner(config);
      batchStatus = 'running';

      // Send progress updates via WebSocket
      activeBatchRunner.on('gameStart', (data) => {
        io.emit('batch:gameStart', data);
      });

      activeBatchRunner.on('gameComplete', (data) => {
        io.emit('batch:gameComplete', data);
      });

      activeBatchRunner.on('gameFailed', (data) => {
        io.emit('batch:gameFailed', data);
      });

      activeBatchRunner.on('progress', (data) => {
        io.emit('batch:progress', data);
      });

      // Run async, don't block response
      activeBatchRunner.run(io).then(result => {
        io.emit('batch:complete', result);
        batchStatus = 'completed';
        activeBatchRunner = null;
      }).catch(error => {
        io.emit('batch:failed', { error: error.message });
        batchStatus = 'failed';
        activeBatchRunner = null;
      });

      res.json({ 
        success: true, 
        message: 'Batch started',
        totalGames: config.totalGames,
        outputDir: config.outputDir
      });

    } catch (error: any) {
      batchStatus = 'failed';
      activeBatchRunner = null;
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /**
   * GET /api/batch/status - Get current batch status
   */
  app.get('/api/batch/status', (req, res) => {
    res.json({ 
      success: true, 
      status: batchStatus,
      running: activeBatchRunner !== null
    });
  });

  /**
   * POST /api/batch/stop - Stop current batch
   */
  app.post('/api/batch/stop', (req, res) => {
    if (!activeBatchRunner) {
      return res.status(400).json({ 
        success: false, 
        error: 'No batch running' 
      });
    }

    // TODO: Add proper stop/cancel mechanism
    activeBatchRunner = null;
    batchStatus = 'idle';

    res.json({ 
      success: true, 
      message: 'Batch stopped' 
    });
  });

  /**
   * GET /api/batch/configs - List available batch configs
   */
  app.get('/api/batch/configs', (req, res) => {
    try {
      const configsDir = path.resolve('./research/configs');
      const files = fs.readdirSync(configsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(configsDir, f)
        }));

      res.json({ 
        success: true, 
        configs: files 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
}

/**
 * Replace ${ENV_VAR} with actual environment variable values
 */
function replaceEnvVars(str: string): string {
  return str.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    return process.env[envVar] || match;
  });
}
