import { Chess } from 'chess.js';
import { spawn } from 'child_process';
import { PlayerConfig, MoveRecord, GameStatus, PlayerColor, Termination } from '../types';
import { config } from '../config';

/**
 * Stockfish analysis result for research metrics
 */
interface AnalysisResult {
  evalBefore: number;
  evalAfter: number;
  bestMove: string;
  centipawnLoss: number;
}

/**
 * MatchRoom - Core game state and chess logic
 * Manages a single match between two bots
 */
export class MatchRoom {
  public matchId: string;
  public status: GameStatus;
  public chess: Chess;
  public white: PlayerConfig | null = null;
  public black: PlayerConfig | null = null;
  public moves: MoveRecord[] = [];
  public moveTimeoutSeconds: number;
  public activeTimeout: NodeJS.Timeout | null = null;
  public createdAt: Date;
  public startedAt: Date | null = null;
  public endedAt: Date | null = null;
  public researchLog: any[] = [];
  private stockfishCache: Map<string, number> = new Map();

  constructor(matchId: string, timeoutSeconds?: number) {
    this.matchId = matchId;
    this.status = 'waiting';
    this.chess = new Chess();
    this.moveTimeoutSeconds = timeoutSeconds || config.DEFAULT_MOVE_TIMEOUT_SECONDS;
    this.createdAt = new Date();
  }

  /**
   * Current player to move
   */
  get currentTurn(): PlayerColor {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  /**
   * Get all legal moves in UCI format
   */
  get legalMovesUCI(): string[] {
    return this.chess.moves({ verbose: true }).map(m => {
      return m.from + m.to + (m.promotion || '');
    });
  }

  /**
   * Evaluate a FEN position using Stockfish (depth 20)
   * Returns centipawn score from white's perspective
   * Cached for performance
   */
  private async evaluatePosition(fen: string, depth: number = 20): Promise<number> {
    const cacheKey = `${fen}:${depth}`;
    if (this.stockfishCache.has(cacheKey)) {
      return this.stockfishCache.get(cacheKey)!;
    }

    return new Promise((resolve) => {
      try {
        let output = '';
        const stockfish = spawn('stockfish', [], {
          stdio: ['pipe', 'pipe', 'ignore']
        });

        // Set depth and evaluate
        stockfish.stdin?.write(`setoption name Depth ${depth}\n`);
        stockfish.stdin?.write(`position fen ${fen}\n`);
        stockfish.stdin?.write(`go depth ${depth}\n`);

        stockfish.stdout?.on('data', (data) => {
          output += data.toString();
          
          // Parse "info depth X score cp Y" or "info depth X score mate Z"
          const lineArray = output.split('\n');
          const lastLine = lineArray[lineArray.length - 2] || '';
          
          if (lastLine.includes('score cp')) {
            const match = lastLine.match(/score cp (-?\d+)/);
            if (match) {
              const score = parseInt(match[1]);
              this.stockfishCache.set(cacheKey, score);
              stockfish.kill();
              resolve(score);
            }
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (stockfish.exitCode === null) {
            stockfish.kill();
            resolve(0); // Fallback if timeout
          }
        }, 5000);

        stockfish.on('close', () => {
          // Resolve with cached value or 0
          const cached = this.stockfishCache.get(cacheKey);
          if (cached !== undefined) {
            resolve(cached);
          } else {
            resolve(0);
          }
        });

        stockfish.stdin?.end();
      } catch (error) {
        console.error('Stockfish evaluation failed:', error);
        resolve(0);
      }
    });
  }

  /**
   * Analyze move quality using Stockfish
   * Returns evaluation loss (centipawns) for the played move
   */
  async analyzeMoveQuality(
    fenBefore: string,
    playedMove: string
  ): Promise<AnalysisResult> {
    try {
      // Get evaluation before move
      const evalBefore = await this.evaluatePosition(fenBefore, 18);

      // Apply move and get evaluation after
      const tempChess = new Chess(fenBefore);
      const from = playedMove.slice(0, 2);
      const to = playedMove.slice(2, 4);
      const promotion = playedMove.length === 5 ? playedMove[4] : undefined;

      tempChess.move({ from, to, promotion: promotion as any });
      const fenAfter = tempChess.fen();
      const evalAfter = await this.evaluatePosition(fenAfter, 18);

      // Centipawn loss is difference in evaluation
      // (from current player's perspective, losses are positive)
      const currentColor = new Chess(fenBefore).turn();
      const cpMult = currentColor === 'w' ? 1 : -1;
      const centipawnLoss = Math.abs((evalAfter - evalBefore) * cpMult) / 100.0;

      return {
        evalBefore,
        evalAfter,
        bestMove: playedMove,
        centipawnLoss: Math.round(centipawnLoss * 100) / 100
      };
    } catch (error) {
      console.error('Move analysis failed:', error);
      return {
        evalBefore: 0,
        evalAfter: 0,
        bestMove: playedMove,
        centipawnLoss: 0
      };
    }
  }

  /**
   * Record move for research with Stockfish analysis
   */
  async recordMove(
    moveNumber: number,
    playerColor: PlayerColor,
    uci: string,
    san: string,
    fenBefore: string,
    fenAfter: string,
    reasoning: string,
    timeTakenMs: number
  ): Promise<void> {
    // Get Stockfish analysis
    const analysis = await this.analyzeMoveQuality(fenBefore, uci);

    const moveRecord: MoveRecord = {
      moveNumber,
      playerColor,
      uci,
      san,
      fenBefore,
      fenAfter,
      reasoning,
      timeTakenMs,
      sfEvalBefore: analysis.evalBefore,
      sfEvalAfter: analysis.evalAfter,
      sfBestMove: analysis.bestMove,
      cpLoss: analysis.centipawnLoss,
      createdAt: new Date()
    };

    // Add to moves and research log
    this.moves.push(moveRecord);
    
    // Log for research dataset export (CSV/JSON)
    this.researchLog.push({
      matchId: this.matchId,
      moveNumber,
      playerColor,
      fen: fenBefore,
      uci,
      reasoning,
      cpLoss: analysis.centipawnLoss,
      sfEvalBefore: analysis.evalBefore,
      sfEvalAfter: analysis.evalAfter,
      whiteBotName: this.white?.botName,
      whiteModel: this.white?.model,
      blackBotName: this.black?.botName,
      blackModel: this.black?.model,
      timestamp: Date.now()
    });

    if (analysis.centipawnLoss > 0) {
      console.log(
        `[RESEARCH] Match ${this.matchId} | ${playerColor.toUpperCase()} | CPL: ${analysis.centipawnLoss} | Move: ${san}`
      );
    }
  }

  /**
   * Is the game over?
   */
  get isOver(): boolean {
    return this.chess.isGameOver();
  }

  /**
   * PGN format result
   */
  get result(): string {
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === 'w' ? '0-1' : '1-0';
    }
    if (this.chess.isDraw()) {
      return '1/2-1/2';
    }
    return '*';
  }

  /**
   * Reason for game ending
   */
  get termination(): Termination {
    if (this.chess.isCheckmate()) return 'checkmate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isThreefoldRepetition()) return 'draw';
    if (this.chess.isInsufficientMaterial()) return 'draw';
    return 'in_progress';
  }

  /**
   * Both players configured and ready?
   */
  bothReady(): boolean {
    return !!this.white?.isReady && !!this.black?.isReady;
  }

  /**
   * Check if the game has reached the maximum move limit
   */
  get hasReachedMoveCap(): boolean {
    return this.moves.length >= config.MAX_MOVES_PER_GAME;
  }

  /**
   * Apply a move in UCI format
   */
  applyMove(uci: string): boolean {
    try {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;

      const result = this.chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined
      });

      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Get current board state
   */
  getState() {
    return {
      matchId: this.matchId,
      status: this.status,
      fen: this.chess.fen(),
      currentTurn: this.currentTurn,
      legalMoves: this.legalMovesUCI,
      pgn: this.chess.pgn(),
      moves: this.moves,
      isGameOver: this.isOver,
      moveCount: this.moves.length
    };
  }

  /**
   * Get game summary
   */
  getSummary() {
    const result = this.result;
    let winner = null;
    if (result === '1-0') winner = 'white';
    else if (result === '0-1') winner = 'black';

    return {
      matchId: this.matchId,
      status: this.status,
      whiteBotName: this.white?.botName,
      whiteModel: this.white?.model,
      blackBotName: this.black?.botName,
      blackModel: this.black?.model,
      result,
      winner,
      termination: this.termination,
      finalFen: this.chess.fen(),
      pgn: this.chess.pgn(),
      totalMoves: this.moves.length,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      averageCPL: this.getAverageCentipawnLoss(),
      totalCPL: this.getTotalCentipawnLoss()
    };
  }

  /**
   * Get average centipawn loss across all moves
   */
  getAverageCentipawnLoss(): number {
    if (this.moves.length === 0) return 0;
    const totalCPL = this.moves.reduce((sum, m) => sum + (m.cpLoss || 0), 0);
    return Math.round((totalCPL / this.moves.length) * 100) / 100;
  }

  /**
   * Get total centipawn loss for the game
   */
  getTotalCentipawnLoss(): number {
    return this.moves.reduce((sum, m) => sum + (m.cpLoss || 0), 0);
  }

  /**
   * Export research data as JSON (for paper datasets)
   */
  exportResearchJSON(): string {
    return JSON.stringify(this.researchLog, null, 2);
  }

  /**
   * Export research data as CSV (for analysis)
   */
  exportResearchCSV(): string {
    if (this.researchLog.length === 0) return '';

    const headers = [
      'matchId',
      'moveNumber',
      'playerColor',
      'uci',
      'reasoning',
      'cpLoss',
      'sfEvalBefore',
      'sfEvalAfter',
      'whiteBotName',
      'whiteModel',
      'blackBotName',
      'blackModel'
    ];

    const rows = this.researchLog.map((entry) =>
      headers.map((h) => {
        const val = (entry as any)[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Clear/reset the timeout
   */
  clearTimeout() {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
  }

  /**
   * Start the game - transition to in_progress
   */
  start() {
    this.status = 'in_progress';
    this.startedAt = new Date();
  }

  /**
   * Complete the game - transition to completed
   */
  complete() {
    this.status = 'completed';
    this.endedAt = new Date();
    this.clearTimeout();
  }

  /**
   * Abort the game - transition to completed with abort
   */
  abort(reason?: string) {
    this.status = 'completed';
    this.endedAt = new Date();
    this.clearTimeout();
  }

  /**
   * Force end the game (legacy method, use complete() instead)
   * @deprecated Use complete() instead
   */
  end() {
    this.complete();
  }
}
