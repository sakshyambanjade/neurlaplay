import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GamePaperSummary, GamePhase, PaperArtifacts, PaperDatapoint, PaperStatsSummary } from './types.js';

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

  getDatapointsSnapshot(): PaperDatapoint[] {
    return [...this.datapoints];
  }

  getGameSummariesSnapshot(): GamePaperSummary[] {
    return [...this.gameSummaries];
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

    const whiteCpl = this.datapoints.filter((d) => d.side === 'white').map((d) => d.cpl);
    const blackCpl = this.datapoints.filter((d) => d.side === 'black').map((d) => d.cpl);

    const phaseCounts: Record<GamePhase, number> = {
      opening: this.datapoints.filter((d) => d.gamePhase === 'opening').length,
      midgame: this.datapoints.filter((d) => d.gamePhase === 'midgame').length,
      endgame: this.datapoints.filter((d) => d.gamePhase === 'endgame').length
    };

    const illegalSuggestionCount = this.datapoints.filter((d) => d.illegalSuggestion).length;
    const correctionCount = this.datapoints.filter((d) => d.correctionApplied).length;
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

    const whiteMoves = this.datapoints.filter((d) => d.side === 'white');
    const blackMoves = this.datapoints.filter((d) => d.side === 'black');

    const avgCplWhite = average(whiteMoves.map((d) => d.cpl));
    const avgCplBlack = average(blackMoves.map((d) => d.cpl));
    const avgCplOverall = average(this.datapoints.map((d) => d.cpl));

    const blundersWhite = whiteMoves.filter((d) => d.cpl >= this.blunderThresholdCpl).length;
    const blundersBlack = blackMoves.filter((d) => d.cpl >= this.blunderThresholdCpl).length;
    const blundersAll = this.datapoints.filter((d) => d.cpl >= this.blunderThresholdCpl).length;

    const phasePerformance = {
      opening: average(this.datapoints.filter((d) => d.gamePhase === 'opening').map((d) => d.cpl)),
      midgame: average(this.datapoints.filter((d) => d.gamePhase === 'midgame').map((d) => d.cpl)),
      endgame: average(this.datapoints.filter((d) => d.gamePhase === 'endgame').map((d) => d.cpl))
    };

    const illegalSuggestionCount = this.datapoints.filter((d) => d.illegalSuggestion).length;
    const correctionCount = this.datapoints.filter((d) => d.correctionApplied).length;
    const totalMoves = this.datapoints.length;

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
      // Approximate two-sided p-value proxy from absolute win-rate gap.
      pValueWhiteVsBlack: clamp01(1 - Math.abs(whiteWinRate - blackWinRate)),
      reliability: {
        illegalSuggestionCount,
        correctionCount,
        illegalSuggestionRate: totalMoves > 0 ? illegalSuggestionCount / totalMoves : 0,
        correctionRate: totalMoves > 0 ? correctionCount / totalMoves : 0
      }
    };
  }

  generateTable3(stats: PaperStatsSummary): string {
    return [
      '\\begin{table}[h]',
      '\\centering',
      '\\caption{Model Performance Comparison}',
      '\\begin{tabular}{lccc}',
      '\\toprule',
      'Model & Win Rate & Avg CPL & Blunder Rate \\\\',
      '\\midrule',
      `${stats.whiteModel} & ${stats.whiteWinRate.toFixed(3)} & ${stats.avgCpl.white.toFixed(1)} & ${stats.blunderRate.white.toFixed(3)} \\\\`,
      `${stats.blackModel} & ${stats.blackWinRate.toFixed(3)} & ${stats.avgCpl.black.toFixed(1)} & ${stats.blunderRate.black.toFixed(3)} \\\\`,
      '\\bottomrule',
      '\\end{tabular}',
      '\\end{table}'
    ].join('\n');
  }

  exportPGN(): string {
    return this.gameSummaries.map((game) => game.pgn.trim()).filter(Boolean).join('\n\n');
  }

  async generatePaperArtifacts(outputDir: string): Promise<PaperArtifacts> {
    await mkdir(outputDir, { recursive: true });
    const stats = this.computeResearchStats();

    const table3Path = path.join(outputDir, 'paper-latex-table3.tex');
    const statsPath = path.join(outputDir, 'paper-stats.json');
    const pgnPath = path.join(outputDir, 'all-games.pgn');
    const datapointsPath = path.join(outputDir, 'paper-datapoints.json');
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
            run_manifest_ref: this.runManifestRef
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

    return {
      latexTable3: this.generateTable3(stats),
      statsSummary: stats,
      pgnFile: pgnPath,
      visualizations: [plotsDir],
      datapointsFile: datapointsPath
    };
  }
}
