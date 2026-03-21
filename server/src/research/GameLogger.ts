import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GamePaperSummary } from './types.js';
import { getPaperLogsRoot } from './PaperPaths.js';

/**
 * Persistent game logger that saves every game immediately.
 * Uses JSONL format (one JSON object per line) for append-only durability.
 */
export class GameLogger {
  private logFilePath: string;
  private initialized = false;
  private runDir: string | null = null;
  private movesLogPath: string | null = null;
  private gamesLogPath: string | null = null;
  private runSummaryPath: string | null = null;
  private paperMode = false;

  constructor(private readonly baseDir: string = getPaperLogsRoot()) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.logFilePath = path.resolve(process.cwd(), baseDir, `games-${timestamp}.jsonl`);
  }

  /**
   * Initialize log directory
   */
  private async ensureLogDir(): Promise<void> {
    if (this.initialized) return;
    if (!this.paperMode) {
      const dir = path.dirname(this.logFilePath);
      await mkdir(dir, { recursive: true });
    }
    if (this.runDir) {
      await mkdir(this.runDir, { recursive: true });
    }
    this.initialized = true;
  }

  setRunDirectory(runDir: string): void {
    this.runDir = path.resolve(runDir);
    this.paperMode = true;
    this.movesLogPath = path.join(this.runDir, 'moves.jsonl');
    this.gamesLogPath = path.join(this.runDir, 'games.jsonl');
    this.runSummaryPath = path.join(this.runDir, 'run_summary.json');
  }

  private async appendToRunFile(target: string | null, entry: Record<string, unknown>): Promise<void> {
    if (!target) {
      return;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await appendFile(target, JSON.stringify(entry) + '\n', 'utf-8');
  }

  /**
   * Log a single game immediately (append-only, crash-safe)
   */
  async logGame(game: GamePaperSummary, metadata?: Record<string, unknown>): Promise<void> {
    await this.ensureLogDir();

    const entry = {
      timestamp: new Date().toISOString(),
      ...game,
      metadata: metadata ?? null
    };

    // JSONL format: one line per game, never loses data even on crash
    const line = JSON.stringify(entry) + '\n';
    if (!this.paperMode) {
      await appendFile(this.logFilePath, line, 'utf-8');
    }
    await this.appendToRunFile(this.gamesLogPath, entry);
  }

  /**
   * Log a single move with full context (anti-hallucination trace)
   */
  async logMove(entry: Record<string, unknown>): Promise<void> {
    await this.ensureLogDir();
    const payload = { timestamp: new Date().toISOString(), ...entry };
    const line = JSON.stringify(payload) + '\n';
    if (!this.paperMode) {
      await appendFile(this.logFilePath, line, 'utf-8');
    }
    await this.appendToRunFile(this.movesLogPath, payload);
  }

  async writeRunSummary(summary: Record<string, unknown>): Promise<void> {
    await this.ensureLogDir();
    if (!this.runSummaryPath) {
      return;
    }
    await mkdir(path.dirname(this.runSummaryPath), { recursive: true });
    await writeFile(this.runSummaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /**
   * Get the current log file path
   */
  getLogPath(): string {
    if (this.paperMode && this.gamesLogPath) {
      return this.gamesLogPath;
    }
    return this.logFilePath;
  }
}
