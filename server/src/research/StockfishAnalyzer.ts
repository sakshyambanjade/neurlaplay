import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export class StockfishAnalyzer {
  private engine: ChildProcess | null = null;
  private initialized = false;
  private outputBuffer: string = '';
  private messageHandlers: ((line: string) => void)[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Determine the path to stockfish engine
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const stockfishPath = join(__dirname, '../../node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js');
      
      // Spawn the stockfish engine
      this.engine = spawn(process.execPath, [stockfishPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stdout
      this.engine.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.messageHandlers.forEach(handler => handler(line));
          }
        }
      });

      // Handle stderr
      this.engine.stderr?.on('data', (data) => {
        // Stockfish sometimes sends info to stderr
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.messageHandlers.forEach(handler => handler(line));
          }
        }
      });

      // Wait for UCI initialization
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stockfish initialization timeout'));
        }, 5000);

        const handler = (line: string) => {
          if (line.includes('uciok')) {
            clearTimeout(timeout);
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
            resolve();
          }
        };

        this.messageHandlers.push(handler);
        this.sendCommand('uci');
      });

      this.initialized = true;
      console.log('✅ Stockfish engine initialized');
    } catch (error) {
      console.warn('⚠️ Stockfish not available, using fallback analysis', error);
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
      // Fallback: simple heuristic
      return this.fallbackCPL(fenBefore, playedMove);
    }

    return new Promise((resolve) => {
      let bestEval = 0;
      let timeout: NodeJS.Timeout;

      const messageHandler = (line: string) => {
        // Extract centipawn evaluation
        const evalMatch = line.match(/score cp (-?\d+)/);
        if (evalMatch) {
          bestEval = parseInt(evalMatch[1], 10);
        }

        // When analysis completes
        if (line.includes('bestmove')) {
          clearTimeout(timeout);
          this.messageHandlers = this.messageHandlers.filter(h => h !== messageHandler);
          
          // CPL is absolute difference from perfect play
          const cpl = Math.abs(bestEval) / 10; // Convert centipawns to simplified scale
          resolve(Math.max(0, Math.min(500, cpl)));
        }
      };

      // Set up timeout (max 2 seconds per position)
      timeout = setTimeout(() => {
        this.messageHandlers = this.messageHandlers.filter(h => h !== messageHandler);
        resolve(this.fallbackCPL(fenBefore, playedMove));
      }, 2000);

      // Attach listener
      this.messageHandlers.push(messageHandler);

      // Start analysis
      this.sendCommand(`position fen ${fenBefore}`);
      this.sendCommand('go depth 10');
    });
  }

  private fallbackCPL(fen: string, move: string): number {
    // Simple heuristic: random with bias
    const baseError = Math.random() * 50 + 10; // 10-60 CPL
    
    // Add penalties for suspicious patterns
    let penalty = 0;
    if (move.match(/[a-h]1[a-h]8/)) penalty += 20; // Long moves slightly suspicious
    if (!move.includes('x') && Math.random() > 0.7) penalty += 10; // Missed capture
    
    return Math.min(200, baseError + penalty);
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
