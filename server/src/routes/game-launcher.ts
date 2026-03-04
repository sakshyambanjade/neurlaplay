import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import RoundRobinTournament from '../research/RoundRobinTournament';
import ConcurrentExperimentRunner from '../research/ConcurrentExperimentRunner';
import fs from 'fs';
import path from 'path';

/**
 * Game Launcher Routes
 * 
 * Provides REST API endpoints for:
 * - Starting tournaments
 * - Starting concurrent experiments
 * - Checking API key status
 * - Retrieving results
 * 
 * Also integrates with Socket.io for real-time status updates
 */

interface LauncherState {
  isRunning: boolean;
  currentType: 'tournament' | 'experiment' | null;
  currentGame: number;
  totalGames: number;
  currentPairing: number;
  totalPairings: number;
  startTime: number | null;
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  error: string | null;
  results: any | null;
}

const launcherState: LauncherState = {
  isRunning: false,
  currentType: null,
  currentGame: 0,
  totalGames: 0,
  currentPairing: 0,
  totalPairings: 0,
  startTime: null,
  elapsedSeconds: 0,
  estimatedTotalSeconds: 0,
  error: null,
  results: null,
};

let io: Server | null = null;

export function initGameLauncherRoutes(router: Router, socketIo: Server) {
  io = socketIo;

  /**
   * POST /api/start-tournament
   * Start a round-robin tournament
   */
  router.post('/api/start-tournament', async (req: Request, res: Response) => {
    try {
      if (launcherState.isRunning) {
        return res.status(400).json({
          error: 'Tournament already running',
        });
      }

      const { type } = req.body;

      if (type !== 'roundrobin') {
        return res.status(400).json({
          error: 'Invalid tournament type',
        });
      }

      // Check API keys
      const keysStatus = checkApiKeys();
      if (!keysStatus.ready) {
        return res.status(400).json({
          error: 'Missing required API keys',
          missing: keysStatus.missing,
        });
      }

      // Load tournament config
      const configPath = path.join(
        __dirname,
        '../research/configs/tournament-roundrobin.json'
      );
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Substitute env vars
      config.models.forEach((model: any) => {
        const envVar = process.env[model.apiKeyEnv];
        if (!envVar) {
          throw new Error(`Missing: ${model.apiKeyEnv}`);
        }
        model.apiKey = envVar;
      });

      // Initialize state
      launcherState.isRunning = true;
      launcherState.currentType = 'tournament';
      launcherState.currentGame = 0;
      launcherState.totalGames = 30;
      launcherState.currentPairing = 0;
      launcherState.totalPairings = 15;
      launcherState.startTime = Date.now();
      launcherState.estimatedTotalSeconds = 2700; // 45 minutes
      launcherState.error = null;
      launcherState.results = null;

      res.json({
        status: 'started',
        type: 'roundrobin',
        totalGames: 30,
        totalPairings: 15,
        estimatedDuration: '45 minutes',
      });

      // Run tournament asynchronously
      runTournamentAsync(config);
    } catch (error) {
      launcherState.isRunning = false;
      launcherState.error = String(error);

      res.status(500).json({
        error: String(error),
      });
    }
  });

  /**
   * POST /api/start-experiment
   * Start a concurrent LLM experiment
   */
  router.post('/api/start-experiment', async (req: Request, res: Response) => {
    try {
      if (launcherState.isRunning) {
        return res.status(400).json({
          error: 'Experiment already running',
        });
      }

      const { type } = req.body;

      if (type !== 'concurrent_6models') {
        return res.status(400).json({
          error: 'Invalid experiment type',
        });
      }

      // Check API keys
      const keysStatus = checkApiKeys();
      if (!keysStatus.ready) {
        return res.status(400).json({
          error: 'Missing required API keys',
          missing: keysStatus.missing,
        });
      }

      // Load experiment config
      const configPath = path.join(
        __dirname,
        '../research/configs/experiment-6models-concurrent.json'
      );
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Substitute env vars
      config.models.forEach((model: any) => {
        const envVar = process.env[model.apiKeyEnv];
        if (!envVar) {
          throw new Error(`Missing: ${model.apiKeyEnv}`);
        }
        model.apiKey = envVar;
      });

      // Initialize state
      launcherState.isRunning = true;
      launcherState.currentType = 'experiment';
      launcherState.currentGame = 0;
      launcherState.totalGames = 50;
      launcherState.currentPairing = 0;
      launcherState.totalPairings = 1;
      launcherState.startTime = Date.now();
      launcherState.estimatedTotalSeconds = 2700; // 45 minutes
      launcherState.error = null;
      launcherState.results = null;

      res.json({
        status: 'started',
        type: 'concurrent_6models',
        totalGames: 50,
        estimatedDuration: '45 minutes',
      });

      // Run experiment asynchronously
      runExperimentAsync(config);
    } catch (error) {
      launcherState.isRunning = false;
      launcherState.error = String(error);

      res.status(500).json({
        error: String(error),
      });
    }
  });

  /**
   * GET /api/check-api-keys
   * Check which API keys are configured
   */
  router.get('/api/check-api-keys', (req: Request, res: Response) => {
    const keys: Record<string, boolean> = {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY,
      HUGGINGFACE_API_KEY: !!process.env.HUGGINGFACE_API_KEY,
      TOGETHER_API_KEY: !!process.env.TOGETHER_API_KEY,
    };

    res.json(keys);
  });

  /**
   * GET /api/launcher-status
   * Get current launcher status
   */
  router.get('/api/launcher-status', (req: Request, res: Response) => {
    const elapsed = launcherState.startTime
      ? Math.floor((Date.now() - launcherState.startTime) / 1000)
      : 0;

    const remaining = Math.max(
      0,
      launcherState.estimatedTotalSeconds - elapsed
    );

    res.json({
      isRunning: launcherState.isRunning,
      currentType: launcherState.currentType,
      currentGame: launcherState.currentGame,
      totalGames: launcherState.totalGames,
      currentPairing: launcherState.currentPairing,
      totalPairings: launcherState.totalPairings,
      elapsed: formatTime(elapsed),
      remaining: formatTime(remaining),
      error: launcherState.error,
      hasResults: !!launcherState.results,
    });
  });

  /**
   * GET /api/tournament-results
   * Download results in specified format
   */
  router.get('/api/tournament-results', (req: Request, res: Response) => {
    try {
      const format = req.query.format as string || 'json';
      const resultsDir = path.join(process.cwd(), 'tournament-results');

      if (!fs.existsSync(resultsDir)) {
        return res.status(404).json({
          error: 'No tournament results found',
        });
      }

      let filename: string;
      let contentType: string;

      switch (format) {
        case 'latex':
          filename = 'tournament-table.latex';
          contentType = 'text/plain';
          break;
        case 'csv':
          filename = 'standings.csv';
          contentType = 'text/csv';
          break;
        case 'json':
        default:
          filename = 'standings.json';
          contentType = 'application/json';
          break;
      }

      const filePath = path.join(resultsDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: `Results file not found: ${filename}`,
        });
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(content);
    } catch (error) {
      res.status(500).json({
        error: String(error),
      });
    }
  });

  /**
   * GET /api/tournament-results/preview
   * Get a preview of results without downloading
   */
  router.get('/api/tournament-results/preview', (req: Request, res: Response) => {
    try {
      const resultsDir = path.join(process.cwd(), 'tournament-results');
      const standingsFile = path.join(resultsDir, 'standings.json');

      if (!fs.existsSync(standingsFile)) {
        return res.json({
          available: false,
          message: 'Tournament not yet completed',
        });
      }

      const standings = JSON.parse(fs.readFileSync(standingsFile, 'utf-8'));

      res.json({
        available: true,
        totalModels: standings.length,
        standings: standings.slice(0, 6), // Just first 6
        topModel: standings[0],
      });
    } catch (error) {
      res.status(500).json({
        error: String(error),
      });
    }
  });

  return router;
}

/**
 * Helper: Check API key status
 */
function checkApiKeys() {
  const required = ['GROQ_API_KEY', 'OPENROUTER_API_KEY'];
  const missing: string[] = [];

  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Helper: Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper: Run tournament in background
 */
async function runTournamentAsync(config: any) {
  try {
    const tournament = new RoundRobinTournament(
      config.models.map((m: any) => ({
        name: m.name,
        provider: m.provider,
        model: m.model,
        apiKey: m.apiKey,
        eloEstimate: m.eloEstimate,
      })),
      'tournament-results',
      config.maxGamesPerModel || 150,
      config.moveDelayMs || 500
    );

    // Emit initial state
    broadcastStatus();

    // Run tournament
    await tournament.run();

    // Load results
    const resultFile = path.join(process.cwd(), 'tournament-results', 'standings.json');
    launcherState.results = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));

    launcherState.isRunning = false;
    broadcastStatus('completed');
  } catch (error) {
    launcherState.error = String(error);
    launcherState.isRunning = false;
    broadcastStatus('error');
    console.error('Tournament error:', error);
  }
}

/**
 * Helper: Run experiment in background
 */
async function runExperimentAsync(config: any) {
  try {
    const experiment = new ConcurrentExperimentRunner(
      config,
      'experiment-results',
      config.moveDelayMs || 500
    );

    broadcastStatus();

    // Run experiment
    await experiment.run();

    launcherState.isRunning = false;
    broadcastStatus('completed');
  } catch (error) {
    launcherState.error = String(error);
    launcherState.isRunning = false;
    broadcastStatus('error');
    console.error('Experiment error:', error);
  }
}

/**
 * Helper: Broadcast current status via WebSocket
 */
function broadcastStatus(finalStatus?: string) {
  if (!io) return;

  const elapsed = launcherState.startTime
    ? Math.floor((Date.now() - launcherState.startTime) / 1000)
    : 0;

  const remaining = Math.max(
    0,
    launcherState.estimatedTotalSeconds - elapsed
  );

  io.emit('tournament-status', {
    status: finalStatus || (launcherState.isRunning ? 'running' : 'idle'),
    currentGame: launcherState.currentGame,
    totalGames: launcherState.totalGames,
    currentPairing: launcherState.currentPairing,
    totalPairings: launcherState.totalPairings,
    elapsed: formatTime(elapsed),
    estimated: formatTime(remaining),
    error: launcherState.error,
  });
}

/**
 * Export helper: Update game counter (called from tournament)
 */
export function updateGameCounter(current: number, total: number) {
  launcherState.currentGame = current;
  launcherState.totalGames = total;
  broadcastStatus();
}

/**
 * Export helper: Update pairing counter (called from tournament)
 */
export function updatePairingCounter(current: number, total: number) {
  launcherState.currentPairing = current;
  launcherState.totalPairings = total;
  broadcastStatus();
}

export default initGameLauncherRoutes;
