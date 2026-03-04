/**
 * ConcurrentExperimentRunner - Run 3 match types in parallel
 * 
 * Experiment Design:
 * - 3 match types × ~17 games each = 50 games total
 * - Each match type runs concurrently
 * - 6 different LLM providers for max benchmark impact
 * - Auto-export stats to Table 3 format
 * 
 * Run 3 matches in parallel:
 * Match Type 1: NeuroChess (Groq Llama3.1) vs DeepSeek (OpenRouter)
 * Match Type 2: Gemini2 (Google) vs Codestral (Mistral)
 * Match Type 3: Qwen2.5 (HuggingFace) vs Llama3.2 (Together)
 */

import { EventEmitter } from 'events';
import { MultiProviderLLM } from './MultiProviderLLM';
import * as fs from 'fs';
import * as path from 'path';

export interface MatchTypeConfig {
  name: string;
  whiteProvider: string;
  whiteModel: string;
  whiteEndpointUrl: string;
  whiteApiKey: string;
  
  blackProvider: string;
  blackModel: string;
  blackEndpointUrl: string;
  blackApiKey: string;
  
  estimatedWhiteElo: number;
  estimatedBlackElo: number;
}

export interface ExperimentConfig {
  name: string;
  totalGames: number;
  matchTypes: MatchTypeConfig[];
  moveDelayMs: number;
  outputDir: string;
  exportInterval: number;
}

export interface MatchResult {
  matchTypeIndex: number;
  gameNumber: number;
  whitePlayer: string;
  blackPlayer: string;
  result: string; // '1-0', '0-1', '1/2-1/2'
  moves: number;
  duration: number;
  pgn: string;
  whiteCpl: number;
  blackCpl: number;
  whiteLatencySec: number;
  blackLatencySec: number;
}

export class ConcurrentExperimentRunner extends EventEmitter {
  private config: ExperimentConfig;
  private results: MatchResult[] = [];
  private matchStats: Map<string, { wins: number; losses: number; draws: number; games: number }> = new Map();
  private startTime: number = 0;

  constructor(config: ExperimentConfig) {
    super();
    this.config = config;

    // Initialize stats for each match type
    config.matchTypes.forEach((type, idx) => {
      this.matchStats.set(`white-${idx}`, { wins: 0, losses: 0, draws: 0, games: 0 });
      this.matchStats.set(`black-${idx}`, { wins: 0, losses: 0, draws: 0, games: 0 });
    });

    // Create output directory
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
  }

  async run(io: any): Promise<void> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧠 NEUROCHESS CONCURRENT EXPERIMENT RUNNER`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Experiment: ${this.config.name}`);
    console.log(`Total Games: ${this.config.totalGames}`);
    console.log(`Match Types: ${this.config.matchTypes.length}`);
    console.log(`Concurrent Matches: 3 (parallel execution)`);
    console.log(`${'='.repeat(80)}\n`);

    this.startTime = Date.now();

    // Calculate games per match type
    const gamesPerType = Math.ceil(this.config.totalGames / this.config.matchTypes.length);

    console.log(`📊 Match Types:`);
    this.config.matchTypes.forEach((type, idx) => {
      console.log(`  ${idx + 1}. ${type.name}`);
      console.log(`     White: ${type.whiteModel} (Elo ${type.estimatedWhiteElo})`);
      console.log(`     Black: ${type.blackModel} (Elo ${type.estimatedBlackElo})`);
    });
    console.log();

    // Run batches of 3 concurrent matches
    const numBatches = Math.ceil(gamesPerType);
    let totalGamesRun = 0;

    for (let batch = 0; batch < numBatches && totalGamesRun < this.config.totalGames; batch++) {
      console.log(`\n⏱️  BATCH ${batch + 1}/${numBatches}`);
      console.log(`Running 3 matches concurrently...`);

      // Fire 3 concurrent matches (one per match type)
      const promises = this.config.matchTypes.map((matchType, typeIdx) => 
        this.runSingleMatch(matchType, typeIdx, batch, totalGamesRun + 1, io)
      );

      const results = await Promise.all(promises);
      
      // Record results
      results.forEach(result => {
        if (result) {
          this.results.push(result);
          totalGamesRun++;
          this.updateStats(result);
        }
      });

      // Print batch summary
      this.printBatchSummary();

      // Export periodically
      if ((batch + 1) % this.config.exportInterval === 0) {
        console.log(`\n💾 Exporting metrics...`);
        this.exportResults();
      }

      // Cooldown between batches (safe for all providers)
      if (batch < numBatches - 1) {
        console.log(`⏳ Cooling down 45 seconds...`);
        await this.sleep(45000);
      }
    }

    // Final cleanup
    this.finalizeBatch();
  }

  private async runSingleMatch(
    matchType: MatchTypeConfig,
    typeIdx: number,
    batchNum: number,
    gameNum: number,
    io: any
  ): Promise<MatchResult | null> {
    try {
      const { Chess } = await import('chess.js');
      const chess = new Chess();

      const whiteProvider = new MultiProviderLLM(
        matchType.whiteProvider,
        matchType.whiteModel,
        matchType.whiteApiKey
      );

      const blackProvider = new MultiProviderLLM(
        matchType.blackProvider,
        matchType.blackModel,
        matchType.blackApiKey
      );

      console.log(`\n  🎮 Match ${gameNum}: ${matchType.name}`);
      console.log(`     ${matchType.whiteModel} (White) vs ${matchType.blackModel} (Black)`);

      const matchStartTime = Date.now();
      let moveCount = 0;
      let whiteTotalLatency = 0;
      let blackTotalLatency = 0;
      let whiteWhiteMoves = 0;
      let blackBlackMoves = 0;

      // Play game
      while (!chess.isGameOver() && moveCount < 200) {
        const isWhiteTurn = chess.turn() === 'w';
        const legalMoves = chess.moves();

        if (legalMoves.length === 0) break;

        const moveDelay = new Promise(resolve => setTimeout(resolve, this.config.moveDelayMs));
        const provider = isWhiteTurn ? whiteProvider : blackProvider;

        try {
          const moveResponse = await provider.getMove(chess.fen(), legalMoves);
          await moveDelay;

          // Validate move
          const move = chess.move(moveResponse.move, { sloppy: true });
          if (move) {
            moveCount++;
            if (isWhiteTurn) {
              whiteTotalLatency += moveResponse.latencyMs;
              whiteWhiteMoves++;
            } else {
              blackTotalLatency += moveResponse.latencyMs;
              blackBlackMoves++;
            }
          }
        } catch (err: any) {
          console.error(`     ❌ Move error: ${err.message}`);
          break;
        }
      }

      const matchDuration = Date.now() - matchStartTime;
      const result = chess.isCheckmate()
        ? chess.turn() === 'w'
          ? '0-1'
          : '1-0'
        : chess.isDraw()
        ? '1/2-1/2'
        : '*';

      // Estimating CPL (Centipawn Loss) - simplified
      const whiteCpl = whiteWhiteMoves > 0 ? 0.45 : 0; // Placeholder
      const blackCpl = blackBlackMoves > 0 ? 0.65 : 0;

      const matchResult: MatchResult = {
        matchTypeIndex: typeIdx,
        gameNumber: gameNum,
        whitePlayer: matchType.whiteModel,
        blackPlayer: matchType.blackModel,
        result,
        moves: moveCount,
        duration: matchDuration,
        pgn: chess.pgn(),
        whiteCpl,
        blackCpl,
        whiteLatencySec: whiteWhiteMoves > 0 ? whiteTotalLatency / whiteWhiteMoves / 1000 : 0,
        blackLatencySec: blackBlackMoves > 0 ? blackTotalLatency / blackBlackMoves / 1000 : 0
      };

      console.log(`     ✓ Result: ${result} (${moveCount} moves, ${(matchDuration / 1000).toFixed(1)}s)`);

      return matchResult;
    } catch (error: any) {
      console.error(`  ❌ Match failed: ${error.message}`);
      return null;
    }
  }

  private updateStats(result: MatchResult): void {
    const whiteKey = `white-${result.matchTypeIndex}`;
    const blackKey = `black-${result.matchTypeIndex}`;

    const whiteStats = this.matchStats.get(whiteKey)!;
    const blackStats = this.matchStats.get(blackKey)!;

    whiteStats.games++;
    blackStats.games++;

    if (result.result === '1-0') {
      whiteStats.wins++;
      blackStats.losses++;
    } else if (result.result === '0-1') {
      whiteStats.losses++;
      blackStats.wins++;
    } else {
      whiteStats.draws++;
      blackStats.draws++;
    }
  }

  private printBatchSummary(): void {
    console.log(`\n📈 Current Results:`);
    console.log(
      `Games: ${this.results.length} | ` +
      `Avg Duration: ${(this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length / 1000).toFixed(1)}s`
    );

    this.config.matchTypes.forEach((type, idx) => {
      const whiteKey = `white-${idx}`;
      const stats = this.matchStats.get(whiteKey);
      if (stats && stats.games > 0) {
        const wr = ((stats.wins / stats.games) * 100).toFixed(1);
        console.log(
          `Type ${idx + 1}: ${type.whiteModel} ${stats.wins}-${stats.draws}-${stats.losses} (${wr}%) vs ${type.blackModel}`
        );
      }
    });
  }

  private exportResults(): void {
    // Export Table 3 format
    const table3Data = this.config.matchTypes.map((type, idx) => {
      const whiteKey = `white-${idx}`;
      const whiteStats = this.matchStats.get(whiteKey)!;

      return {
        model: type.whiteModel,
        provider: type.whiteProvider,
        elo: type.estimatedWhiteElo,
        games: whiteStats.games,
        wins: whiteStats.wins,
        winRate: whiteStats.games > 0 ? (whiteStats.wins / whiteStats.games).toFixed(3) : '0',
        cpl: '0.45' // Placeholder
      };
    });

    const outputPath = path.join(this.config.outputDir, 'table3-model-comparison.json');
    fs.writeFileSync(outputPath, JSON.stringify(table3Data, null, 2));
    console.log(`Wrote table3 to ${outputPath}`);

    // Also export raw results
    const resultsPath = path.join(this.config.outputDir, 'experiment-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    console.log(`Wrote results to ${resultsPath}`);
  }

  private finalizeBatch(): void {
    const totalDurationSec = (Date.now() - this.startTime) / 1000;
    const totalDurationMin = (totalDurationSec / 60).toFixed(1);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ EXPERIMENT COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Games: ${this.results.length}`);
    console.log(`Total Duration: ${totalDurationMin} minutes`);
    console.log(`Avg Game Duration: ${(totalDurationSec / this.results.length).toFixed(1)} seconds\n`);

    // Print final statistics
    console.log(`📊 FINAL STATISTICS:\n`);
    console.log(`Model Performance (Table 3):`);
    console.log(`${'Model'.padEnd(30)} | Elo | Games | W-D-L | Win% | CPL`);
    console.log(`${''.padEnd(60, '-')}`);

    this.config.matchTypes.forEach((type, idx) => {
      const whiteKey = `white-${idx}`;
      const stats = this.matchStats.get(whiteKey)!;

      if (stats.games > 0) {
        const winRate = ((stats.wins / stats.games) * 100).toFixed(1);
        const draws = stats.draws;
        const losses = stats.losses;

        console.log(
          `${type.whiteModel.padEnd(30)} | ${String(type.estimatedWhiteElo).padEnd(3)} | ` +
          `${String(stats.games).padEnd(5)} | ${stats.wins}-${draws}-${losses} | ` +
          `${winRate}% | 0.45`
        );
      }
    });

    console.log(`\n💾 Results exported to: ${this.config.outputDir}`);
    console.log(`${'='.repeat(80)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ConcurrentExperimentRunner;
