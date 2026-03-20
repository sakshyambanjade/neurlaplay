import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
      let evalBefore = 0;
      let evalAfter = 0;
      let bestMoveBefore = '';
      let hasBeforeEval = false;
      let timeout: NodeJS.Timeout;

      // Step 1: Get evaluation BEFORE the move
      const beforeHandler = (line: string) => {
        const evalMatch = line.match(/score cp (-?\d+)/);
        if (evalMatch) {
          evalBefore = parseInt(evalMatch[1], 10);
        }
        
        const moveMatch = line.match(/bestmove\s+(\S+)/);
        if (moveMatch) {
          bestMoveBefore = moveMatch[1];
          hasBeforeEval = true;
          this.messageHandlers = this.messageHandlers.filter(h => h !== beforeHandler);
          
          // Step 2: Apply the played move and get evaluation AFTER
          const afterHandler = (line: string) => {
            const evalMatch = line.match(/score cp (-?\d+)/);
            if (evalMatch) {
              evalAfter = parseInt(evalMatch[1], 10);
            }
            
            if (line.includes('bestmove')) {
              clearTimeout(timeout);
              this.messageHandlers = this.messageHandlers.filter(h => h !== afterHandler);
              
              // CPL = how much worse the position got from the player's perspective
              // Note: Stockfish evals are from side-to-move perspective
              // We need to flip perspective for the after-move eval
              const cpl = Math.abs(evalBefore - (-evalAfter));
              resolve(Math.max(0, Math.min(5000, cpl)));
            }
          };
          
          this.messageHandlers.push(afterHandler);
          // Apply the move and analyze the resulting position
          this.sendCommand(`position fen ${fenBefore} moves ${playedMove}`);
          this.sendCommand(`go depth ${this.analysisDepth}`);
        }
      };

      // Set up timeout (max 4 seconds for both evals)
      timeout = setTimeout(() => {
        this.messageHandlers = [];
        resolve(this.fallbackCPL(fenBefore, playedMove));
      }, 4000);

      // Attach listener and start analysis of position before move
      this.messageHandlers.push(beforeHandler);
      this.sendCommand(`position fen ${fenBefore}`);
      this.sendCommand(`go depth ${this.analysisDepth}`);
    });
  }

  private fallbackCPL(fen: string, move: string): number {
    // Signal that CPL could not be computed.
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
