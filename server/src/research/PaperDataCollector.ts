import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Chess } from 'chess.js';
import type {
  BindingProfile,
  GamePaperSummary,
  GamePhase,
  IllegalMoveFailureMode,
  PaperArtifacts,
  PaperDatapoint,
  PaperStatsSummary
} from './types.js';
import { StockfishAnalyzer } from './StockfishAnalyzer.js';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function proportionConfidenceInterval95(successes: number, total: number): [number, number] {
  if (total === 0) {
    return [0, 0];
  }

  const p = successes / total;
  const z = 1.96;
  const margin = z * Math.sqrt((p * (1 - p)) / total);
  return [Math.max(0, p - margin), Math.min(1, p + margin)];
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function clampCpl(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return -1;
  }
  return Math.max(0, Math.min(1000, value));
}

function moveToUci(fenBefore: string, move: string): string | null {
  try {
    const chess = new Chess(fenBefore);
    const applied = chess.move(move, { strict: true });
    if (!applied) {
      return null;
    }
    return `${applied.from}${applied.to}${applied.promotion ?? ''}`;
  } catch {
    return null;
  }
}

function heuristicCpl(fenBefore: string, move: string, fenAfter: string): number {
  try {
    const before = new Chess(fenBefore);
    const after = new Chess(fenAfter);
    const beforeChecks = before.inCheck() ? 1 : 0;
    const afterChecks = after.inCheck() ? 1 : 0;
    const mobilityPenalty = Math.max(0, before.moves().length - after.moves().length);
    const syntaxPenalty = /[+#]$/.test(move) ? -20 : 20;
    return Math.max(0, beforeChecks * 60 + afterChecks * 80 + mobilityPenalty * 3 + syntaxPenalty);
  } catch {
    return -1;
  }
}

function erf(x: number): number {
  // Numerical approximation (Abramowitz and Stegun 7.1.26)
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

function entropyFromCounts(counts: Map<string, number>): number {
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const v of counts.values()) {
    const p = v / total;
    h -= p * Math.log2(p);
  }
  return h;
}

function buildIllegalFailureModeCounts(
  datapoints: PaperDatapoint[]
): Partial<Record<IllegalMoveFailureMode, number>> {
  const counts: Partial<Record<IllegalMoveFailureMode, number>> = {};
  for (const point of datapoints) {
    if (!point.illegalFailureMode) {
      continue;
    }
    counts[point.illegalFailureMode] = (counts[point.illegalFailureMode] ?? 0) + 1;
  }
  return counts;
}

function profileBoundCount(profile: BindingProfile | null): number {
  if (!profile) {
    return 0;
  }
  if (typeof profile.boundCount === 'number') {
    return profile.boundCount;
  }
  return (
    Number(profile.hasPiece) +
    Number(profile.hasOrigin) +
    Number(profile.hasDestination) +
    Number(profile.hasLegalConstraint)
  );
}

export class PaperDataCollector {
  private readonly datapoints: PaperDatapoint[] = [];
  private readonly gameSummaries: GamePaperSummary[] = [];
  private readonly blunderThresholdCpl: number;
  private readonly stockfishEvalDepth: number;
  private readonly stockfishEngine: string;
  private readonly runManifestRef: string;

  constructor(
    private readonly whiteModel: string,
    private readonly blackModel: string,
    opts: {
      blunderThresholdCpl?: number;
      stockfishEvalDepth?: number;
      stockfishEngine?: string;
      runManifestRef?: string;
    } = {}
  ) {
    this.blunderThresholdCpl = Math.max(1, Math.floor(opts.blunderThresholdCpl ?? 200));
    this.stockfishEvalDepth = Math.max(1, Math.floor(opts.stockfishEvalDepth ?? 10));
    this.stockfishEngine = opts.stockfishEngine?.trim() || 'stockfish-17.1-lite';
    this.runManifestRef = opts.runManifestRef?.trim() || 'run_manifest.json';
  }

  addDatapoint(point: PaperDatapoint): void {
    this.datapoints.push(point);
  }

  addGameSummary(summary: GamePaperSummary): void {
    this.gameSummaries.push(summary);
  }

  hydrate(datapoints: PaperDatapoint[], gameSummaries: GamePaperSummary[]): void {
    this.datapoints.length = 0;
    this.gameSummaries.length = 0;
    this.datapoints.push(...datapoints);
    this.gameSummaries.push(...gameSummaries);
  }

  getDatapointsSnapshot(): PaperDatapoint[] {
    return [...this.datapoints];
  }

  getGameSummariesSnapshot(): GamePaperSummary[] {
    return [...this.gameSummaries];
  }

  private recomputeGameAverageCpl(): void {
    const byGame = new Map<string, { white: number[]; black: number[] }>();
    for (const point of this.datapoints) {
      if (point.cpl < 0) {
        continue;
      }
      const bucket = byGame.get(point.gameId) ?? { white: [], black: [] };
      if (point.side === 'white') {
        bucket.white.push(point.cpl);
      } else {
        bucket.black.push(point.cpl);
      }
      byGame.set(point.gameId, bucket);
    }

    for (const game of this.gameSummaries) {
      const values = byGame.get(game.gameId);
      game.averageCplWhite = average(values?.white ?? []);
      game.averageCplBlack = average(values?.black ?? []);
    }
  }

  async enrichOfflineCpl(): Promise<void> {
    const unresolved = this.datapoints.filter((point) => point.cpl < 0);
    if (unresolved.length === 0) {
      this.recomputeGameAverageCpl();
      return;
    }

    const analyzer = new StockfishAnalyzer();
    const cache = new Map<string, number>();
    try {
      await analyzer.initialize();
      analyzer.setAnalysisDepth(this.stockfishEvalDepth);

      for (const point of this.datapoints) {
        if (point.cpl >= 0) {
          continue;
        }

        const uci = moveToUci(point.fenBefore, point.move);
        const cacheKey = `${this.stockfishEvalDepth}|${point.fenBefore}|${uci ?? point.move}`;
        let cpl = cache.get(cacheKey);
        if (typeof cpl !== 'number') {
          if (uci) {
            cpl = await analyzer.computeCPL(point.fenBefore, uci);
          } else {
            cpl = -1;
          }
          if (cpl < 0) {
            cpl = heuristicCpl(point.fenBefore, point.move, point.fenAfter);
          }
          cache.set(cacheKey, cpl);
        }

        point.cpl = clampCpl(cpl);
        point.isCritical = point.cpl >= 0 && point.cpl >= this.blunderThresholdCpl;
      }
    } finally {
      await analyzer.shutdown();
    }

    this.recomputeGameAverageCpl();
  }

  getLiveStats(): {
    whiteWins: number;
    blackWins: number;
    draws: number;
    avgCpl: { white: number; black: number };
    gamePhase: Record<GamePhase, number>;
    movesTracked: number;
    illegalSuggestionCount: number;
    correctionCount: number;
    illegalSuggestionRate: number;
    correctionRate: number;
  } {
    const whiteWins = this.gameSummaries.filter((game) => game.result === '1-0').length;
    const blackWins = this.gameSummaries.filter((game) => game.result === '0-1').length;
    const draws = this.gameSummaries.filter((game) => game.result === '1/2-1/2').length;

    const whiteCpl = this.datapoints.filter((d) => d.side === 'white' && d.cpl >= 0).map((d) => d.cpl);
    const blackCpl = this.datapoints.filter((d) => d.side === 'black' && d.cpl >= 0).map((d) => d.cpl);

    const phaseCounts: Record<GamePhase, number> = {
      opening: this.datapoints.filter((d) => d.gamePhase === 'opening').length,
      midgame: this.datapoints.filter((d) => d.gamePhase === 'midgame').length,
      endgame: this.datapoints.filter((d) => d.gamePhase === 'endgame').length
    };

    const illegalSuggestionCount = this.datapoints.filter((d) => d.illegalSuggestion).length;
    const correctionCount = this.datapoints.filter((d) => d.correctionApplied).length;
    const illegalFailureModes = buildIllegalFailureModeCounts(this.datapoints);
    const totalMoves = this.datapoints.length;

    return {
      whiteWins,
      blackWins,
      draws,
      avgCpl: {
        white: average(whiteCpl),
        black: average(blackCpl)
      },
      gamePhase: phaseCounts,
      movesTracked: totalMoves,
      illegalSuggestionCount,
      correctionCount,
      illegalSuggestionRate: totalMoves > 0 ? illegalSuggestionCount / totalMoves : 0,
      correctionRate: totalMoves > 0 ? correctionCount / totalMoves : 0
    };
  }

  computeResearchStats(): PaperStatsSummary {
    const totalGames = this.gameSummaries.length;
    const whiteWins = this.gameSummaries.filter((game) => game.result === '1-0').length;
    const blackWins = this.gameSummaries.filter((game) => game.result === '0-1').length;
    const draws = this.gameSummaries.filter((game) => game.result === '1/2-1/2').length;

    const whiteWinRate = totalGames > 0 ? whiteWins / totalGames : 0;
    const blackWinRate = totalGames > 0 ? blackWins / totalGames : 0;
    const drawRate = totalGames > 0 ? draws / totalGames : 0;
    const effectSizes = {
      winRateGap: whiteWinRate - blackWinRate
    };
    const decisiveGames = whiteWins + blackWins;
    const winDiff = whiteWins - blackWins;
    const zScore =
      decisiveGames > 0 ? winDiff / Math.sqrt(decisiveGames * 0.25) : 0;
    const pValueWhiteVsBlack = Math.min(
      1,
      Math.max(0, 2 * (1 - 0.5 * (1 + erf(Math.abs(zScore) / Math.SQRT2))))
    );

    const whiteMoves = this.datapoints.filter((d) => d.side === 'white' && d.cpl >= 0);
    const blackMoves = this.datapoints.filter((d) => d.side === 'black' && d.cpl >= 0);
    const allMoves = this.datapoints.filter((d) => d.cpl >= 0);

    const avgCplWhite = average(whiteMoves.map((d) => d.cpl));
    const avgCplBlack = average(blackMoves.map((d) => d.cpl));
    const avgCplOverall = average(allMoves.map((d) => d.cpl));

    const blundersWhite = whiteMoves.filter((d) => d.cpl >= this.blunderThresholdCpl).length;
    const blundersBlack = blackMoves.filter((d) => d.cpl >= this.blunderThresholdCpl).length;
    const blundersAll = allMoves.filter((d) => d.cpl >= this.blunderThresholdCpl).length;

    const phasePerformance = {
      opening: average(this.datapoints.filter((d) => d.gamePhase === 'opening').map((d) => d.cpl)),
      midgame: average(this.datapoints.filter((d) => d.gamePhase === 'midgame').map((d) => d.cpl)),
      endgame: average(this.datapoints.filter((d) => d.gamePhase === 'endgame').map((d) => d.cpl))
    };

    const illegalSuggestionCount = this.datapoints.filter((d) => d.illegalSuggestion).length;
    const correctionCount = this.datapoints.filter((d) => d.correctionApplied).length;
    const illegalFailureModes = buildIllegalFailureModeCounts(this.datapoints);
    const illegalDatapoints = this.datapoints.filter((d) => d.illegalSuggestion && d.bindingProfile);
    const totalMoves = this.datapoints.length;
    const fallbackMoves = this.gameSummaries.reduce((sum, game) => sum + game.ruleAudit.fallbackMovesUsed, 0);
    const illegalMoveAttempts = this.gameSummaries.reduce(
      (sum, game) => sum + (game.ruleAudit.illegalMoveAttempts ?? 0),
      0
    );
    const retryAttempts = this.gameSummaries.reduce(
      (sum, game) => sum + (game.ruleAudit.retryAttempts ?? 0),
      0
    );
    const retrySuccesses = this.gameSummaries.reduce(
      (sum, game) => sum + (game.ruleAudit.retrySuccesses ?? 0),
      0
    );
    const invalidModelMoveAttempts = this.gameSummaries.reduce(
      (sum, game) => sum + game.ruleAudit.invalidModelMoveAttempts,
      0
    );
    const llmAcceptedMoves = Math.max(0, totalMoves - fallbackMoves);
    const whiteMoveCount = whiteMoves.length;
    const blackMoveCount = blackMoves.length;
    const whiteFallbackMoves = whiteMoves.filter((d) => d.correctionApplied).length;
    const blackFallbackMoves = blackMoves.filter((d) => d.correctionApplied).length;
    const gamesWithAnyLlmMove = this.gameSummaries.filter((game) => game.ruleAudit.fallbackMovesUsed < game.moveCount).length;
    const gamesWithOnlyFallback = this.gameSummaries.filter((game) => game.moveCount > 0 && game.ruleAudit.fallbackMovesUsed >= game.moveCount).length;
    const legalMoveOnlyGames = this.gameSummaries.filter((game) => game.ruleAudit.legalMoveOnly).length;

    const illegalBoundCounts = illegalDatapoints.map((d) => profileBoundCount(d.bindingProfile));
    const meanBoundCount = average(illegalBoundCounts);

    const boundCountByGame = new Map<string, number[]>();
    const boundCountByMove = new Map<number, number[]>();
    const boundCountByModel = new Map<string, number[]>();
    for (const d of illegalDatapoints) {
      const value = profileBoundCount(d.bindingProfile);

      const perGame = boundCountByGame.get(d.gameId) ?? [];
      perGame.push(value);
      boundCountByGame.set(d.gameId, perGame);

      const perMove = boundCountByMove.get(d.moveNumber) ?? [];
      perMove.push(value);
      boundCountByMove.set(d.moveNumber, perMove);

      const perModel = boundCountByModel.get(d.model) ?? [];
      perModel.push(value);
      boundCountByModel.set(d.model, perModel);
    }

    const gameMeans = Array.from(boundCountByGame.values()).map((vals) => average(vals));
    const bindingCurveByMove = Array.from(boundCountByMove.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([moveNumber, values]) => ({
        moveNumber,
        meanBoundCount: average(values),
        samples: values.length
      }));

    const meanBoundCountByModel: Record<string, number> = {};
    for (const [model, values] of boundCountByModel.entries()) {
      meanBoundCountByModel[model] = average(values);
    }

    const illegalOpenings = illegalDatapoints.filter((d) => d.gamePhase === 'opening');
    const illegalMidgames = illegalDatapoints.filter((d) => d.gamePhase === 'midgame');
    const illegalEndgames = illegalDatapoints.filter((d) => d.gamePhase === 'endgame');

    const componentPresenceRate = {
      piece:
        illegalDatapoints.length > 0
          ? illegalDatapoints.filter((d) => d.bindingProfile?.hasPiece).length / illegalDatapoints.length
          : 0,
      origin:
        illegalDatapoints.length > 0
          ? illegalDatapoints.filter((d) => d.bindingProfile?.hasOrigin).length / illegalDatapoints.length
          : 0,
      destination:
        illegalDatapoints.length > 0
          ? illegalDatapoints.filter((d) => d.bindingProfile?.hasDestination).length / illegalDatapoints.length
          : 0,
      legalConstraint:
        illegalDatapoints.length > 0
          ? illegalDatapoints.filter((d) => d.bindingProfile?.hasLegalConstraint).length / illegalDatapoints.length
          : 0
    };

    const moveCounts = new Map<string, number>();
    for (const d of this.datapoints) {
      moveCounts.set(d.move, (moveCounts.get(d.move) ?? 0) + 1);
    }

    const repetitionGames = this.gameSummaries.filter((g) => g.termination === 'threefold_repetition').length;
    const reverseMoveCount = this.datapoints.filter((d) => d.reversesLastMove).length;
    const repeatStateCount = this.datapoints.filter((d) => d.recreatesPriorFen).length;
    const oscillationRejectedCount = this.datapoints.filter((d) => d.oscillationRejected).length;
    const collapseDetectedGames = this.gameSummaries.filter((g) => g.collapseDetected).length;
    const noProgressMaxStreak = this.gameSummaries.reduce(
      (max, game) => Math.max(max, game.noProgressMaxStreak ?? 0),
      0
    );

    return {
      totalGames,
      whiteModel: this.whiteModel,
      blackModel: this.blackModel,
      whiteWins,
      blackWins,
      draws,
      whiteWinRate,
      blackWinRate,
      drawRate,
      avgCpl: {
        white: avgCplWhite,
        black: avgCplBlack,
        overall: avgCplOverall
      },
      blunderRate: {
        white: whiteMoves.length > 0 ? blundersWhite / whiteMoves.length : 0,
        black: blackMoves.length > 0 ? blundersBlack / blackMoves.length : 0,
        overall: this.datapoints.length > 0 ? blundersAll / this.datapoints.length : 0
      },
      phasePerformance,
      confidenceInterval95: {
        whiteWinRate: proportionConfidenceInterval95(whiteWins, totalGames),
        blackWinRate: proportionConfidenceInterval95(blackWins, totalGames),
        drawRate: proportionConfidenceInterval95(draws, totalGames)
      },
      effectSizes,
      // Two-sided normal-approx p-value for win-rate gap (decisive games only).
      pValueWhiteVsBlack,
      reliability: {
        illegalSuggestionCount,
        correctionCount,
        illegalSuggestionRate: totalMoves > 0 ? illegalSuggestionCount / totalMoves : 0,
        correctionRate: totalMoves > 0 ? correctionCount / totalMoves : 0,
        illegalFailureModes
      },
      compliance: {
        totalMoves,
        llmAcceptedMoves,
        fallbackMoves,
        llmMoveRate: totalMoves > 0 ? llmAcceptedMoves / totalMoves : 0,
        fallbackRate: totalMoves > 0 ? fallbackMoves / totalMoves : 0,
        llmMoveRateBySide: {
          white: whiteMoveCount > 0 ? (whiteMoveCount - whiteFallbackMoves) / whiteMoveCount : 0,
          black: blackMoveCount > 0 ? (blackMoveCount - blackFallbackMoves) / blackMoveCount : 0
        },
        fallbackRateBySide: {
          white: whiteMoveCount > 0 ? whiteFallbackMoves / whiteMoveCount : 0,
          black: blackMoveCount > 0 ? blackFallbackMoves / blackMoveCount : 0
        },
        invalidModelMoveAttempts,
        invalidMoveFailureModes: illegalFailureModes,
        gamesWithAnyLlmMove,
        gamesWithOnlyFallback,
        legalMoveOnlyGames
      },
      binding: {
        illegalAttempts: illegalDatapoints.length,
        meanBoundCount,
        meanBoundCountPerGame: average(gameMeans),
        meanBoundCountByPhase: {
          opening: average(illegalOpenings.map((d) => profileBoundCount(d.bindingProfile))),
          midgame: average(illegalMidgames.map((d) => profileBoundCount(d.bindingProfile))),
          endgame: average(illegalEndgames.map((d) => profileBoundCount(d.bindingProfile)))
        },
        meanBoundCountByModel,
        bindingCurveByMove,
        componentPresenceRate
      },
      extraMetrics: {
        illegal_move_attempt_rate:
          totalMoves + illegalMoveAttempts > 0 ? illegalMoveAttempts / (totalMoves + illegalMoveAttempts) : 0,
        retry_success_rate: retryAttempts > 0 ? retrySuccesses / retryAttempts : 0,
        fallback_rate: totalMoves > 0 ? fallbackMoves / totalMoves : 0,
        move_selection_entropy: entropyFromCounts(moveCounts),
        repetition_rate: totalGames > 0 ? repetitionGames / totalGames : 0,
        reverse_move_rate: totalMoves > 0 ? reverseMoveCount / totalMoves : 0,
        repeat_state_rate: totalMoves > 0 ? repeatStateCount / totalMoves : 0,
        oscillation_rate: totalMoves > 0 ? oscillationRejectedCount / totalMoves : 0,
        behavioral_collapse_rate: totalGames > 0 ? collapseDetectedGames / totalGames : 0,
        no_progress_max_streak: noProgressMaxStreak
      }
    };
  }

  generateTable3(stats: PaperStatsSummary): string {
    return [
      '\\begin{table}[h]',
      '\\centering',
      '\\caption{Model Performance Comparison}',
      '\\begin{tabular}{lcccc}',
      '\\toprule',
      'Model & Win Rate & Avg CPL & Blunder Rate & LLM Move Rate \\\\',
      '\\midrule',
      `${stats.whiteModel} & ${stats.whiteWinRate.toFixed(3)} & ${stats.avgCpl.white.toFixed(1)} & ${stats.blunderRate.white.toFixed(3)} & ${stats.compliance.llmMoveRateBySide.white.toFixed(3)} \\\\`,
      `${stats.blackModel} & ${stats.blackWinRate.toFixed(3)} & ${stats.avgCpl.black.toFixed(1)} & ${stats.blunderRate.black.toFixed(3)} & ${stats.compliance.llmMoveRateBySide.black.toFixed(3)} \\\\`,
      '\\bottomrule',
      '\\end{tabular}',
      '\\end{table}'
    ].join('\n');
  }

  exportPGN(): string {
    return this.gameSummaries.map((game) => game.pgn.trim()).filter(Boolean).join('\n\n');
  }

  async generatePaperArtifacts(
    outputDir: string,
    opts: { enablePostRunCpl?: boolean } = {}
  ): Promise<PaperArtifacts> {
    await mkdir(outputDir, { recursive: true });
    if (opts.enablePostRunCpl ?? false) {
      await this.enrichOfflineCpl();
    }
    const stats = this.computeResearchStats();
    const totalGames = this.gameSummaries.length;
    const blunderThreshold = this.blunderThresholdCpl;
    const totalBlunders = this.datapoints.filter((d) => d.cpl >= blunderThreshold).length;

    const table3Path = path.join(outputDir, 'paper-latex-table3.tex');
    const statsPath = path.join(outputDir, 'paper-stats.json');
    const pgnPath = path.join(outputDir, 'all-games.pgn');
    const datapointsPath = path.join(outputDir, 'paper-datapoints.json');
    const paperResultsPath = path.join(outputDir, 'paper-results.json');
    const rawGamesPath = path.join(outputDir, 'raw-games.json');
    const ruleAuditPath = path.join(outputDir, 'rule-audit-summary.json');
    const plotsDir = path.join(outputDir, 'plots');

    await mkdir(plotsDir, { recursive: true });

    await writeFile(table3Path, this.generateTable3(stats), 'utf-8');
    await writeFile(
      statsPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          eval_settings: {
            engine: this.stockfishEngine,
            depth: this.stockfishEvalDepth,
            blunder_threshold_cp: this.blunderThresholdCpl,
            run_manifest_ref: this.runManifestRef,
            uci_options: {
              Threads: 'default',
              Hash: 'default',
              MultiPV: 'default',
              UCI_AnalyseMode: 'default',
              SyzygyPath: 'none'
            },
            statistics: {
              ci_method: 'wilson',
              cpl_ci_method: 'bootstrap_percentile',
              alpha: 0.05,
              confidence_level: 0.95
            }
          },
          stats,
          games: this.gameSummaries
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(pgnPath, this.exportPGN(), 'utf-8');
    await writeFile(datapointsPath, JSON.stringify(this.datapoints, null, 2), 'utf-8');
    await writeFile(
      paperResultsPath,
      JSON.stringify(
        {
          totalGames,
          whiteModel: this.whiteModel,
          blackModel: this.blackModel,
          whiteWins: stats.whiteWins,
          blackWins: stats.blackWins,
          draws: stats.draws,
          totalBlunders,
          avgCPL: {
            white: stats.avgCpl.white,
            black: stats.avgCpl.black
          },
          extraMetrics: stats.extraMetrics,
          latexTable3: this.generateTable3(stats)
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(rawGamesPath, JSON.stringify(this.gameSummaries, null, 2), 'utf-8');
    await writeFile(
      ruleAuditPath,
      JSON.stringify(
        {
          gamesWithRuleAudit: totalGames,
          totalFallbackMoves: this.gameSummaries.reduce((sum, g) => sum + g.ruleAudit.fallbackMovesUsed, 0),
          totalInvalidModelMoveAttempts: this.gameSummaries.reduce(
            (sum, g) => sum + g.ruleAudit.invalidModelMoveAttempts,
            0
          ),
          legalMoveOnlyGames: this.gameSummaries.filter((g) => g.ruleAudit.legalMoveOnly).length,
          collapseDetectedGames: this.gameSummaries.filter((g) => g.collapseDetected).length,
          reverseMoveCount: this.gameSummaries.reduce((sum, g) => sum + g.reverseMoveCount, 0),
          repeatStateCount: this.gameSummaries.reduce((sum, g) => sum + g.repeatStateCount, 0),
          oscillationRejectedCount: this.gameSummaries.reduce(
            (sum, g) => sum + (g.ruleAudit.oscillationRejectedCount ?? 0),
            0
          ),
          oscillationOverrideCount: this.gameSummaries.reduce(
            (sum, g) => sum + (g.ruleAudit.oscillationOverrideCount ?? 0),
            0
          )
        },
        null,
        2
      ),
      'utf-8'
    );

    return {
      latexTable3: this.generateTable3(stats),
      statsSummary: stats,
      pgnFile: pgnPath,
      visualizations: [plotsDir],
      datapointsFile: datapointsPath
    };
  }
}
