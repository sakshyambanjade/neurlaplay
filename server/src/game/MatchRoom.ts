import { Chess } from 'chess.js';
import { PlayerConfig, MoveRecord, GameStatus, PlayerColor, Termination } from '../types';
import { config } from '../config';

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
      endedAt: this.endedAt
    };
  }

  /**
   * Clear/reset the timeout
   */
  clearTimeout() {
    iStart the game - transition to in_progress
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
    this.complete()
  /**
   * Force end the game
   */
  end() {
    this.clearTimeout();
    this.endedAt = new Date();
    this.status = 'completed';
  }
}
