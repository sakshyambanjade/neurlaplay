import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { GamePaperSummary } from './types.js';

/**
 * Persistent game logger that saves every game immediately.
 * Uses JSONL format (one JSON object per line) for append-only durability.
 */
export class GameLogger {
  private logFilePath: string;
  private initialized = false;

  constructor(private readonly baseDir: string = '../research/logs') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.logFilePath = path.resolve(process.cwd(), baseDir, `games-${timestamp}.jsonl`);
  }

  /**
   * Initialize log directory
   */
  private async ensureLogDir(): Promise<void> {
    if (this.initialized) return;
    const dir = path.dirname(this.logFilePath);
    await mkdir(dir, { recursive: true });
    this.initialized = true;
  }

  /**
   * Log a single game immediately (append-only, crash-safe)
   */
  async logGame(game: GamePaperSummary, metadata?: Record<string, unknown>): Promise<void> {
    await this.ensureLogDir();
    
    const entry = {
      timestamp: new Date().toISOString(),
      game,
      metadata
    };
    
    // JSONL format: one line per game, never loses data even on crash
    const line = JSON.stringify(entry) + '\n';
    await appendFile(this.logFilePath, line, 'utf-8');
  }

  /**
   * Get the current log file path
   */
  getLogPath(): string {
    return this.logFilePath;
  }
}
