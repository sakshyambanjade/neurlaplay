import { spawn, type ChildProcess } from 'child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export function resolveStockfishEnginePath(): string | null {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const stockfishSrcDir = join(__dirname, '../../node_modules/stockfish/src');
  if (!fs.existsSync(stockfishSrcDir)) {
    return null;
  }

  const preferredCandidates = [
    'stockfish-17.1-lite-single-03e3232.js',
    'stockfish-17.1-lite-51f59da.js',
    'stockfish-17.1-8e4d048.js'
  ].map((filename) => join(stockfishSrcDir, filename));

  for (const candidate of preferredCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const dynamicCandidate = fs
    .readdirSync(stockfishSrcDir)
    .filter((entry) => /^stockfish-.*\.js$/i.test(entry))
    .sort((a, b) => a.localeCompare(b))[0];

  return dynamicCandidate ? join(stockfishSrcDir, dynamicCandidate) : null;
}

export class StockfishAnalyzer {
  private engine: ChildProcess | null = null;
  private initialized = false;
  private outputBuffer: string = '';
  private messageHandlers: ((line: string) => void)[] = [];
  private analysisDepth = 10;

  setAnalysisDepth(depth: number): void {
    if (Number.isFinite(depth) && depth > 0) {
      this.analysisDepth = Math.floor(depth);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stockfishPath = resolveStockfishEnginePath();
      if (!stockfishPath) {
        throw new Error('Stockfish engine script not found in node_modules/stockfish/src');
      }

      this.engine = spawn(process.execPath, [stockfishPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.engine.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.messageHandlers.forEach((handler) => handler(line));
          }
        }
      });

      this.engine.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.messageHandlers.forEach((handler) => handler(line));
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stockfish initialization timeout'));
        }, 5000);

        const handler = (line: string) => {
          if (line.includes('uciok')) {
            clearTimeout(timeout);
            this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
            resolve();
          }
        };

        this.messageHandlers.push(handler);
        this.sendCommand('uci');
      });

      this.initialized = true;
      console.log('Stockfish engine initialized');
    } catch (error) {
      console.warn('Stockfish not available, using fallback analysis', error);
      this.initialized = false;
      if (this.engine) {
        this.engine.kill();
        this.engine = null;
      }
    }
  }

  private sendCommand(cmd: string): void {
    if (this.engine?.stdin) {
      this.engine.stdin.write(cmd + '\n');
    }
  }

  async computeCPL(fenBefore: string, playedMove: string): Promise<number> {
    if (!this.initialized || !this.engine) {
      return this.fallbackCPL(fenBefore, playedMove);
    }

    return new Promise((resolve) => {
      let evalBefore = 0;
      let evalAfter = 0;
      let timeout: NodeJS.Timeout;
      const analysisTimeoutMs = Math.min(2500, Math.max(1200, this.analysisDepth * 250));

      const beforeHandler = (line: string) => {
        const evalMatch = line.match(/score cp (-?\d+)/);
        if (evalMatch) {
          evalBefore = parseInt(evalMatch[1], 10);
        }

        const moveMatch = line.match(/bestmove\s+(\S+)/);
        if (moveMatch) {
          this.messageHandlers = this.messageHandlers.filter((h) => h !== beforeHandler);

          const afterHandler = (line: string) => {
            const evalMatch = line.match(/score cp (-?\d+)/);
            if (evalMatch) {
              evalAfter = parseInt(evalMatch[1], 10);
            }

            if (line.includes('bestmove')) {
              clearTimeout(timeout);
              this.messageHandlers = this.messageHandlers.filter((h) => h !== afterHandler);
              const cpl = Math.abs(evalBefore - -evalAfter);
              resolve(Math.max(0, Math.min(5000, cpl)));
            }
          };

          this.messageHandlers.push(afterHandler);
          this.sendCommand(`position fen ${fenBefore} moves ${playedMove}`);
          this.sendCommand(`go depth ${this.analysisDepth}`);
        }
      };

      timeout = setTimeout(() => {
        this.messageHandlers = [];
        resolve(this.fallbackCPL(fenBefore, playedMove));
      }, analysisTimeoutMs);

      this.messageHandlers.push(beforeHandler);
      this.sendCommand(`position fen ${fenBefore}`);
      this.sendCommand(`go depth ${this.analysisDepth}`);
    });
  }

  private fallbackCPL(_fen: string, _move: string): number {
    return -1;
  }

  async shutdown(): Promise<void> {
    if (this.engine) {
      this.sendCommand('quit');
      this.engine.kill();
      this.engine = null;
      this.initialized = false;
    }
  }
}
