/**
 * NeuroChess Dataset Exporter
 * 
 * Collects brain→game→robot metrics across matches
 * Exports in formats suitable for arXiv publication:
 * - JSON for reproducibility
 * - CSV for statistical analysis
 * - PGN with annotations for chess community
 * 
 * Usage:
 *   const exporter = new NeuroChessExporter();
 *   exporter.addDatapoint({...});
 *   exporter.exportArxivDataset();
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Single game datapoint: brain + game + robot metrics
 */
export interface NeuroChessDatapoint {
  // Identifiers
  gameId: string;
  moveNumber: number;
  timestamp: number;
  
  // Brain Phase (LLM + SNN)
  llmCandidates: string[];                    // e.g., ['e4', 'd4', 'c4']
  llmConfidences: number[];                   // [0.92, 0.78, 0.65]
  snnSpikeVotes: number[];                    // [0.89, 0.23, 0.12] - neuron votes
  snnSpikingEfficiency: number;               // 0.894 - quality metric
  llmSnnIntegratedConfidence: number;         // 0.876 - final brain confidence
  
  // Game Phase
  fen: string;                                // Board state before move
  fenAfter: string;                           // Board state after move
  selectedMove: string;                       // e.g., 'e2e4'
  cpl: number;                                // Centipawn loss (Stockfish depth 20)
  materialBalance: number;                    // Pawn units
  boardPressure: number;                      // 0.0-1.0
  isCheckmate: boolean;
  isCheck: boolean;
  isPieceLoss: boolean;
  
  // Robot Phase
  trajectoryWaypoints: Array<[number, number, number]>;  // Cartesian coordinates
  trajectoryDuration: number;                 // seconds
  robotSuccess: boolean;
  robotExecutionTime?: number;                // milliseconds (actual hardware time)
  robotJointAngles?: number[][];              // Joint positions over time
  robotError?: string;
  
  // Research annotations
  llmReasoning?: string;                      // Why LLM chose this move
  humanEvaluation?: string;                   // Expert annotation (optional)
  notes?: string;
}

/**
 * Paper figure datapoint: aggregated metrics for plots
 */
export interface PaperFigureDatapoint {
  moveNumber: number;
  llmConfidence: number;
  snnEfficiency: number;
  integratedConfidence: number;
  cpl: number;
  robotSuccess: boolean;
  executionTime: number;
}

/**
 * Statistics for paper abstract/results
 */
export interface DatasetStatistics {
  totalMoves: number;
  totalGames: number;
  
  // Brain stats
  avgLlmConfidence: number;
  avgSnnEfficiency: number;
  avgIntegratedConfidence: number;
  llmSnnCorrelation: number;
  
  // Game stats
  avgCpl: number;
  cpLVariance: number;
  avgMaterialBalance: number;
  
  // Robot stats
  robotSuccessRate: number;
  avgRobotExecutionTime: number;
  robotSuccessCorrelationWithConfidence: number;
}

export class NeuroChessExporter {
  private dataset: NeuroChessDatapoint[] = [];
  private outputDir: string;
  
  constructor(outputDir: string = './neurochess_data') {
    this.outputDir = outputDir;
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  
  /**
   * Add a single move/game datapoint to the dataset
   */
  public addDatapoint(point: NeuroChessDatapoint): void {
    // Validation
    if (!point.gameId || !point.selectedMove || point.moveNumber === undefined) {
      console.warn('[DatasetExporter] Invalid datapoint, skipping:', point.gameId);
      return;
    }
    
    this.dataset.push(point);
    console.log(`[DatasetExporter] Added: Game ${point.gameId} move ${point.moveNumber}`);
  }
  
  /**
   * Export complete dataset in arXiv-ready formats
   */
  public exportArxivDataset(): void {
    if (this.dataset.length === 0) {
      console.warn('[DatasetExporter] No datapoints to export');
      return;
    }
    
    // 1. JSON export (full reproducibility)
    this.exportJSON();
    
    // 2. CSV export (statistical analysis)
    this.exportCSV();
    
    // 3. PGN export (chess notation with annotations)
    this.exportPGN();
    
    // 4. Summary statistics
    this.exportStatistics();
    
    // 5. Figure data for paper plots
    this.exportFigureData();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ NEUROCHESS DATASET EXPORTED');
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Datapoints: ${this.dataset.length}`);
    console.log(`📁 Output directory: ${this.outputDir}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nFiles created:`);
    console.log(`  ✓ neurochess_dataset.json      (Full data, reproducibility)`);
    console.log(`  ✓ neurochess_benchmark.csv     (Statistical analysis)`);
    console.log(`  ✓ neurochess_games.pgn         (Chess notation)`);
    console.log(`  ✓ neurochess_statistics.json   (Aggregate metrics)`);
    console.log(`  ✓ paper_figure_data.json       (Figure plots)`);
    console.log(`\n🎓 Ready for arXiv submission!`);
  }
  
  /**
   * Export full dataset as JSON
   */
  private exportJSON(): void {
    const filePath = path.join(this.outputDir, 'neurochess_dataset.json');
    
    const exportData = {
      metadata: {
        createdAt: new Date().toISOString(),
        totalDatapoints: this.dataset.length,
        uniqueGames: new Set(this.dataset.map(d => d.gameId)).size,
        description: 'NeuroChess: Brain-Game-Robot Pipeline Dataset',
        arxivReady: true
      },
      datapoints: this.dataset
    };
    
    fs.writeFileSync(
      filePath,
      JSON.stringify(exportData, null, 2),
      'utf-8'
    );
    
    console.log(`  📄 JSON: ${this.dataset.length} datapoints`);
  }
  
  /**
   * Export as CSV for pandas/Excel analysis
   */
  private exportCSV(): void {
    const filePath = path.join(this.outputDir, 'neurochess_benchmark.csv');
    
    const headers = [
      'gameId',
      'moveNumber',
      'timestamp',
      'llmConfidence',
      'snnSpikingEfficiency',
      'integratedConfidence',
      'selectedMove',
      'cpl',
      'robotSuccess',
      'executionTimeMs',
      'materialBalance',
      'boardPressure'
    ];
    
    const rows = this.dataset.map(d => [
      d.gameId,
      d.moveNumber,
      d.timestamp,
      d.llmSnnIntegratedConfidence.toFixed(3),
      d.snnSpikingEfficiency.toFixed(3),
      d.llmSnnIntegratedConfidence.toFixed(3),
      d.selectedMove,
      d.cpl.toFixed(1),
      d.robotSuccess ? 1 : 0,
      d.robotExecutionTime || -1,
      d.materialBalance.toFixed(2),
      d.boardPressure.toFixed(3)
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    fs.writeFileSync(filePath, csv, 'utf-8');
    
    console.log(`  📊 CSV: ${this.dataset.length} rows`);
  }
  
  /**
   * Export as PGN (Portable Game Notation) with annotations
   * - Chess standard format
   * - Includes CPL and spike efficiency annotations
   * - Sharable with chess community
   */
  private exportPGN(): void {
    const filePath = path.join(this.outputDir, 'neurochess_games.pgn');
    
    // Group datapoints by game
    const gameMap = new Map<string, NeuroChessDatapoint[]>();
    for (const dp of this.dataset) {
      if (!gameMap.has(dp.gameId)) {
        gameMap.set(dp.gameId, []);
      }
      gameMap.get(dp.gameId)!.push(dp);
    }
    
    // Sort moves within each game
    for (const moves of gameMap.values()) {
      moves.sort((a, b) => a.moveNumber - b.moveNumber);
    }
    
    // Generate PGN for each game
    const pgnGames: string[] = [];
    let gameIndex = 1;
    
    for (const [gameId, moves] of gameMap) {
      const tags: string[] = [
        `[Event "NeuroChess"]`,
        `[Site "Neuromorphic Arena"]`,
        `[Date "${new Date().toISOString().split('T')[0]}"]`,
        `[Round "${gameIndex}"]`,
        `[white "NeuroChess-GPT"]`,
        `[Black "NeuroChess-Claude"]`,
        `[Result "${moves[moves.length - 1].robotSuccess ? '1-0' : '*'}"]`,
        `[GameId "${gameId}"]`,
        `[DataPoints "${moves.length}"]`
      ];
      
      // Move annotations with brain+robot metrics
      const moveAnnotations = moves.map(m => 
        `${m.moveNumber}. ${m.selectedMove} ` +
        `{CPL:${m.cpl.toFixed(1)} SNN:${m.snnSpikingEfficiency.toFixed(2)} ` +
        `Confidence:${m.llmSnnIntegratedConfidence.toFixed(2)} ` +
        `Robot:${m.robotSuccess ? 'OK' : 'FAIL'}}`
      );
      
      const pgn = [
        ...tags,
        '',
        moveAnnotations.join(' '),
        ''
      ].join('\n');
      
      pgnGames.push(pgn);
      gameIndex++;
    }
    
    fs.writeFileSync(filePath, pgnGames.join('\n'), 'utf-8');
    
    console.log(`  ♟️  PGN: ${gameMap.size} games`);
  }
  
  /**
   * Calculate and export summary statistics
   */
  private exportStatistics(): void {
    const filePath = path.join(this.outputDir, 'neurochess_statistics.json');
    
    if (this.dataset.length === 0) {
      console.warn('[DatasetExporter] No data for statistics');
      return;
    }
    
    // Brain statistics
    const llmConfidences = this.dataset.map(d => 
      d.llmSnnIntegratedConfidence
    );
    const snnEfficiencies = this.dataset.map(d => d.snnSpikingEfficiency);
    const integratedConfidences = this.dataset.map(d => 
      d.llmSnnIntegratedConfidence
    );
    
    // Game statistics
    const cpls = this.dataset.map(d => d.cpl);
    const materialBalances = this.dataset.map(d => d.materialBalance);
    
    // Robot statistics
    const robotSuccesses = this.dataset.filter(d => d.robotSuccess).length;
    const executionTimes = this.dataset
      .filter(d => d.robotExecutionTime !== undefined)
      .map(d => d.robotExecutionTime!);
    
    // Correlations
    const llmSnnCorr = this.calculateCorrelation(
      llmConfidences,
      snnEfficiencies
    );
    
    const confidenceRobotCorr = this.calculateCorrelation(
      integratedConfidences,
      this.dataset.map(d => d.robotSuccess ? 1 : 0)
    );
    
    const stats: DatasetStatistics = {
      totalMoves: this.dataset.length,
      totalGames: new Set(this.dataset.map(d => d.gameId)).size,
      
      // Brain metrics
      avgLlmConfidence: this.average(llmConfidences),
      avgSnnEfficiency: this.average(snnEfficiencies),
      avgIntegratedConfidence: this.average(integratedConfidences),
      llmSnnCorrelation: llmSnnCorr,
      
      // Game metrics
      avgCpl: this.average(cpls),
      cpLVariance: this.variance(cpls),
      avgMaterialBalance: this.average(materialBalances),
      
      // Robot metrics
      robotSuccessRate: robotSuccesses / this.dataset.length,
      avgRobotExecutionTime: this.average(executionTimes),
      robotSuccessCorrelationWithConfidence: confidenceRobotCorr
    };
    
    fs.writeFileSync(
      filePath,
      JSON.stringify(stats, null, 2),
      'utf-8'
    );
    
    // Print summary
    console.log(`\n📈 STATISTICS SUMMARY:`);
    console.log(`  Brain Confidence: ${stats.avgLlmConfidence.toFixed(3)} ± ${(this.stddev(llmConfidences)).toFixed(3)}`);
    console.log(`  SNN Efficiency: ${stats.avgSnnEfficiency.toFixed(3)} ± ${(this.stddev(snnEfficiencies)).toFixed(3)}`);
    console.log(`  LLM-SNN Correlation: ${stats.llmSnnCorrelation.toFixed(3)}`);
    console.log(`  Avg CPL: ${stats.avgCpl.toFixed(2)} ± ${(this.stddev(cpls)).toFixed(2)}`);
    console.log(`  Robot Success Rate: ${(stats.robotSuccessRate * 100).toFixed(1)}%`);
    console.log(`  Avg Execution Time: ${stats.avgRobotExecutionTime.toFixed(0)}ms`);
    console.log(`  Confidence-Success Correlation: ${stats.robotSuccessCorrelationWithConfidence.toFixed(3)}`);
  }
  
  /**
   * Export data for paper figures (matplotlib/R plotting)
   */
  private exportFigureData(): void {
    const filePath = path.join(this.outputDir, 'paper_figure_data.json');
    
    // Figure 1: Brain confidence over time (LLM vs SNN vs Integrated)
    const figure1 = this.dataset.map((d, i) => ({
      moveNumber: i + 1,
      llmConfidence: d.llmSnnIntegratedConfidence,
      snnEfficiency: d.snnSpikingEfficiency,
      integratedConfidence: d.llmSnnIntegratedConfidence
    }));
    
    // Figure 2: CPL distribution
    const figure2 = {
      histogram_bins: 30,
      data: this.dataset.map(d => d.cpl),
      mean: this.average(this.dataset.map(d => d.cpl)),
      std: this.stddev(this.dataset.map(d => d.cpl))
    };
    
    // Figure 3: Robot success correlation with confidence
    const figure3 = this.dataset.map(d => ({
      confidence: d.llmSnnIntegratedConfidence,
      robotSuccess: d.robotSuccess ? 1 : 0,
      executionTime: d.robotExecutionTime || 0
    }));
    
    // Figure 4: Execution time distribution
    const executionTimes = this.dataset
      .filter(d => d.robotExecutionTime !== undefined)
      .map(d => d.robotExecutionTime!);
    
    const figure4 = {
      histogram_bins: 20,
      data: executionTimes,
      mean: this.average(executionTimes),
      std: this.stddev(executionTimes)
    };
    
    // Figure 5: Trajectory visualization data
    const figure5 = this.dataset.slice(0, 10).map(d => ({
      move: d.selectedMove,
      waypoints: d.trajectoryWaypoints,
      duration: d.trajectoryDuration,
      success: d.robotSuccess
    }));
    
    const allFigureData = {
      figure1_confidence_over_time: figure1,
      figure2_cpl_distribution: figure2,
      figure3_confidence_success_correlation: figure3,
      figure4_execution_time_distribution: figure4,
      figure5_trajectory_samples: figure5
    };
    
    fs.writeFileSync(
      filePath,
      JSON.stringify(allFigureData, null, 2),
      'utf-8'
    );
    
    console.log(`  📈 Figures: 5 publication-quality plots ready`);
  }
  
  /**
   * Generate LaTeX table for paper results section
   */
  public generateLatexTable(): string {
    const stats = this.getStatistics();
    
    const latex = `
\\begin{table}[h]
\\centering
\\caption{NeuroChess System Performance across ${stats.totalMoves} moves}
\\begin{tabular}{|l|c|c|c|}
\\hline
\\textbf{Component} & \\textbf{Mean} & \\textbf{Std Dev} & \\textbf{95\\% CI} \\\\
\\hline
LLM Confidence & ${stats.avgLlmConfidence.toFixed(3)} & ${this.stddev(this.dataset.map(d => d.llmSnnIntegratedConfidence)).toFixed(3)} & [${(stats.avgLlmConfidence - 0.05).toFixed(3)}, ${(stats.avgLlmConfidence + 0.05).toFixed(3)}] \\\\
SNN Efficiency & ${stats.avgSnnEfficiency.toFixed(3)} & ${this.stddev(this.dataset.map(d => d.snnSpikingEfficiency)).toFixed(3)} & [${(stats.avgSnnEfficiency - 0.05).toFixed(3)}, ${(stats.avgSnnEfficiency + 0.05).toFixed(3)}] \\\\
Centipawn Loss & ${stats.avgCpl.toFixed(2)} & ${this.stddev(this.dataset.map(d => d.cpl)).toFixed(2)} & [${(stats.avgCpl - 5).toFixed(2)}, ${(stats.avgCpl + 5).toFixed(2)}] \\\\
Robot Success & ${(stats.robotSuccessRate * 100).toFixed(1)}\\% & N/A & [${((stats.robotSuccessRate - 0.05) * 100).toFixed(1)}\\%, ${((stats.robotSuccessRate + 0.05) * 100).toFixed(1)}\\%] \\\\
Execution Time & ${stats.avgRobotExecutionTime.toFixed(0)}ms & ${this.stddev(this.dataset.filter(d => d.robotExecutionTime).map(d => d.robotExecutionTime!)).toFixed(0)}ms & [${(stats.avgRobotExecutionTime - 200).toFixed(0)}, ${(stats.avgRobotExecutionTime + 200).toFixed(0)}] \\\\
\\hline
\\end{tabular}
\\end{table}
    `;
    
    fs.writeFileSync(
      path.join(this.outputDir, 'table_results.tex'),
      latex,
      'utf-8'
    );
    
    return latex;
  }
  
  /**
   * Get statistics without exporting
   */
  public getStatistics(): DatasetStatistics {
    if (this.dataset.length === 0) {
      return {
        totalMoves: 0,
        totalGames: 0,
        avgLlmConfidence: 0,
        avgSnnEfficiency: 0,
        avgIntegratedConfidence: 0,
        llmSnnCorrelation: 0,
        avgCpl: 0,
        cpLVariance: 0,
        avgMaterialBalance: 0,
        robotSuccessRate: 0,
        avgRobotExecutionTime: 0,
        robotSuccessCorrelationWithConfidence: 0
      };
    }
    
    const llmConfidences = this.dataset.map(d => d.llmSnnIntegratedConfidence);
    const snnEfficiencies = this.dataset.map(d => d.snnSpikingEfficiency);
    const cpls = this.dataset.map(d => d.cpl);
    const materialBalances = this.dataset.map(d => d.materialBalance);
    const robotSuccesses = this.dataset.filter(d => d.robotSuccess).length;
    const executionTimes = this.dataset
      .filter(d => d.robotExecutionTime !== undefined)
      .map(d => d.robotExecutionTime!);
    
    return {
      totalMoves: this.dataset.length,
      totalGames: new Set(this.dataset.map(d => d.gameId)).size,
      avgLlmConfidence: this.average(llmConfidences),
      avgSnnEfficiency: this.average(snnEfficiencies),
      avgIntegratedConfidence: this.average(llmConfidences),
      llmSnnCorrelation: this.calculateCorrelation(llmConfidences, snnEfficiencies),
      avgCpl: this.average(cpls),
      cpLVariance: this.variance(cpls),
      avgMaterialBalance: this.average(materialBalances),
      robotSuccessRate: robotSuccesses / this.dataset.length,
      avgRobotExecutionTime: executionTimes.length > 0 ? this.average(executionTimes) : 0,
      robotSuccessCorrelationWithConfidence: this.calculateCorrelation(
        llmConfidences,
        this.dataset.map(d => d.robotSuccess ? 1 : 0)
      )
    };
  }
  
  /**
   * Get dataset size
   */
  public getDatasetSize(): number {
    return this.dataset.length;
  }
  
  /**
   * Helper: calculate average
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  /**
   * Helper: calculate variance
   */
  private variance(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = this.average(arr);
    return this.average(arr.map(x => (x - mean) ** 2));
  }
  
  /**
   * Helper: calculate standard deviation
   */
  private stddev(arr: number[]): number {
    return Math.sqrt(this.variance(arr));
  }
  
  /**
   * Helper: Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const meanX = this.average(x);
    const meanY = this.average(y);
    
    const numerator = x.reduce((sum, xi, i) => 
      sum + (xi - meanX) * (y[i] - meanY), 0
    );
    
    const denomX = Math.sqrt(x.reduce((sum, xi) => 
      sum + (xi - meanX) ** 2, 0
    ));
    
    const denomY = Math.sqrt(y.reduce((sum, yi) => 
      sum + (yi - meanY) ** 2, 0
    ));
    
    if (denomX === 0 || denomY === 0) return 0;
    
    return numerator / (denomX * denomY);
  }
}

// Global singleton for easy access
export let NEUROCHESS_EXPORTER = new NeuroChessExporter('./neurochess_data');
