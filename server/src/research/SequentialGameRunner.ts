// Active compatibility runner for the current paper pipeline.
// The modular runner files are the long-term architecture, but this file
// remains the production execution path until the migration is complete.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Chess } from 'chess.js';
import {
  chooseMoveWithOllama,
  chooseMoveWithOllamaDetailed,
  chooseMoveWithGroq,
  type OllamaMoveResponse
} from './ollama.js';
import { StockfishAnalyzer } from './StockfishAnalyzer.js';
import { GameLogger } from './GameLogger.js';
import { chooseFallbackMove } from './runner/FallbackPolicy.js';
import { GroqKeyPool } from './model_backends/GroqKeyPool.js';
import type { LegalMoveOption } from './types/move.js';
import type {
  BatchConfig,
  BindingProfile,
  GamePaperSummary,
  GamePhase,
  GameResult,
  IllegalMoveFailureMode,
  PaperCollectionOptions,
  PaperDatapoint,
  RuleAudit
} from './types.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePositionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function getLegalMoveOptions(chess: Chess): LegalMoveOption[] {
  const verboseMoves = chess.moves({ verbose: true });
  return verboseMoves.map((move) => ({
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ''}`,
    flags: move.flags,
    piece: move.piece,
    isCapture: move.flags.includes('c') || move.flags.includes('e'),
    isPawnMove: move.piece === 'p'
  }));
}

function isImmediateReverse(previousMoveUci: string | null, nextMoveUci: string): boolean {
  if (!previousMoveUci || previousMoveUci.length < 4 || nextMoveUci.length < 4) {
    return false;
  }
  return (
    previousMoveUci.slice(0, 2) === nextMoveUci.slice(2, 4) &&
    previousMoveUci.slice(2, 4) === nextMoveUci.slice(0, 2)
  );
}

function buildSimulatedFenByMove(chess: Chess, legalMoves: LegalMoveOption[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const move of legalMoves) {
    try {
      const clone = new Chess(chess.fen());
      const applied = clone.move(move.san, { strict: true });
      if (applied) {
        map[move.uci] = normalizePositionKey(clone.fen());
      }
    } catch {
      // ignore simulation failures
    }
  }
  return map;
}

type MoveRiskSnapshot = {
  reversesLastMove: boolean;
  recreatesPriorFen: boolean;
  noProgressRisk: boolean;
  repeatStateCountAfterMove: number;
};

function recordFenCount(seenFenCounts: Map<string, number>, fen: string): void {
  const key = normalizePositionKey(fen);
  seenFenCounts.set(key, (seenFenCounts.get(key) ?? 0) + 1);
}

function pushRecentMove(recentMoves: string[], moveUci: string, window: number): void {
  recentMoves.push(moveUci);
  while (recentMoves.length > window) {
    recentMoves.shift();
  }
}

function moveContinuesNoProgress(move: LegalMoveOption): boolean {
  return !move.isCapture && !move.isPawnMove;
}

function buildMoveRiskSnapshots(
  legalMoves: LegalMoveOption[],
  simulatedFenByMove: Record<string, string>,
  seenFenCounts: Map<string, number>,
  lastMoveUci: string | null,
  noProgressStreak: number,
  maxNoProgressPlies: number
): MoveRiskSnapshot[] {
  return legalMoves.map((move) => {
    const nextFen = simulatedFenByMove[move.uci];
    const repeatStateCountAfterMove = nextFen ? (seenFenCounts.get(nextFen) ?? 0) : 0;
    return {
      reversesLastMove: isImmediateReverse(lastMoveUci, move.uci),
      recreatesPriorFen: repeatStateCountAfterMove > 0,
      noProgressRisk: moveContinuesNoProgress(move) && noProgressStreak + 1 >= maxNoProgressPlies,
      repeatStateCountAfterMove
    };
  });
}

function riskScore(risk: MoveRiskSnapshot): number {
  return (
    (risk.reversesLastMove ? 4 : 0) +
    (risk.recreatesPriorFen ? 4 : 0) +
    (risk.noProgressRisk ? 2 : 0) +
    risk.repeatStateCountAfterMove
  );
}

function hasSaferAlternative(selectedIndex: number, risks: MoveRiskSnapshot[]): boolean {
  const selected = risks[selectedIndex];
  if (!selected) {
    return false;
  }
  const selectedScore = riskScore(selected);
  return risks.some((risk, index) => index !== selectedIndex && riskScore(risk) < selectedScore);
}

function isBadOscillationChoice(selectedIndex: number, risks: MoveRiskSnapshot[]): boolean {
  const selected = risks[selectedIndex];
  if (!selected) {
    return false;
  }
  if (!selected.reversesLastMove && !selected.recreatesPriorFen && !selected.noProgressRisk) {
    return false;
  }
  return hasSaferAlternative(selectedIndex, risks);
}

function determineCollapseReason(
  ruleAudit: RuleAudit,
  termination: string,
  moveCount: number,
  maxNoProgressPlies: number
): 'repeat_state' | 'reverse_loop' | 'fallback_loop' | 'no_progress' | null {
  if (termination === 'threefold_repetition' || ruleAudit.repeatStateCount >= 3) {
    return 'repeat_state';
  }
  if (ruleAudit.noProgressMaxStreak >= maxNoProgressPlies) {
    return 'no_progress';
  }
  if (ruleAudit.oscillationOverrideCount >= 2 && ruleAudit.fallbackMovesUsed >= 2) {
    return 'fallback_loop';
  }
  if (moveCount > 0 && ruleAudit.reverseMoveCount >= Math.max(6, Math.floor(moveCount * 0.15))) {
    return 'reverse_loop';
  }
  return null;
}

type PaperRunHooks = {
  onDatapoint?: (datapoint: PaperDatapoint) => void;
  onGameComplete?: (summary: GamePaperSummary) => void;
};

// Seeded PRNG — mulberry32
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(42);

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

function createRuleAudit(chess: Chess, openingRandomMoves: number = 0): RuleAudit {
  return {
    // If we applied random opening moves, the board no longer matches the initial FEN.
    // Treat setup as valid unless we explicitly started from a broken position.
    boardSetupValid:
      openingRandomMoves > 0 ? true : chess.fen().startsWith(STARTING_POSITION_PREFIX),
    kingPresenceValid: hasExactlyOneKingPerSide(chess),
    turnAlternationValid: true,
    legalMoveOnly: true,
    ownKingSafetyMaintained: true,
    castlingMoves: 0,
    enPassantCaptures: 0,
    promotions: 0,
    fallbackMovesUsed: 0,
    invalidModelMoveAttempts: 0,
    illegalMoveAttempts: 0,
    retryAttempts: 0,
    retrySuccesses: 0,
    invalidMoveFailureModes: {},
    bindingAttemptCount: 0,
    bindingBoundCountTotal: 0,
    reverseMoveCount: 0,
    repeatStateCount: 0,
    noProgressCount: 0,
    noProgressMaxStreak: 0,
    oscillationRejectedCount: 0,
    oscillationOverrideCount: 0,
    behaviorallyStable: true,
    collapseDetected: false,
    collapseReason: null,
    bindingComponentHits: {
      piece: 0,
      origin: 0,
      destination: 0,
      legalConstraint: 0
    }
  };
}

function incrementFailureMode(audit: RuleAudit, mode: IllegalMoveFailureMode | null): void {
  if (!mode) {
    return;
  }
  const current = audit.invalidMoveFailureModes[mode] ?? 0;
  audit.invalidMoveFailureModes[mode] = current + 1;
}

function accumulateBindingProfile(audit: RuleAudit, profile: BindingProfile | null): void {
  if (!profile) {
    return;
  }
  audit.bindingAttemptCount += 1;
  audit.bindingBoundCountTotal += profile.boundCount;
  if (profile.hasPiece) {
    audit.bindingComponentHits.piece += 1;
  }
  if (profile.hasOrigin) {
    audit.bindingComponentHits.origin += 1;
  }
  if (profile.hasDestination) {
    audit.bindingComponentHits.destination += 1;
  }
  if (profile.hasLegalConstraint) {
    audit.bindingComponentHits.legalConstraint += 1;
  }
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
  private activeModels: string[] = [];
  private stockfishAnalyzer: StockfishAnalyzer | null = null;
  private stockfishEvalDepth = 10;
  private gameLogger: GameLogger | null = null;
  private groqKeyPool: GroqKeyPool;
  private cplCache = new Map<string, number>();

  constructor(private readonly ollamaBaseUrl: string) {
    this.stockfishAnalyzer = new StockfishAnalyzer();
    this.gameLogger = new GameLogger();
    this.groqKeyPool = GroqKeyPool.fromEnvironment();
  }

  setRunDirectory(runDir: string): void {
    this.gameLogger?.setRunDirectory(runDir);
  }

  private async getMoveDetailed(
    model: string,
    fen: string,
    legalMoveOptions: LegalMoveOption[],
    timeoutMs: number,
    strict: boolean = false,
    mode: 'constrained_index' | 'free_generation' = 'constrained_index',
    context?: {
      recentMoves?: string[];
      repetitionRiskByIndex?: boolean[];
      avoidImmediateRepetition?: boolean;
    },
    providerPolicy?: {
      providerRetryCount?: number;
      providerBackoffMs?: number;
      maxTotalProviderWaitMs?: number;
    }
  ): Promise<OllamaMoveResponse> {
    const maxProviderRetries = Math.max(0, providerPolicy?.providerRetryCount ?? 3);
    const baseBackoffMs = Math.max(0, providerPolicy?.providerBackoffMs ?? 2000);
    const maxTotalProviderWaitMs = Math.max(0, providerPolicy?.maxTotalProviderWaitMs ?? 30000);

    let providerRetries = 0;
    let providerWaitMs = 0;
    let lastResult: OllamaMoveResponse | null = null;

    while (providerRetries <= maxProviderRetries) {
      if (model.startsWith('groq:')) {
        if (!this.groqKeyPool.hasKeys()) {
          throw new Error('GROQ_API_KEY(S) not set but groq: model requested');
        }
        const lease = await this.groqKeyPool.lease();
        const groqModel = model.replace('groq:', '');
        const result = await chooseMoveWithGroq(
          lease.key,
          groqModel,
          fen,
          legalMoveOptions,
          timeoutMs,
          strict,
          mode,
          {
            ...context,
            keyId: lease.keyId
          }
        );
        result.keyId = lease.keyId;
        result.providerRetries = providerRetries;
        result.providerWaitMs = providerWaitMs;
        lastResult = result;

        if (result.failureMode === 'rate_limited') {
          this.groqKeyPool.releaseRateLimited(lease.keyId, result.retryAfterMs ?? baseBackoffMs);
        } else if (result.failureMode === 'request_failed' || result.failureMode === 'timeout_or_abort') {
          this.groqKeyPool.releaseFailure(lease.keyId);
        } else {
          this.groqKeyPool.releaseSuccess(lease.keyId);
        }
      } else {
        const result = await chooseMoveWithOllamaDetailed(
          this.ollamaBaseUrl,
          model,
          fen,
          legalMoveOptions,
          timeoutMs,
          strict,
          mode,
          context
        );
        result.providerRetries = providerRetries;
        result.providerWaitMs = providerWaitMs;
        lastResult = result;
      }

      const shouldRetryProviderFailure =
        lastResult.failureMode === 'rate_limited' ||
        lastResult.failureMode === 'request_failed' ||
        lastResult.failureMode === 'timeout_or_abort';

      if (!shouldRetryProviderFailure || providerRetries >= maxProviderRetries) {
        break;
      }

      const waitMs = Math.min(
        maxTotalProviderWaitMs - providerWaitMs,
        Math.max(250, lastResult.retryAfterMs ?? baseBackoffMs * (providerRetries + 1))
      );
      if (waitMs <= 0) {
        break;
      }
      await sleep(waitMs);
      providerWaitMs += waitMs;
      providerRetries += 1;
    }

    if (!lastResult) {
      throw new Error(`No move result available for model ${model}`);
    }

    return lastResult;
  }

  private async getMoveString(
    model: string,
    fen: string,
    legalMoveOptions: LegalMoveOption[],
    timeoutMs: number,
    mode: 'constrained_index' | 'free_generation' = 'constrained_index',
    context?: {
      recentMoves?: string[];
      repetitionRiskByIndex?: boolean[];
      avoidImmediateRepetition?: boolean;
    },
    providerPolicy?: {
      providerRetryCount?: number;
      providerBackoffMs?: number;
      maxTotalProviderWaitMs?: number;
    }
  ): Promise<string | null> {
    const detail = await this.getMoveDetailed(
      model,
      fen,
      legalMoveOptions,
      timeoutMs,
      false,
      mode,
      context,
      providerPolicy
    );
    return detail.move;
  }

  private async assertOllamaAvailable(): Promise<void> {
    // If every model in this run is a Groq-prefixed model, skip the Ollama ping.
    // Groq calls use the OpenAI API and do not require a local Ollama daemon.
    if (this.currentModelsAreGroqOnly) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.ollamaBaseUrl}/api/tags`, { method: 'GET', signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Ollama health check failed (HTTP ${res.status})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Ollama not reachable at ${this.ollamaBaseUrl}: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // Helper that returns true when the active models are all groq:* (no local Ollama needed)
  private get currentModelsAreGroqOnly(): boolean {
    const models = this.activeModels ?? [];
    if (models.length === 0) return false;
    return models.every((m) => m.startsWith('groq:'));
  }

  async run(config: BatchConfig): Promise<{ outputFile: string; summary: Record<string, unknown> }> {
    const startedAt = new Date();
    this.activeModels = [config.models.white, config.models.black];
    this.cplCache.clear();
    const results: GameResult[] = [];
    const outDir = path.resolve(config.outputDir);
    await mkdir(outDir, { recursive: true });
    const outputFile = path.join(outDir, `research-match-${Date.now()}.json`);
    const exportEvery = Math.max(1, config.settings.exportInterval || 1);

    try {
      await this.assertOllamaAvailable();
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
      await this.gameLogger?.writeRunSummary({
        summary,
        outputFile,
        whiteModel: config.models.white,
        blackModel: config.models.black,
        runType: 'batch'
      });

      console.log('Batch complete.');
      console.log(`Completed games: ${results.length}`);
      console.log(`Total duration (ms): ${durationMs}`);
      console.log(`Output: ${outputFile}`);

      return { outputFile, summary };
    } finally {
      await this.stockfishAnalyzer?.shutdown();
    }
  }

  private async runSingleGame(gameId: string, config: BatchConfig): Promise<GameResult> {
    const chess = new Chess();
    const openingRandomMoves = config.settings.openingRandomMoves ?? 4;
    const seenFens = new Set<string>([normalizePositionKey(chess.fen())]);
    const seenFenCounts = new Map<string, number>();
    recordFenCount(seenFenCounts, chess.fen());
    const recentMoves: string[] = [];
    const recentMoveWindow = Math.max(1, config.settings.recentMoveWindow ?? 6);
    const maxNoProgressPlies = Math.max(1, config.settings.maxNoProgressPlies ?? 12);
    const avoidImmediateRepetition = config.settings.avoidImmediateRepetition ?? true;
    const antiOscillation = config.settings.antiOscillation ?? true;
    const liveCplEnabled = config.settings.enableLiveCpl ?? false;
    let lastMoveUci: string | null = null;
    let noProgressStreak = 0;
    for (let i = 0; i < openingRandomMoves; i += 1) {
      const moves = getLegalMoveOptions(chess);
      if (moves.length === 0) break;
      const pick = moves[Math.floor(rng() * moves.length)];
      const applied = chess.move(pick.san);
      if (applied) {
        lastMoveUci = `${applied.from}${applied.to}${applied.promotion ?? ''}`;
        pushRecentMove(recentMoves, lastMoveUci, recentMoveWindow);
        noProgressStreak = moveContinuesNoProgress(pick) ? noProgressStreak + 1 : 0;
        seenFens.add(normalizePositionKey(chess.fen()));
        recordFenCount(seenFenCounts, chess.fen());
      }
    }
    const startedAt = new Date();
    const deadline = startedAt.getTime() + config.settings.gameTimeoutMs;
    let timedOut = false;
    const ruleAudit = createRuleAudit(chess, openingRandomMoves);

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
      const simulatedFenByMove = buildSimulatedFenByMove(chess, legalMoveOptions);
      const moveRisks = buildMoveRiskSnapshots(
        legalMoveOptions,
        simulatedFenByMove,
        seenFenCounts,
        lastMoveUci,
        noProgressStreak,
        maxNoProgressPlies
      );
      const repetitionRiskByMove = Object.fromEntries(
        legalMoveOptions.map((move, index) => [move.uci, moveRisks[index]!])
      );
      const repetitionRiskByIndex = moveRisks.map(
        (risk) => risk.reversesLastMove || risk.recreatesPriorFen || risk.noProgressRisk
      );

        const candidateMove =
          (await this.getMoveString(
            model,
            chess.fen(),
            legalMoveOptions,
          config.settings.moveTimeoutMs,
          config.mode === 'free_generation' ? 'free_generation' : 'constrained_index',
            {
              recentMoves: [...recentMoves],
              repetitionRiskByIndex,
              avoidImmediateRepetition
            },
            {
              providerRetryCount: config.settings.providerRetryCount,
              providerBackoffMs: config.settings.providerBackoffMs,
              maxTotalProviderWaitMs: config.settings.maxTotalProviderWaitMs
            }
          )) ?? null;

      let chosenMove = candidateMove;
      const chosenMoveIndex = chosenMove
        ? legalMoveOptions.findIndex((move) => move.san === chosenMove)
        : -1;
      const chosenRisk =
        chosenMoveIndex >= 0 ? moveRisks[chosenMoveIndex] : null;
      const oscillationRejected =
        antiOscillation &&
        chosenMoveIndex >= 0 &&
        chosenRisk !== null &&
        isBadOscillationChoice(chosenMoveIndex, moveRisks);
      if (!chosenMove || !legalMoveOptions.some((m) => m.san === chosenMove)) {
        ruleAudit.invalidModelMoveAttempts += 1;
        ruleAudit.fallbackMovesUsed += 1;
        incrementFailureMode(ruleAudit, 'pseudo_legal_or_illegal');
        chosenMove = chooseFallbackMove({
          legalMoves: legalMoveOptions,
          policy: config.settings.fallbackPolicy ?? 'deterministic_first',
          rngSeed: config.settings.seed,
          lastMoveUci,
          previousFenSet: seenFens,
          simulatedFenByMove,
          repetitionRiskByMove
        }).move;
      } else if (oscillationRejected) {
        ruleAudit.oscillationRejectedCount += 1;
        ruleAudit.oscillationOverrideCount += 1;
        ruleAudit.fallbackMovesUsed += 1;
        chosenMove = chooseFallbackMove({
          legalMoves: legalMoveOptions,
          policy: config.settings.fallbackPolicy ?? 'deterministic_first',
          rngSeed: config.settings.seed,
          lastMoveUci,
          previousFenSet: seenFens,
          simulatedFenByMove,
          repetitionRiskByMove
        }).move;
      }

      const moveResult = chess.move(chosenMove, { strict: true });
      if (!moveResult) {
        ruleAudit.legalMoveOnly = false;
        throw new Error(`Chosen move ${chosenMove} could not be applied for ${gameId}`);
      }
      chosenMove = moveResult.san;

      updateRuleAuditAfterMove(ruleAudit, chess, moveResult.flags, side, turnBeforeMove);
      lastMoveUci = `${moveResult.from}${moveResult.to}${moveResult.promotion ?? ''}`;
      pushRecentMove(recentMoves, lastMoveUci, recentMoveWindow);
      seenFens.add(normalizePositionKey(chess.fen()));
      recordFenCount(seenFenCounts, chess.fen());
      const finalMoveIndex = legalMoveOptions.findIndex((move) => move.san === chosenMove);
      const finalRisk = finalMoveIndex >= 0 ? moveRisks[finalMoveIndex] : null;
      if (finalRisk?.reversesLastMove) {
        ruleAudit.reverseMoveCount += 1;
      }
      if (finalRisk?.recreatesPriorFen) {
        ruleAudit.repeatStateCount += 1;
      }
      const finalMoveOption = finalMoveIndex >= 0 ? legalMoveOptions[finalMoveIndex] : null;
      if (finalMoveOption && moveContinuesNoProgress(finalMoveOption)) {
        noProgressStreak += 1;
        ruleAudit.noProgressCount += 1;
      } else {
        noProgressStreak = 0;
      }
      ruleAudit.noProgressMaxStreak = Math.max(ruleAudit.noProgressMaxStreak, noProgressStreak);

      await sleep(config.settings.moveDelayMs);
    }

    const endedAt = new Date();
    const { result, termination } = this.determineGameOutcome(chess, config.settings.maxMoves, timedOut);
    const collapseReason = determineCollapseReason(
      ruleAudit,
      termination,
      chess.history().length,
      maxNoProgressPlies
    );
    ruleAudit.collapseReason = collapseReason;
    ruleAudit.collapseDetected = collapseReason !== null;
    ruleAudit.behaviorallyStable = !ruleAudit.collapseDetected;

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
      reverseMoveCount: ruleAudit.reverseMoveCount,
      repeatStateCount: ruleAudit.repeatStateCount,
      noProgressMaxStreak: ruleAudit.noProgressMaxStreak,
      collapseDetected: ruleAudit.collapseDetected,
      collapseReason: ruleAudit.collapseReason,
      ruleAudit
    };
  }

  async runPaperBatch(
    config: BatchConfig,
    options: PaperCollectionOptions,
    hooks: PaperRunHooks = {}
  ): Promise<{ outputFile: string; summary: Record<string, unknown>; games: GamePaperSummary[] }> {
    const startedAt = new Date();
    rng = mulberry32(config.settings.seed ?? (config as any).seed ?? 42);
    const openingRandomMoves = config.settings.openingRandomMoves ?? 4;
    this.activeModels = [config.models.white, config.models.black];
    const gameSummaries: GamePaperSummary[] = [];
    const outDir = path.resolve(config.outputDir);
    await mkdir(outDir, { recursive: true });
    const outputFile = path.join(outDir, `paper-research-match-${Date.now()}.json`);
    const exportEvery = Math.max(1, config.settings.exportInterval || 1);
    this.stockfishEvalDepth = Math.max(1, Math.floor(config.settings.stockfishEvalDepth ?? 10));
    this.cplCache.clear();
    try {
      await this.assertOllamaAvailable();
      // Warm models once to avoid cold-start timeouts on the first ply.
      const warmupModels = new Set<string>([config.models.white, config.models.black]);
      await Promise.all(
        Array.from(warmupModels).map(async (model) => {
          try {
            const warmChess = new Chess();
            const legal = warmChess.moves({ verbose: true }).slice(0, 10).map((m) => ({
              san: m.san,
              uci: `${m.from}${m.to}${m.promotion ?? ''}`
            }));
            await this.getMoveString(model, warmChess.fen(), legal, config.settings.moveTimeoutMs);
            console.log(`   - Warmed model ${model}`);
          } catch (e) {
            console.warn(`   - Warmup failed for model ${model}: ${String(e)}`);
          }
        })
      );
      if (this.stockfishAnalyzer) {
        this.stockfishAnalyzer.setAnalysisDepth(this.stockfishEvalDepth);
      }
    
    console.log(`\n📊 LOGGING ENABLED:`);
    console.log(`   - Run output: ${outputFile}`);
    if (this.gameLogger) {
      console.log(`   - Run log: ${this.gameLogger.getLogPath()}`);
      console.log(`   - Format: JSONL (one game per line, crash-safe)\n`);
    }
    const describeProvider = (model: string) =>
      model.startsWith('groq:') ? 'Groq (cloud, OpenAI-compatible)' : 'Ollama (local)';
    console.log(`   - White model: ${config.models.white} [${describeProvider(config.models.white)}]`);
    console.log(`   - Black model: ${config.models.black} [${describeProvider(config.models.black)}]`);
    console.log(
      `   - Timeouts: move=${config.settings.moveTimeoutMs}ms, game=${config.settings.gameTimeoutMs}ms, maxMoves=${config.settings.maxMoves}`
    );

    for (let gameIndex = 0; gameIndex < config.games; gameIndex += 1) {
      const gameId = `paper-game-${String(gameIndex + 1).padStart(3, '0')}`;
      const game = await this.runSinglePaperGame(
        gameId,
        gameIndex + 1,
        { ...config, settings: { ...config.settings, openingRandomMoves } },
        options,
        hooks.onDatapoint
      );
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
      console.log(`   Run log: ${this.gameLogger.getLogPath()}`);
    }
    await this.gameLogger?.writeRunSummary({
      summary,
      outputFile,
      whiteModel: config.models.white,
      blackModel: config.models.black,
      runType: 'paper',
      totalGames: gameSummaries.length
    });
    
      return { outputFile, summary, games: gameSummaries };
    } finally {
      await this.stockfishAnalyzer?.shutdown();
    }
  }

  private async runSinglePaperGame(
    gameId: string,
    gameIndex: number,
    config: BatchConfig,
    options: PaperCollectionOptions,
    onDatapoint?: (datapoint: PaperDatapoint) => void
  ): Promise<GamePaperSummary> {
    const chess = new Chess();
    const openingRandomMoves = config.settings.openingRandomMoves ?? 4;
    const seenFens = new Set<string>([normalizePositionKey(chess.fen())]);
    const seenFenCounts = new Map<string, number>();
    recordFenCount(seenFenCounts, chess.fen());
    const recentMoves: string[] = [];
    const recentMoveWindow = Math.max(1, config.settings.recentMoveWindow ?? 6);
    const maxNoProgressPlies = Math.max(1, config.settings.maxNoProgressPlies ?? 12);
    const avoidImmediateRepetition = config.settings.avoidImmediateRepetition ?? true;
    const antiOscillation = config.settings.antiOscillation ?? true;
    const liveCplEnabled = config.settings.enableLiveCpl ?? false;
    let lastMoveUci: string | null = null;
    let noProgressStreak = 0;
    for (let i = 0; i < openingRandomMoves; i += 1) {
      const moves = getLegalMoveOptions(chess);
      if (moves.length === 0) break;
      const pick = moves[Math.floor(rng() * moves.length)];
      const applied = chess.move(pick.san);
      if (applied) {
        lastMoveUci = `${applied.from}${applied.to}${applied.promotion ?? ''}`;
        pushRecentMove(recentMoves, lastMoveUci, recentMoveWindow);
        noProgressStreak = moveContinuesNoProgress(pick) ? noProgressStreak + 1 : 0;
        seenFens.add(normalizePositionKey(chess.fen()));
        recordFenCount(seenFenCounts, chess.fen());
      }
    }
    const startedAt = new Date();
    const deadline = startedAt.getTime() + config.settings.gameTimeoutMs;
    let timedOut = false;
    const ruleAudit = createRuleAudit(chess, openingRandomMoves);

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
      const simulatedFenByMove = buildSimulatedFenByMove(chess, legalMoveOptions);
      const moveRisks = buildMoveRiskSnapshots(
        legalMoveOptions,
        simulatedFenByMove,
        seenFenCounts,
        lastMoveUci,
        noProgressStreak,
        maxNoProgressPlies
      );
      const repetitionRiskByMove = Object.fromEntries(
        legalMoveOptions.map((move, index) => [move.uci, moveRisks[index]!])
      );
      const repetitionRiskByIndex = moveRisks.map(
        (risk) => risk.reversesLastMove || risk.recreatesPriorFen || risk.noProgressRisk
      );
      const callStartedAt = Date.now();
      const primary = await this.getMoveDetailed(
        model,
        fenBefore,
        legalMoveOptions,
        config.settings.moveTimeoutMs,
        false,
        config.mode === 'free_generation' ? 'free_generation' : 'constrained_index',
        {
          recentMoves: [...recentMoves],
          repetitionRiskByIndex,
          avoidImmediateRepetition
        },
        {
          providerRetryCount: config.settings.providerRetryCount,
          providerBackoffMs: config.settings.providerBackoffMs,
          maxTotalProviderWaitMs: config.settings.maxTotalProviderWaitMs
        }
      );
      const thinkTimeMs = Date.now() - callStartedAt;

      let detail = primary;
      let retryDetail: OllamaMoveResponse | null = null;
      let retrySuccess = false;
      let illegalAttempt = false;
      let oscillationRejected = false;
      let oscillationOverrideUsed = false;
      const retryBudget = Math.max(0, Math.floor(config.settings.retryCount ?? 1));
      const primaryIsProviderFailure =
        primary.failureMode === 'rate_limited' ||
        primary.failureMode === 'request_failed' ||
        primary.failureMode === 'timeout_or_abort';

      const evaluateCandidate = (candidate: OllamaMoveResponse): {
        valid: boolean;
        moveIndex: number;
        badOscillation: boolean;
      } => {
        if (!candidate.move) {
          return { valid: false, moveIndex: -1, badOscillation: false };
        }
        const moveIndex = legalMoveOptions.findIndex((m) => m.san === candidate.move);
        if (moveIndex < 0) {
          return { valid: false, moveIndex: -1, badOscillation: false };
        }
        return {
          valid: true,
          moveIndex,
          badOscillation: antiOscillation && isBadOscillationChoice(moveIndex, moveRisks)
        };
      };

      const primaryCandidate = evaluateCandidate(primary);
      if (!primaryCandidate.valid) {
        illegalAttempt = true;
        ruleAudit.invalidModelMoveAttempts += 1;
        ruleAudit.illegalMoveAttempts += 1;
      } else if (primaryCandidate.badOscillation) {
        oscillationRejected = true;
        ruleAudit.oscillationRejectedCount += 1;
      }

      if ((!primaryCandidate.valid || primaryCandidate.badOscillation) && !primaryIsProviderFailure) {
        for (let attempt = 0; attempt < retryBudget; attempt += 1) {
          ruleAudit.retryAttempts += 1;
          retryDetail = await this.getMoveDetailed(
            model,
            fenBefore,
            legalMoveOptions,
            config.settings.moveTimeoutMs,
            true,
            config.mode === 'free_generation' ? 'free_generation' : 'constrained_index',
            {
              recentMoves: [...recentMoves],
              repetitionRiskByIndex,
              avoidImmediateRepetition
            },
            {
              providerRetryCount: config.settings.providerRetryCount,
              providerBackoffMs: config.settings.providerBackoffMs,
              maxTotalProviderWaitMs: config.settings.maxTotalProviderWaitMs
            }
          );
          const retryCandidate = evaluateCandidate(retryDetail);
          if (retryCandidate.valid && !retryCandidate.badOscillation) {
            retrySuccess = true;
            ruleAudit.retrySuccesses += 1;
            detail = retryDetail;
            break;
          }
          if (!retryCandidate.valid) {
            ruleAudit.invalidModelMoveAttempts += 1;
          }
          if (retryCandidate.badOscillation) {
            oscillationRejected = true;
            ruleAudit.oscillationRejectedCount += 1;
          }
        }
      }

      let chosenMove = detail.move;
      const finalCandidate = evaluateCandidate(detail);
      if (!finalCandidate.valid || finalCandidate.badOscillation) {
        ruleAudit.fallbackMovesUsed += 1;
        if (!finalCandidate.badOscillation) {
          incrementFailureMode(ruleAudit, detail.failureMode ?? 'unknown');
        } else {
          oscillationOverrideUsed = true;
          ruleAudit.oscillationOverrideCount += 1;
        }
        accumulateBindingProfile(ruleAudit, detail.bindingProfile);
        chosenMove = chooseFallbackMove({
          legalMoves: legalMoveOptions,
          policy: config.settings.fallbackPolicy ?? 'deterministic_first',
          rngSeed: config.settings.seed,
          lastMoveUci,
          previousFenSet: seenFens,
          simulatedFenByMove,
          repetitionRiskByMove
        }).move;
      } else {
        accumulateBindingProfile(ruleAudit, detail.bindingProfile);
      }

      const moveResult = chess.move(chosenMove, { strict: true });
      if (!moveResult) {
        ruleAudit.legalMoveOnly = false;
        incrementFailureMode(ruleAudit, detail.failureMode ?? 'unknown');
        throw new Error(`Chosen move ${chosenMove} could not be applied for ${gameId}`);
      }
      chosenMove = moveResult.san;

      const chosenMoveUci = `${moveResult.from}${moveResult.to}${moveResult.promotion ?? ''}`;
      const chosenMoveReversesLast = isImmediateReverse(lastMoveUci, chosenMoveUci);
      const chosenMoveRecreatesPriorFen = Boolean(simulatedFenByMove[chosenMoveUci] && seenFens.has(simulatedFenByMove[chosenMoveUci]!));
      const chosenMoveIndex = legalMoveOptions.findIndex((move) => move.san === chosenMove);
      const chosenRisk = chosenMoveIndex >= 0 ? moveRisks[chosenMoveIndex] : null;
      const repetitionRiskSelected =
        chosenMoveIndex >= 0 ? Boolean(repetitionRiskByIndex[chosenMoveIndex]) : false;
      const recentRepeatCount = chosenRisk?.repeatStateCountAfterMove ?? 0;
      const noProgressRisk = chosenRisk?.noProgressRisk ?? false;
      if (chosenMoveReversesLast) {
        ruleAudit.reverseMoveCount += 1;
      }
      if (chosenMoveRecreatesPriorFen) {
        ruleAudit.repeatStateCount += 1;
      }
      const chosenMoveOption = chosenMoveIndex >= 0 ? legalMoveOptions[chosenMoveIndex] : null;
      if (chosenMoveOption && moveContinuesNoProgress(chosenMoveOption)) {
        noProgressStreak += 1;
        ruleAudit.noProgressCount += 1;
      } else {
        noProgressStreak = 0;
      }
      ruleAudit.noProgressMaxStreak = Math.max(ruleAudit.noProgressMaxStreak, noProgressStreak);

      const illegalSuggestion = illegalAttempt || detail.failureMode !== null;
      const illegalFailureMode: IllegalMoveFailureMode | null = illegalSuggestion ? (detail.failureMode ?? 'wrong_format') : null;
      const bindingProfile: BindingProfile | null = detail.bindingProfile;
      const correctionApplied = !chosenMove || chosenMove !== detail.move;

      updateRuleAuditAfterMove(ruleAudit, chess, moveResult.flags, side, turnBeforeMove);
      lastMoveUci = chosenMoveUci;
      pushRecentMove(recentMoves, lastMoveUci, recentMoveWindow);
      seenFens.add(normalizePositionKey(chess.fen()));
      recordFenCount(seenFenCounts, chess.fen());

      const fenAfter = chess.fen();

      const cpl = options.enabled && liveCplEnabled
        ? await this.computeCpl(fenBefore, chosenMoveUci, fenAfter)
        : -1;
      const clampedCpl = cpl < 0 ? -1 : clampCpl(cpl);
      if (clampedCpl >= 0 && side === 'white') {
        whiteCpl.push(clampedCpl);
      } else if (clampedCpl >= 0) {
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
        selectionIndex: detail.selectedIndex ?? undefined,
        legalMoves: legalMoveOptions.map((m) => m.san),
        reasoning: options.trackReasoning ? detail.reasoning : '',
        confidence: options.trackConfidence ? detail.confidence : 0.5,
        cpl: clampedCpl,
        gamePhase: inferGamePhase(moveNumber),
        materialBalance,
        isCritical: clampedCpl >= blunderThresholdCp,
        winProbability: estimateWinProbability(materialBalance),
        illegalSuggestion,
        illegalFailureMode,
        bindingProfile,
        correctionApplied,
        repetitionRiskSelected,
        reversesLastMove: chosenMoveReversesLast,
        recreatesPriorFen: chosenMoveRecreatesPriorFen,
        noProgressRisk,
        recentRepeatCount,
        oscillationRejected,
        oscillationOverrideUsed,
        thinkTimeMs,
        moveTimeMs: thinkTimeMs
      };

      if (this.gameLogger) {
        await this.gameLogger.logMove({
          runType: 'paper',
          gameId,
          moveNumber,
          side,
          model,
          fen: fenBefore,
          legalMoves: legalMoveOptions.map((m, idx) => `${idx}:${m.uci}${repetitionRiskByIndex[idx] ? '[repeat-risk]' : ''}`),
          rawPrimary: primary.rawResponse,
          rawRetry: retryDetail?.rawResponse ?? null,
          selectedIndex: detail.selectedIndex ?? null,
          chosenMove,
          valid: legalMoveOptions.some((m) => m.san === chosenMove),
          retryUsed: retryDetail !== null,
          retrySuccess,
          fallbackUsed: chosenMove !== detail.move,
          failureModePrimary: primary.failureMode ?? 'none',
          failureModeRetry: retryDetail?.failureMode ?? null,
          statusCodePrimary: primary.statusCode ?? null,
          statusCodeRetry: retryDetail?.statusCode ?? null,
          retryAfterMsPrimary: primary.retryAfterMs ?? null,
          retryAfterMsRetry: retryDetail?.retryAfterMs ?? null,
          keyIdPrimary: primary.keyId ?? null,
          keyIdRetry: retryDetail?.keyId ?? null,
          providerRetriesPrimary: primary.providerRetries ?? 0,
          providerRetriesRetry: retryDetail?.providerRetries ?? 0,
          repetitionRiskSelected,
          reversesLastMove: chosenMoveReversesLast,
          recreatesPriorFen: chosenMoveRecreatesPriorFen,
          noProgressRisk,
          recentRepeatCount,
          oscillationRejected,
          oscillationOverrideUsed
        });
      }

      onDatapoint?.(datapoint);
      await sleep(config.settings.moveDelayMs);
    }

    const endedAt = new Date();
    const { result, termination } = this.determineGameOutcome(chess, config.settings.maxMoves, timedOut);
    const collapseReason = determineCollapseReason(
      ruleAudit,
      termination,
      chess.history().length,
      maxNoProgressPlies
    );
    ruleAudit.collapseReason = collapseReason;
    ruleAudit.collapseDetected = collapseReason !== null;
    ruleAudit.behaviorallyStable = !ruleAudit.collapseDetected;

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
      reverseMoveCount: ruleAudit.reverseMoveCount,
      repeatStateCount: ruleAudit.repeatStateCount,
      noProgressMaxStreak: ruleAudit.noProgressMaxStreak,
      collapseDetected: ruleAudit.collapseDetected,
      collapseReason: ruleAudit.collapseReason,
      ruleAudit
    };
  }

  private async computeCpl(fenBefore: string, move: string, fenAfter: string): Promise<number> {
    const cacheKey = `${this.stockfishEvalDepth}|${fenBefore}|${move}`;
    const cached = this.cplCache.get(cacheKey);
    if (typeof cached === 'number') {
      return cached;
    }

    // Try new Stockfish analyzer first
    if (this.stockfishAnalyzer) {
      try {
        await this.stockfishAnalyzer.initialize();
        this.stockfishAnalyzer.setAnalysisDepth(this.stockfishEvalDepth);
        const cpl = await this.stockfishAnalyzer.computeCPL(fenBefore, move);
        this.cplCache.set(cacheKey, cpl);
        return cpl;
      } catch (error) {
        console.warn('Stockfish analysis failed, using fallback');
      }
    }

    // Fallback to old method
    const stockfishDelta = await this.tryStockfishDelta(fenBefore, fenAfter);
    if (stockfishDelta !== null) {
      const cpl = Math.abs(stockfishDelta);
      this.cplCache.set(cacheKey, cpl);
      return cpl;
    }

    // Heuristic fallback if stockfish is unavailable: penalize if move creates immediate tactical danger.
    const before = new Chess(fenBefore);
    const after = new Chess(fenAfter);
    const beforeChecks = before.inCheck() ? 1 : 0;
    const afterChecks = after.inCheck() ? 1 : 0;
    const mobilityPenalty = Math.max(0, before.moves().length - after.moves().length);
    const syntaxPenalty = /[+#]$/.test(move) ? -20 : 20;
    const cpl = Math.max(0, beforeChecks * 60 + afterChecks * 80 + mobilityPenalty * 3 + syntaxPenalty);
    this.cplCache.set(cacheKey, cpl);
    return cpl;
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
