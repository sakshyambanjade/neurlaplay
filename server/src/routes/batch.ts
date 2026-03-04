/**
 * Batch Game Runner API Routes
 * Add to server/src/routes/batch.ts
 * 
 * Then import in server/src/index.ts:
 *   import batchRoutes from './routes/batch';
 *   app.use('/api/batch', batchRoutes);
 */

import express, { Request, Response } from 'express';
import { BatchGameRunner, BATCH_PRESETS } from '../research/BatchGameRunner';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

// Store active batch runners (keyed by batchId)
const activeBatches = new Map<string, { runner: BatchGameRunner; startTime: number }>();

/**
 * POST /api/batch/run
 * Start a new batch run with preset or custom config
 * 
 * Body:
 * {
 *   "preset": "50" | "quick" | "compare"  (OR)
 *   "config": {...}  (custom config object)
 * }
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { preset, config, configFile } = req.body;
    
    let batchConfig;
    
    if (preset) {
      // Use preset
      const presets = {
        '50': BATCH_PRESETS.tournament_50,
        'quick': BATCH_PRESETS.quick_test_3,
        'compare': BATCH_PRESETS.model_comparison
      };
      
      if (!(preset in presets)) {
        return res.status(400).json({
          error: `Invalid preset. Must be one of: ${Object.keys(presets).join(', ')}`
        });
      }
      
      batchConfig = presets[preset as keyof typeof presets];
    } else if (config) {
      // Use custom config
      batchConfig = config;
    } else if (configFile) {
      // Load from file path
      const filePath = path.resolve(configFile);
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: `Config file not found: ${filePath}` });
      }
      batchConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      return res.status(400).json({
        error: 'Must provide either preset, config, or configFile'
      });
    }
    
    // Generate batch ID
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create runner
    const runner = new BatchGameRunner(batchConfig as any);
    
    // Store reference
    activeBatches.set(batchId, {
      runner,
      startTime: Date.now()
    });
    
    // Start batch run in background (don't await)
    runner.run(req.app.get('io')).catch(error => {
      console.error(`Batch ${batchId} failed:`, error);
    });
    
    console.log(`✅ Batch ${batchId} started with preset: ${preset || 'custom'}`);
    
    res.json({
      status: 'started',
      batchId,
      totalGames: batchConfig.totalGames,
      concurrentGames: batchConfig.concurrentGames,
      outputDir: batchConfig.outputDir,
      message: `Batch ${batchId} started. Check /api/batch/progress/${batchId} for status.`
    });
  } catch (error) {
    console.error('Error starting batch:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/batch/progress/:batchId
 * Check progress of a running batch
 */
router.get('/progress/:batchId', (req: Request, res: Response) => {
  const { batchId } = req.params;
  
  const batchData = activeBatches.get(batchId);
  if (!batchData) {
    return res.status(404).json({ error: `Batch ${batchId} not found or completed` });
  }
  
  const progress = batchData.runner.getProgress();
  const elapsed = Math.floor((Date.now() - batchData.startTime) / 1000);
  const total = progress.completed + progress.failed + progress.running;
  const remaining = progress.total - total;
  const eta = remaining > 0 ? Math.floor((elapsed / total) * remaining) : 0;
  
  res.json({
    batchId,
    status: 'running',
    progress: {
      completed: progress.completed,
      failed: progress.failed,
      running: progress.running,
      total: progress.total,
      percentage: ((progress.completed / progress.total) * 100).toFixed(1) + '%'
    },
    timing: {
      elapsed: elapsed,
      eta: eta,
      avgTimePerGame: total > 0 ? Math.floor(elapsed / total) : 0
    }
  });
});

/**
 * GET /api/batch/presets
 * List available presets
 */
router.get('/presets', (req: Request, res: Response) => {
  res.json({
    presets: {
      quick: {
        description: '3 quick test games (2 min)',
        totalGames: 3,
        concurrentGames: 3,
        estimatedTime: '2 minutes'
      },
      '50': {
        description: '50-game tournament (40-50 min)',
        totalGames: 50,
        concurrentGames: 4,
        estimatedTime: '40-50 minutes'
      },
      compare: {
        description: '12-game model comparison (10-15 min)',
        totalGames: 12,
        concurrentGames: 3,
        estimatedTime: '10-15 minutes'
      }
    },
    usage: {
      preset: 'POST /api/batch/run with { "preset": "quick" | "50" | "compare" }',
      custom: 'POST /api/batch/run with { "config": {...} }',
      progress: 'GET /api/batch/progress/:batchId'
    }
  });
});

/**
 * GET /api/batch/examples
 * Get example configurations
 */
router.get('/examples', (req: Request, res: Response) => {
  res.json({
    example_quick_test: {
      totalGames: 3,
      concurrentGames: 3,
      games: [
        {
          whiteModel: 'gpt-4o',
          blackModel: 'gpt-4o',
          moveDelayMs: 100
        }
      ]
    },
    example_50_tournament: {
      totalGames: 50,
      concurrentGames: 4,
      games: [
        {
          whiteModel: 'gpt-4o',
          blackModel: 'claude-3.5-sonnet',
          moveDelayMs: 100
        }
      ]
    },
    example_with_robot: {
      totalGames: 10,
      concurrentGames: 1,
      games: [
        {
          whiteModel: 'gpt-4o',
          blackModel: 'claude-3.5-sonnet',
          enableRobotExecution: true,
          moveDelayMs: 5000
        }
      ]
    },
    example_with_stockfish: {
      totalGames: 20,
      concurrentGames: 3,
      games: [
        {
          whiteModel: 'gpt-4o',
          blackModel: 'claude-3.5-sonnet',
          enableStockfish: true,
          moveDelayMs: 100
        }
      ]
    }
  });
});

/**
 * POST /api/batch/resume
 * Resume a failed batch (retry all failed games)
 */
router.post('/resume/:batchId', (req: Request, res: Response) => {
  const { batchId } = req.params;
  
  const batchData = activeBatches.get(batchId);
  if (!batchData) {
    return res.status(404).json({
      error: `Batch ${batchId} not found. Only active batches can be resumed.`
    });
  }
  
  // Can't resume running batch
  const progress = batchData.runner.getProgress();
  if (progress.running > 0) {
    return res.status(400).json({
      error: 'Cannot resume running batch. Wait for completion first.'
    });
  }
  
  res.json({
    message: `Resume functionality would restart failed games in batch ${batchId}`,
    note: 'Implement in BatchGameRunner if needed'
  });
});

/**
 * Example usage in server/src/index.ts:
 * 
 * import batchRoutes from './routes/batch';
 * app.use('/api/batch', batchRoutes);
 * 
 * Then:
 * POST /api/batch/run { "preset": "quick" }
 * GET /api/batch/progress/batch-1234567890-abc123
 * GET /api/batch/presets
 * GET /api/batch/examples
 */

export default router;
