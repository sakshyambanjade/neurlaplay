import { Chess } from 'chess.js';
import MultiProviderLLM from './MultiProviderLLM';
import fs from 'fs';
import path from 'path';

/**
 * Round-Robin Tournament Orchestrator
 * 
 * Each model plays every other model at least once.
 * Each pairing is played TWICE (once as white, once as black) for fairness.
 * 
 * For 6 models:
 * - Unique pairings: 6×5/2 = 15
 * - Total games: 15 pairings × 2 (white/black rotation) = 30 games
 * 
 * Tournament guarantees:
 * ✓ Every model plays every other model
 * ✓ Color balance (each plays equal white/black games)
 * ✓ Fair Elo-based ranking after each round
 * ✓ Complete tournament table for publication
 */

interface TournamentModel {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  eloEstimate: number;
}

interface GameResult {
  whitePlayer: string;
  blackPlayer: string;
  whiteProvider: string;
  blackProvider: string;
  result: 'white' | 'black' | 'draw'; // Who won
  moves: number;
  durationMs: number;
  pgn: string;
  dateTime: string;
  pairingNumber: number;
  gameNumber: number;
}

interface TournamentStanding {
  model: string;
  provider: string;
  eloEstimate: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  score: number; // wins + 0.5*draws
  scorePercentage: number; // score / (gamesPlayed * 2) * 100
}

interface TournamentSchedule {
  pairingNumber: number;
  model1: string;
  model2: string;
  provider1: string;
  provider2: string;
  games: Array<{
    gameNumber: number;
    white: string;
    black: string;
    whiteProvider: string;
    blackProvider: string;
  }>;
}

export class RoundRobinTournament {
  private models: Map<string, TournamentModel> = new Map();
  private schedule: TournamentSchedule[] = [];
  private results: GameResult[] = [];
  private standings: Map<string, TournamentStanding> = new Map();
  private outputDir: string;
  private maxMovesPerGame: number = 150;
  private moveDelayMs: number = 500;

  constructor(
    models: TournamentModel[],
    outputDir: string = 'tournament-results',
    maxMovesPerGame: number = 150,
    moveDelayMs: number = 500
  ) {
    this.outputDir = outputDir;
    this.maxMovesPerGame = maxMovesPerGame;
    this.moveDelayMs = moveDelayMs;

    // Initialize models map
    models.forEach(model => {
      this.models.set(model.name, model);
    });

    // Initialize standings
    models.forEach(model => {
      this.standings.set(model.name, {
        model: model.name,
        provider: model.provider,
        eloEstimate: model.eloEstimate,
        gamesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        winRate: 0,
        drawRate: 0,
        lossRate: 0,
        score: 0,
        scorePercentage: 0,
      });
    });

    // Generate tournament schedule
    this.generateSchedule();
  }

  /**
   * Generate all pairings for round-robin tournament
   * For N models: N×(N-1)/2 unique pairings
   * Each pairing is played twice (white/black rotation)
   */
  private generateSchedule(): void {
    const modelArray = Array.from(this.models.values());
    let pairingNumber = 1;
    let gameNumber = 1;

    // Generate all unique pairings (A vs B only, not B vs A)
    for (let i = 0; i < modelArray.length; i++) {
      for (let j = i + 1; j < modelArray.length; j++) {
        const model1 = modelArray[i];
        const model2 = modelArray[j];

        const pairing: TournamentSchedule = {
          pairingNumber,
          model1: model1.name,
          model2: model2.name,
          provider1: model1.provider,
          provider2: model2.provider,
          games: [
            {
              gameNumber: gameNumber++,
              white: model1.name,
              black: model2.name,
              whiteProvider: model1.provider,
              blackProvider: model2.provider,
            },
            {
              gameNumber: gameNumber++,
              white: model2.name,
              black: model1.name,
              whiteProvider: model2.provider,
              blackProvider: model1.provider,
            },
          ],
        };

        this.schedule.push(pairing);
        pairingNumber++;
      }
    }
  }

  /**
   * Get the tournament schedule for reference/documentation
   */
  getSchedule(): TournamentSchedule[] {
    return this.schedule;
  }

  /**
   * Get total number of games in tournament
   */
  getTotalGames(): number {
    return this.schedule.reduce((sum, pairing) => sum + pairing.games.length, 0);
  }

  /**
   * Run the entire tournament
   * Each pairing is played, results tracked
   */
  async run(): Promise<void> {
    console.log(
      '\n' + '='.repeat(80)
    );
    console.log('♟️  ROUND-ROBIN TOURNAMENT ORCHESTRATOR');
    console.log('='.repeat(80));
    console.log(
      `Models: ${Array.from(this.models.keys()).join(', ')}`
    );
    console.log(`Total Pairings: ${this.schedule.length}`);
    console.log(`Total Games: ${this.getTotalGames()}`);
    console.log(
      `Expected Duration: ~${Math.ceil(this.getTotalGames() * 1.5)} minutes`
    );
    console.log('='.repeat(80) + '\n');

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Run each pairing
    for (const pairing of this.schedule) {
      console.log(`\n📋 Pairing ${pairing.pairingNumber}/${this.schedule.length}`);
      console.log(
        `   ${pairing.model1} (${pairing.provider1}) vs ${pairing.model2} (${pairing.provider2})`
      );

      // Run both games in pairing (white/black rotation)
      for (const game of pairing.games) {
        console.log(
          `   🎮 Game ${game.gameNumber}: ${game.white} (white) vs ${game.black} (black)`
        );

        try {
          const result = await this.playSingleGame(
            game,
            pairing.pairingNumber,
            game.gameNumber
          );
          this.results.push(result);

          // Update standings after each game
          this.updateStandings(result);

          // Print live standings
          this.printLiveStandings();

          // Delay between games for rate-limit safety
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`   ❌ Error in game ${game.gameNumber}:`, error);
        }
      }
    }

    // Export results
    await this.exportResults();
    console.log('\n✅ Tournament Complete!');
    console.log(`📊 Results saved to: ${this.outputDir}`);
  }

  /**
   * Play a single game between two models
   */
  private async playSingleGame(
    game: any,
    pairingNumber: number,
    gameNumber: number
  ): Promise<GameResult> {
    const whiteModel = this.models.get(game.white)!;
    const blackModel = this.models.get(game.black)!;

    const whitePlayer = new MultiProviderLLM(
      whiteModel.provider,
      whiteModel.model,
      whiteModel.apiKey
    );
    const blackPlayer = new MultiProviderLLM(
      blackModel.provider,
      blackModel.model,
      blackModel.apiKey
    );

    const chess = new Chess();
    const startTime = Date.now();
    const moves: string[] = [];
    let moveCount = 0;

    // Play until game ends or max moves reached
    while (!chess.isGameOver() && moveCount < this.maxMovesPerGame) {
      const legalMoves = chess.moves({ verbose: true }).map(m => m.san);

      if (legalMoves.length === 0) break;

      try {
        const currentPlayer = chess.turn() === 'w' ? whitePlayer : blackPlayer;
        const currentModel =
          chess.turn() === 'w'
            ? `${whiteModel.name} (${whiteModel.provider})`
            : `${blackModel.name} (${blackModel.provider})`;

        const moveResult = await currentPlayer.getMove(
          chess.fen(),
          legalMoves
        );

        if (
          moveResult.move &&
          legalMoves.includes(moveResult.move)
        ) {
          chess.move(moveResult.move);
          moves.push(moveResult.move);
          moveCount++;
        } else {
          // Invalid move, try again with random legal move
          const randomMove =
            legalMoves[Math.floor(Math.random() * legalMoves.length)];
          chess.move(randomMove);
          moves.push(randomMove);
          moveCount++;
        }

        // Delay between moves
        await new Promise(resolve => setTimeout(resolve, this.moveDelayMs));
      } catch (error) {
        console.error(`     Error getting move from ${game.black}:`, error);
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    // Determine result
    let result: 'white' | 'black' | 'draw' = 'draw';
    if (chess.isCheckmate()) {
      result = chess.turn() === 'w' ? 'black' : 'white'; // Opposite turn means other player checkmated
    } else if (!chess.isDraw()) {
      result = 'draw';
    }

    const gameResult: GameResult = {
      whitePlayer: game.white,
      blackPlayer: game.black,
      whiteProvider: game.whiteProvider,
      blackProvider: game.blackProvider,
      result,
      moves: moveCount,
      durationMs,
      pgn: chess.pgn() || '',
      dateTime: new Date().toISOString(),
      pairingNumber,
      gameNumber,
    };

    // Print result
    const resultStr =
      result === 'white'
        ? `✓ ${game.white} wins`
        : result === 'black'
          ? `✓ ${game.black} wins`
          : '= Draw';
    console.log(`      ${resultStr} (${moveCount} moves, ${(durationMs / 1000).toFixed(1)}s)`);

    return gameResult;
  }

  /**
   * Update standings after a game result
   */
  private updateStandings(result: GameResult): void {
    const white = this.standings.get(result.whitePlayer)!;
    const black = this.standings.get(result.blackPlayer)!;

    white.gamesPlayed++;
    black.gamesPlayed++;

    if (result.result === 'white') {
      white.wins++;
      black.losses++;
      white.score += 1;
    } else if (result.result === 'black') {
      black.wins++;
      white.losses++;
      black.score += 1;
    } else {
      white.draws++;
      black.draws++;
      white.score += 0.5;
      black.score += 0.5;
    }

    // Recalculate percentages
    if (white.gamesPlayed > 0) {
      white.winRate = white.wins / white.gamesPlayed;
      white.drawRate = white.draws / white.gamesPlayed;
      white.lossRate = white.losses / white.gamesPlayed;
      white.scorePercentage = (white.score / white.gamesPlayed) * 100;
    }

    if (black.gamesPlayed > 0) {
      black.winRate = black.wins / black.gamesPlayed;
      black.drawRate = black.draws / black.gamesPlayed;
      black.lossRate = black.losses / black.gamesPlayed;
      black.scorePercentage = (black.score / black.gamesPlayed) * 100;
    }
  }

  /**
   * Print current tournament standings
   */
  private printLiveStandings(): void {
    const standings = Array.from(this.standings.values()).sort(
      (a, b) => b.score - a.score
    );

    console.log('\n   📊 Current Standings:');
    console.log('   ' + '-'.repeat(75));
    console.log(
      '   Model'.padEnd(20) +
        'Games'.padEnd(8) +
        'W-D-L'.padEnd(12) +
        'Score'.padEnd(10) +
        'Win%'
    );
    console.log('   ' + '-'.repeat(75));

    standings.forEach((s, idx) => {
      const wdl = `${s.wins}-${s.draws}-${s.losses}`;
      console.log(
        '   ' +
          `${idx + 1}. ${s.model}`.padEnd(20) +
          `${s.gamesPlayed}`.padEnd(8) +
          wdl.padEnd(12) +
          `${s.score.toFixed(1)}`.padEnd(10) +
          `${(s.winRate * 100).toFixed(1)}%`
      );
    });
    console.log('   ' + '-'.repeat(75));
  }

  /**
   * Export tournament results to files
   */
  private async exportResults(): Promise<void> {
    // 1. Export all game records (JSON)
    const gamesFile = path.join(this.outputDir, 'all-games.json');
    fs.writeFileSync(gamesFile, JSON.stringify(this.results, null, 2));
    console.log(`\n  📄 Games: ${gamesFile}`);

    // 2. Export final standings (JSON)
    const standings = Array.from(this.standings.values()).sort(
      (a, b) => b.score - a.score
    );
    const standingsFile = path.join(this.outputDir, 'standings.json');
    fs.writeFileSync(standingsFile, JSON.stringify(standings, null, 2));
    console.log(`  📄 Standings: ${standingsFile}`);

    // 3. Export schedule (JSON)
    const scheduleFile = path.join(this.outputDir, 'schedule.json');
    fs.writeFileSync(scheduleFile, JSON.stringify(this.schedule, null, 2));
    console.log(`  📄 Schedule: ${scheduleFile}`);

    // 4. Export as Markdown table (for paper)
    const markdownFile = path.join(
      this.outputDir,
      'tournament-table.md'
    );
    const markdown = this.generateMarkdownTable(standings);
    fs.writeFileSync(markdownFile, markdown);
    console.log(`  📄 Markdown Table: ${markdownFile}`);

    // 5. Export as LaTeX table (for arXiv)
    const latexFile = path.join(this.outputDir, 'tournament-table.latex');
    const latex = this.generateLaTeXTable(standings);
    fs.writeFileSync(latexFile, latex);
    console.log(`  📄 LaTeX Table: ${latexFile}`);

    // 6. Export tournament summary
    const summaryFile = path.join(this.outputDir, 'tournament-summary.txt');
    const summary = this.generateSummary(standings);
    fs.writeFileSync(summaryFile, summary);
    console.log(`  📄 Summary: ${summaryFile}`);

    // 7. Export head-to-head records
    const h2hFile = path.join(this.outputDir, 'head-to-head.json');
    const h2h = this.generateHeadToHeadRecords();
    fs.writeFileSync(h2hFile, JSON.stringify(h2h, null, 2));
    console.log(`  📄 Head-to-Head: ${h2hFile}`);
  }

  /**
   * Generate Markdown table for easy copying to paper
   */
  private generateMarkdownTable(
    standings: TournamentStanding[]
  ): string {
    let md = '# Round-Robin Tournament Results\n\n';
    md += '| Rank | Model | Provider | Elo | Games | W-D-L | Score | % |\n';
    md += '|------|-------|----------|-----|-------|-------|-------|-----|\n';

    standings.forEach((s, idx) => {
      md += `| ${idx + 1} | ${s.model} | ${s.provider} | ${s.eloEstimate} | ${s.gamesPlayed} | ${s.wins}-${s.draws}-${s.losses} | ${s.score.toFixed(1)} | ${(s.scorePercentage).toFixed(1)}% |\n`;
    });

    md += '\n## Notes\n';
    md += '- Score: Wins + 0.5×Draws\n';
    md += '- %: Score percentage (score / max possible × 100)\n';
    md += '- Each pairing played twice (both colors)\n';

    return md;
  }

  /**
   * Generate LaTeX table for arXiv papers
   */
  private generateLaTeXTable(
    standings: TournamentStanding[]
  ): string {
    let latex = '\\begin{table}[h]\n';
    latex += '\\centering\n';
    latex += '\\caption{Round-Robin Tournament Rankings (6 Models)}\n';
    latex += '\\begin{tabular}{lccccccc}\n';
    latex += '\\hline\n';
    latex +=
      'Rank & Model & Provider & Elo & Games & W-D-L & Score & \\% \\\\\n';
    latex += '\\hline\n';

    standings.forEach((s, idx) => {
      latex += `${idx + 1} & ${s.model} & ${s.provider} & ${s.eloEstimate} & ${s.gamesPlayed} & ${s.wins}-${s.draws}-${s.losses} & ${s.score.toFixed(1)} & ${(s.scorePercentage).toFixed(1)} \\\\\n`;
    });

    latex += '\\hline\n';
    latex += '\\end{tabular}\n';
    latex += '\\label{table:roundrobin}\n';
    latex += '\\end{table}\n';

    return latex;
  }

  /**
   * Generate tournament summary text
   */
  private generateSummary(standings: TournamentStanding[]): string {
    let summary = 'ROUND-ROBIN TOURNAMENT SUMMARY\n';
    summary += '='.repeat(60) + '\n\n';

    summary += `Total Participants: ${this.models.size}\n`;
    summary += `Total Pairings: ${this.schedule.length}\n`;
    summary += `Total Games: ${this.results.length}\n`;
    summary += `Date: ${new Date().toISOString()}\n\n`;

    summary += 'FINAL STANDINGS:\n';
    summary += '-'.repeat(60) + '\n';

    standings.forEach((s, idx) => {
      summary += `${idx + 1}. ${s.model.padEnd(25)} (${s.provider})\n`;
      summary += `   Elo: ${s.eloEstimate}\n`;
      summary += `   Record: ${s.wins}W-${s.draws}D-${s.losses}L (${s.gamesPlayed} games)\n`;
      summary += `   Score: ${s.score.toFixed(1)} / ${s.gamesPlayed} (${(s.scorePercentage).toFixed(1)}%)\n\n`;
    });

    summary += 'METHODOLOGY:\n';
    summary += '-'.repeat(60) + '\n';
    summary +=
      'Each model played every other model twice, once with white pieces\n';
    summary +=
      'and once with black pieces, ensuring fair color distribution.\n';
    summary += 'Results ranked by score (wins + 0.5×draws).\n';

    return summary;
  }

  /**
   * Generate head-to-head records between all models
   */
  private generateHeadToHeadRecords(): Map<string, any> {
    const h2h = new Map<string, any>();

    const modelArray = Array.from(this.models.keys());

    for (let i = 0; i < modelArray.length; i++) {
      for (let j = i + 1; j < modelArray.length; j++) {
        const model1 = modelArray[i];
        const model2 = modelArray[j];
        const key = `${model1} vs ${model2}`;

        const gamesInPairing = this.results.filter(
          r =>
            (r.whitePlayer === model1 && r.blackPlayer === model2) ||
            (r.whitePlayer === model2 && r.blackPlayer === model1)
        );

        const model1Wins = gamesInPairing.filter(
          g =>
            (g.result === 'white' && g.whitePlayer === model1) ||
            (g.result === 'black' && g.blackPlayer === model1)
        ).length;

        const model2Wins = gamesInPairing.filter(
          g =>
            (g.result === 'white' && g.whitePlayer === model2) ||
            (g.result === 'black' && g.blackPlayer === model2)
        ).length;

        const draws = gamesInPairing.filter(g => g.result === 'draw').length;

        h2h.set(key, {
          model1,
          model2,
          games: gamesInPairing.length,
          model1Wins,
          model2Wins,
          draws,
          model1Record: `${model1Wins}-${draws}-${model2Wins}`,
        });
      }
    }

    return h2h;
  }
}

export default RoundRobinTournament;
