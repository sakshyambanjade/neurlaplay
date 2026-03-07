import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Chess } from 'chess.js';
import { chooseMoveWithOllama, chooseMoveWithOllamaDetailed, type LegalMoveOption } from './ollama.js';
import { StockfishAnalyzer } from './StockfishAnalyzer.js';
import { GameLogger } from './GameLogger.js';
import type {
  BatchConfig,
  GamePaperSummary,
  GamePhase,
  GameResult,
  PaperCollectionOptions,
  PaperDatapoint,
  RuleAudit
} from './types.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickFallbackMove(legalMoves: LegalMoveOption[]): string {
  const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  return move?.san ?? '';
}

function getLegalMoveOptions(chess: Chess): LegalMoveOption[] {
  const verboseMoves = chess.moves({ verbose: true });
  return verboseMoves.map((move) => ({
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ''}`
  }));
}

type PaperRunHooks = {
  onDatapoint?: (datapoint: PaperDatapoint) => void;
  onGameComplete?: (summary: GamePaperSummary) => void;
};

function inferGamePhase(moveNumber: number): GamePhase {
  if (moveNumber <= 10) {
    return 'opening';
  }
  if (moveNumber <= 40) {
    return 'midgame';
  }
  return 'endgame';
}

function estimateMaterialBalance(chess: Chess): number {
  const board = chess.board();
  const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let balance = 0;
  for (const rank of board) {
    for (const piece of rank) {
      if (!piece) {
        continue;
      }
      const value = pieceValues[piece.type] ?? 0;
      balance += piece.color === 'w' ? value : -value;
    }
  }
  return balance;
}

function estimateWinProbability(materialBalance: number): number {
  const scaled = materialBalance / 10;
  return 1 / (1 + Math.exp(-scaled));
}

function clampCpl(cpl: number): number {
  if (!Number.isFinite(cpl)) {
    return 0;
  }
  return Math.max(0, Math.min(1000, cpl));
}

type GameOutcome = {
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: string;
};

const STARTING_POSITION_PREFIX = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function createRuleAudit(chess: Chess): RuleAudit {
  return {
    boardSetupValid: chess.fen().startsWith(STARTING_POSITION_PREFIX),
    kingPresenceValid: hasExactlyOneKingPerSide(chess),
    turnAlternationValid: true,
    legalMoveOnly: true,
    ownKingSafetyMaintained: true,
    castlingMoves: 0,
    enPassantCaptures: 0,
    promotions: 0,
    fallbackMovesUsed: 0,
    invalidModelMoveAttempts: 0
  };
}

function hasExactlyOneKingPerSide(chess: Chess): boolean {
  let whiteKings = 0;
  let blackKings = 0;
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece || piece.type !== 'k') {
        continue;
      }
      if (piece.color === 'w') {
        whiteKings += 1;
      } else {
        blackKings += 1;
      }
    }
  }
  return whiteKings === 1 && blackKings === 1;
}

function movedSideStillInCheck(chessAfterMove: Chess, side: 'white' | 'black'): boolean {
  const fenParts = chessAfterMove.fen().split(' ');
  if (fenParts.length < 6) {
    return true;
  }

  // When we change side-to-move only for audit purposes, the original en-passant
  // target square may become illegal for that synthetic position.
  fenParts[1] = side === 'white' ? 'w' : 'b';
  fenParts[3] = '-';

  try {
    const sideView = new Chess(fenParts.join(' '));
    return sideView.inCheck();
  } catch {
    return true;
  }
}

function updateRuleAuditAfterMove(
  audit: RuleAudit,
  chessAfterMove: Chess,
  moveFlags: string,
  side: 'white' | 'black',
  turnBeforeMove: 'w' | 'b'
): void {
  const expectedTurn = side === 'white' ? 'w' : 'b';
  if (turnBeforeMove !== expectedTurn || chessAfterMove.turn() === turnBeforeMove) {
    audit.turnAlternationValid = false;
  }

  if (moveFlags.includes('k') || moveFlags.includes('q')) {
    audit.castlingMoves += 1;
  }
  if (moveFlags.includes('e')) {
    audit.enPassantCaptures += 1;
  }
  if (moveFlags.includes('p')) {
    audit.promotions += 1;
  }

  if (movedSideStillInCheck(chessAfterMove, side)) {
    audit.ownKingSafetyMaintained = false;
  }

  audit.kingPresenceValid = audit.kingPresenceValid && hasExactlyOneKingPerSide(chessAfterMove);
}

export class SequentialGameRunner {
  private stockfishLoaded = false;
  private stockfishFactory: null | (() => {
    postMessage: (command: string) => void;
    onmessage?: (event: unknown) => void;
  }) = null;
  private stockfishAnalyzer: StockfishAnalyzer | null = null;
  private stockfishEvalDepth = 10;
  private gameLogger: GameLogger | null = null;

  constructor(private readonly ollamaBaseUrl: string) {
    this.stockfishAnalyzer = new StockfishAnalyzer();
    this.gameLogger = new GameLogger();
  }

  async run(config: BatchConfig): Promise<{ outputFile: string; summary: Record<string, unknown> }> {
    const startedAt = new Date();
    const results: GameResult[] = [];
    const outDir = path.resolve(config.outputDir);
    await mkdir(outDir, { recursive: true });
    const outputFile = path.join(outDir, `research-match-${Date.now()}.json`);
    const exportEvery = Math.max(1, config.settings.exportInterval || 1);

    console.log('NEUROCHESS SEQUENTIAL BATCH RUNNER');
    console.log(`Games: ${config.games}`);
    console.log(`Models: ${config.models.white} vs ${config.models.black}`);

    for (let gameIndex = 0; gameIndex < config.games; gameIndex += 1) {
      const gameId = `seq-game-${String(gameIndex + 1).padStart(3, '0')}`;
      console.log(`Game ${gameIndex + 1}/${config.games}: ${gameId}`);
      const gameResult = await this.runSingleGame(gameId, config);
      results.push(gameResult);

      if ((gameIndex + 1) % exportEvery === 0 || gameIndex === config.games - 1) {
        const partialSummary = {
          completedGames: results.length,
          totalGames: config.games,
          totalDurationMs: Date.now() - startedAt.getTime(),
          startedAt: startedAt.toISOString(),
          lastCheckpointAt: new Date().toISOString(),
          status: gameIndex === config.games - 1 ? 'completed' : 'in_progress'
        };
        await writeFile(outputFile, JSON.stringify({ summary: partialSummary, games: results }, null, 2), 'utf-8');
      }

      if (gameIndex < config.games - 1) {
        await sleep(config.settings.interGameDelayMs);
      }
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();

    const summary = {
      completedGames: results.length,
      totalDurationMs: durationMs,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString()
    };

    await writeFile(outputFile, JSON.stringify({ summary, games: results }, null, 2), 'utf-8');

    console.log('Batch complete.');
    console.log(`Completed games: ${results.length}`);
    console.log(`Total duration (ms): ${durationMs}`);
    console.log(`Output: ${outputFile}`);

    return { outputFile, summary };
  }

  private async runSingleGame(gameId: string, config: BatchConfig): Promise<GameResult> {
    const chess = new Chess();
    const startedAt = new Date();
    const deadline = startedAt.getTime() + config.settings.gameTimeoutMs;
    let timedOut = false;
    const ruleAudit = createRuleAudit(chess);

    while (!chess.isGameOver() && chess.history().length < config.settings.maxMoves) {
      if (Date.now() >= deadline) {
        timedOut = true;
        break;
      }

      const legalMoveOptions = getLegalMoveOptions(chess);
      if (legalMoveOptions.length === 0) {
        break;
      }

      const isWhiteTurn = chess.turn() === 'w';
      const model = isWhiteTurn ? config.models.white : config.models.black;
      const side = isWhiteTurn ? 'white' : 'black';
      const turnBeforeMove = chess.turn();

      const candidateMove =
        (await chooseMoveWithOllama(
          this.ollamaBaseUrl,
          model,
          chess.fen(),
          legalMoveOptions,
          config.settings.moveTimeoutMs
        )) ?? null;

      let chosenMove = candidateMove;
      if (!chosenMove || !legalMoveOptions.some((m) => m.san === chosenMove)) {
        ruleAudit.invalidModelMoveAttempts += 1;
        ruleAudit.fallbackMovesUsed += 1;
        ruleAudit.legalMoveOnly = false;
        chosenMove = pickFallbackMove(legalMoveOptions);
      }

      const moveResult = chess.move(chosenMove, { strict: true });
      if (!moveResult) {
        ruleAudit.fallbackMovesUsed += 1;
        ruleAudit.legalMoveOnly = false;
        const fallbackMove = pickFallbackMove(legalMoveOptions);
        const fallbackResult = chess.move(fallbackMove, { strict: true });
        if (!fallbackResult) {
          throw new Error(`Unable to apply legal move for ${gameId}`);
        }
        updateRuleAuditAfterMove(ruleAudit, chess, fallbackResult.flags, side, turnBeforeMove);
      } else {
        updateRuleAuditAfterMove(ruleAudit, chess, moveResult.flags, side, turnBeforeMove);
      }

      await sleep(config.settings.moveDelayMs);
    }

    const endedAt = new Date();
    const { result, termination } = this.determineGameOutcome(chess, config.settings.maxMoves, timedOut);

    return {
      gameId,
      whiteModel: config.models.white,
      blackModel: config.models.black,
      result,
      termination,
      moveCount: chess.history().length,
      pgn: chess.pgn(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      ruleAudit
    };
  }

  async runPaperBatch(
    config: BatchConfig,
    options: PaperCollectionOptions,
    hooks: PaperRunHooks = {}
  ): Promise<{ outputFile: string; summary: Record<string, unknown>; games: GamePaperSummary[] }> {
    const startedAt = new Date();
    const gameSummaries: GamePaperSummary[] = [];
    const outDir = path.resolve(config.outputDir);
    await mkdir(outDir, { recursive: true });
    const outputFile = path.join(outDir, `paper-research-match-${Date.now()}.json`);
    const exportEvery = Math.max(1, config.settings.exportInterval || 1);
    this.stockfishEvalDepth = Math.max(1, Math.floor(config.settings.stockfishEvalDepth ?? 10));

    if (this.stockfishAnalyzer) {
      this.stockfishAnalyzer.setAnalysisDepth(this.stockfishEvalDepth);
    }
    
    console.log(`\n📊 LOGGING ENABLED:`);
    console.log(`   - Run output: ${outputFile}`);
    if (this.gameLogger) {
      console.log(`   - Centralized log: ${this.gameLogger.getLogPath()}`);
      console.log(`   - Format: JSONL (one game per line, crash-safe)\n`);
    }

    for (let gameIndex = 0; gameIndex < config.games; gameIndex += 1) {
      const gameId = `paper-game-${String(gameIndex + 1).padStart(3, '0')}`;
      const game = await this.runSinglePaperGame(gameId, gameIndex + 1, config, options, hooks.onDatapoint);
      gameSummaries.push(game);
      
      // 🔥 LOG EVERY GAME IMMEDIATELY (crash-safe)
      if (this.gameLogger) {
        await this.gameLogger.logGame(game, {
          runType: 'paper',
          matchup: `${config.models.white} vs ${config.models.black}`,
          gameIndex: gameIndex + 1,
          totalGames: config.games
        });
      }
      
      hooks.onGameComplete?.(game);

      if ((gameIndex + 1) % exportEvery === 0 || gameIndex === config.games - 1) {
        const partialSummary = {
          completedGames: gameSummaries.length,
          totalGames: config.games,
          totalDurationMs: Date.now() - startedAt.getTime(),
          startedAt: startedAt.toISOString(),
          lastCheckpointAt: new Date().toISOString(),
          whiteModel: config.models.white,
          blackModel: config.models.black,
          status: gameIndex === config.games - 1 ? 'completed' : 'in_progress'
        };
        await writeFile(outputFile, JSON.stringify({ summary: partialSummary, games: gameSummaries }, null, 2), 'utf-8');
      }
      
      if (gameIndex < config.games - 1) {
        await sleep(config.settings.interGameDelayMs);
      }
    }

    const endedAt = new Date();
    const summary = {
      completedGames: gameSummaries.length,
      totalDurationMs: endedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      whiteModel: config.models.white,
      blackModel: config.models.black
    };

    await writeFile(outputFile, JSON.stringify({ summary, games: gameSummaries }, null, 2), 'utf-8');
    
    console.log(`\n✅ BATCH COMPLETE!`);
    console.log(`   Games completed: ${gameSummaries.length}/${config.games}`);
    console.log(`   Total duration: ${Math.round(summary.totalDurationMs / 1000)}s`);
    console.log(`   Run output: ${outputFile}`);
    if (this.gameLogger) {
      console.log(`   Backup log: ${this.gameLogger.getLogPath()}`);
    }
    
    return { outputFile, summary, games: gameSummaries };
  }

  private async runSinglePaperGame(
    gameId: string,
    gameIndex: number,
    config: BatchConfig,
    options: PaperCollectionOptions,
    onDatapoint?: (datapoint: PaperDatapoint) => void
  ): Promise<GamePaperSummary> {
    const chess = new Chess();
    const startedAt = new Date();
    const deadline = startedAt.getTime() + config.settings.gameTimeoutMs;
    let timedOut = false;
    const ruleAudit = createRuleAudit(chess);

    const whiteCpl: number[] = [];
    const blackCpl: number[] = [];

    while (!chess.isGameOver() && chess.history().length < config.settings.maxMoves) {
      if (Date.now() >= deadline) {
        timedOut = true;
        break;
      }

      const legalMoveOptions = getLegalMoveOptions(chess);
      if (legalMoveOptions.length === 0) {
        break;
      }

      const moveNumber = chess.history().length + 1;
      const side = chess.turn() === 'w' ? 'white' : 'black';
      const model = side === 'white' ? config.models.white : config.models.black;
      const turnBeforeMove = chess.turn();

      const fenBefore = chess.fen();
      const detail = await chooseMoveWithOllamaDetailed(
        this.ollamaBaseUrl,
        model,
        fenBefore,
        legalMoveOptions,
        config.settings.moveTimeoutMs
      );

      let chosenMove = detail.move;
      let illegalSuggestion = false;
      let correctionApplied = false;
      if (!chosenMove || !legalMoveOptions.some((m) => m.san === chosenMove)) {
        ruleAudit.invalidModelMoveAttempts += 1;
        ruleAudit.fallbackMovesUsed += 1;
        ruleAudit.legalMoveOnly = false;
        illegalSuggestion = true;
        correctionApplied = true;
        chosenMove = pickFallbackMove(legalMoveOptions);
      }

      const moveResult = chess.move(chosenMove, { strict: true });
      if (!moveResult) {
        ruleAudit.fallbackMovesUsed += 1;
        ruleAudit.legalMoveOnly = false;
        illegalSuggestion = true;
        correctionApplied = true;
        const fallbackMove = pickFallbackMove(legalMoveOptions);
        const fallbackResult = chess.move(fallbackMove, { strict: true });
        if (!fallbackResult) {
          throw new Error(`Unable to apply legal move for ${gameId}`);
        }
        updateRuleAuditAfterMove(ruleAudit, chess, fallbackResult.flags, side, turnBeforeMove);
        chosenMove = fallbackMove;
      } else {
        updateRuleAuditAfterMove(ruleAudit, chess, moveResult.flags, side, turnBeforeMove);
      }

      const fenAfter = chess.fen();

      const cpl = options.enabled ? await this.computeCpl(fenBefore, chosenMove, fenAfter) : 0;
      const clampedCpl = clampCpl(cpl);
      if (side === 'white') {
        whiteCpl.push(clampedCpl);
      } else {
        blackCpl.push(clampedCpl);
      }

      const materialBalance = estimateMaterialBalance(chess);
      const blunderThresholdCp = Math.max(1, Math.floor(config.settings.blunderThresholdCp ?? 200));

      const datapoint: PaperDatapoint = {
        gameId,
        gameIndex,
        moveNumber,
        side,
        model,
        timestamp: Date.now(),
        fenBefore,
        fenAfter,
        move: chosenMove,
        legalMoves: legalMoveOptions.map((m) => m.san),
        reasoning: options.trackReasoning ? detail.reasoning : '',
        confidence: options.trackConfidence ? detail.confidence : 0.5,
        cpl: clampedCpl,
        gamePhase: inferGamePhase(moveNumber),
        materialBalance,
        isCritical: clampedCpl >= blunderThresholdCp,
        winProbability: estimateWinProbability(materialBalance),
        illegalSuggestion,
        correctionApplied
      };

      onDatapoint?.(datapoint);
      await sleep(config.settings.moveDelayMs);
    }

    const endedAt = new Date();
    const { result, termination } = this.determineGameOutcome(chess, config.settings.maxMoves, timedOut);

    const avgWhite = whiteCpl.length > 0 ? whiteCpl.reduce((a, b) => a + b, 0) / whiteCpl.length : 0;
    const avgBlack = blackCpl.length > 0 ? blackCpl.reduce((a, b) => a + b, 0) / blackCpl.length : 0;

    return {
      gameId,
      gameIndex,
      whiteModel: config.models.white,
      blackModel: config.models.black,
      result,
      termination,
      moveCount: chess.history().length,
      pgn: chess.pgn(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      averageCplWhite: avgWhite,
      averageCplBlack: avgBlack,
      ruleAudit
    };
  }

  private async computeCpl(fenBefore: string, move: string, fenAfter: string): Promise<number> {
    // Try new Stockfish analyzer first
    if (this.stockfishAnalyzer) {
      try {
        await this.stockfishAnalyzer.initialize();
        this.stockfishAnalyzer.setAnalysisDepth(this.stockfishEvalDepth);
        const cpl = await this.stockfishAnalyzer.computeCPL(fenBefore, move);
        return cpl;
      } catch (error) {
        console.warn('Stockfish analysis failed, using fallback');
      }
    }

    // Fallback to old method
    const stockfishDelta = await this.tryStockfishDelta(fenBefore, fenAfter);
    if (stockfishDelta !== null) {
      return Math.abs(stockfishDelta);
    }

    // Heuristic fallback if stockfish is unavailable: penalize if move creates immediate tactical danger.
    const before = new Chess(fenBefore);
    const after = new Chess(fenAfter);
    const beforeChecks = before.inCheck() ? 1 : 0;
    const afterChecks = after.inCheck() ? 1 : 0;
    const mobilityPenalty = Math.max(0, before.moves().length - after.moves().length);
    const syntaxPenalty = /[+#]$/.test(move) ? -20 : 20;
    return Math.max(0, beforeChecks * 60 + afterChecks * 80 + mobilityPenalty * 3 + syntaxPenalty);
  }

  private determineGameOutcome(chess: Chess, maxMoves: number, timedOut: boolean): GameOutcome {
    if (chess.isCheckmate()) {
      // White to move means white was checkmated, so black won.
      return {
        result: chess.turn() === 'w' ? '0-1' : '1-0',
        termination: 'checkmate'
      };
    }

    if (chess.isStalemate()) {
      return { result: '1/2-1/2', termination: 'stalemate' };
    }

    if (chess.isInsufficientMaterial()) {
      return { result: '1/2-1/2', termination: 'insufficient_material' };
    }

    if (chess.isThreefoldRepetition()) {
      return { result: '1/2-1/2', termination: 'threefold_repetition' };
    }

    if (timedOut) {
      const materialBalance = estimateMaterialBalance(chess);
      if (materialBalance > 2) {
        return { result: '1-0', termination: 'timeout_white_ahead' };
      }
      if (materialBalance < -2) {
        return { result: '0-1', termination: 'timeout_black_ahead' };
      }
      return { result: '1/2-1/2', termination: 'timeout_draw' };
    }

    if (chess.history().length >= maxMoves) {
      const materialBalance = estimateMaterialBalance(chess);
      if (materialBalance > 2) {
        return { result: '1-0', termination: 'max_moves_white_ahead' };
      }
      if (materialBalance < -2) {
        return { result: '0-1', termination: 'max_moves_black_ahead' };
      }
      return { result: '1/2-1/2', termination: 'max_moves_draw' };
    }

    return { result: '1/2-1/2', termination: 'unknown' };
  }

  private async tryStockfishDelta(fenBefore: string, fenAfter: string): Promise<number | null> {
    try {
      await this.ensureStockfishLoaded();
      if (!this.stockfishFactory) {
        return null;
      }

      const beforeEval = await this.evaluateWithStockfish(fenBefore);
      const afterEval = await this.evaluateWithStockfish(fenAfter);
      return afterEval - beforeEval;
    } catch {
      return null;
    }
  }

  private async ensureStockfishLoaded(): Promise<void> {
    if (this.stockfishLoaded) {
      return;
    }
    this.stockfishLoaded = true;

    try {
      const mod = (await import('stockfish')) as unknown;
      const candidate = mod as {
        default?: () => { postMessage: (command: string) => void; onmessage?: (event: unknown) => void };
      };
      this.stockfishFactory = typeof candidate.default === 'function' ? candidate.default : null;
    } catch {
      this.stockfishFactory = null;
    }
  }

  private async evaluateWithStockfish(fen: string): Promise<number> {
    if (!this.stockfishFactory) {
      throw new Error('stockfish unavailable');
    }

    const engine = this.stockfishFactory();

    return await new Promise<number>((resolve) => {
      const timeout = setTimeout(() => resolve(0), 1000);

      engine.onmessage = (event: unknown) => {
        const raw = typeof event === 'string' ? event : String(event);
        const cp = raw.match(/score cp (-?\d+)/);
        if (cp?.[1]) {
          clearTimeout(timeout);
          resolve(Number(cp[1]));
          return;
        }

        const mate = raw.match(/score mate (-?\d+)/);
        if (mate?.[1]) {
          clearTimeout(timeout);
          const sign = Number(mate[1]) >= 0 ? 1 : -1;
          resolve(sign * 1000);
        }
      };

      engine.postMessage('uci');
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${this.stockfishEvalDepth}`);
    });
  }
}
