import fs from 'node:fs';
import path from 'node:path';

export interface GameResult {
  gameId: string;
  whiteModel: string;
  blackModel: string;
  winner: 'white' | 'black' | 'draw';
  totalMoves: number;
  durationMs: number;
  avgCPL: number;           // Centipawn loss vs Stockfish
  blunders: number;         // Moves with CPL > 200
  gamePhases: {
    openingMoves: number;   // Moves 1-15
    midgameMoves: number;   // 16-50
    endgameMoves: number;   // 51+
  };
  finalFEN: string;
  reasoningSamples: string[];  // LLM reasoning for key moves
}

export interface PaperSummary {
  totalGames: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  whiteWinRate: number;
  avgGameDuration: number;
  avgMoves: number;
  avgCPL: { white: number; black: number };
  blunderRate: number;
  totalBlunders: number;
  topBlunderGames: string[];
  phasePerformance: {
    openingAccuracy: number;
    midgameAccuracy: number;
    endgameAccuracy: number;
  };
  latexTable3: string;        // Copy-paste ready for paper
  timestamp: string;
}

export class PaperResults {
  private results: GameResult[] = [];
  private whiteModel: string = '';
  private blackModel: string = '';

  constructor(whiteModel: string, blackModel: string) {
    this.whiteModel = whiteModel;
    this.blackModel = blackModel;
  }

  addGameResult(game: GameResult): void {
    this.results.push(game);
    console.log(`📊 Game ${game.gameId}: ${game.winner} (${game.totalMoves} moves)`);
  }

  generateSummary(): PaperSummary {
    const totalGames = this.results.length;
    const whiteWins = this.results.filter(g => g.winner === 'white').length;
    const blackWins = this.results.filter(g => g.winner === 'black').length;
    const draws = totalGames - whiteWins - blackWins;

    const summary: PaperSummary = {
      totalGames,
      whiteWins,
      blackWins,
      draws,
      whiteWinRate: totalGames > 0 ? whiteWins / totalGames : 0,
      avgGameDuration: totalGames > 0 ? this.results.reduce((sum, g) => sum + g.durationMs, 0) / totalGames / 1000 : 0,
      avgMoves: totalGames > 0 ? this.results.reduce((sum, g) => sum + g.totalMoves, 0) / totalGames : 0,
      avgCPL: {
        white: totalGames > 0 ? this.results.reduce((sum, g) => sum + g.avgCPL * (g.winner === 'white' ? 1 : 0.5), 0) / totalGames : 0,
        black: totalGames > 0 ? this.results.reduce((sum, g) => sum + g.avgCPL * (g.winner === 'black' ? 1 : 0.5), 0) / totalGames : 0
      },
      blunderRate: this.computeBlunderRate(),
      totalBlunders: this.results.reduce((sum, g) => sum + g.blunders, 0),
      topBlunderGames: this.getTopBlunderGames(),
      phasePerformance: this.computePhasePerformance(),
      latexTable3: this.generateLatexTable3(),
      timestamp: new Date().toISOString()
    };

    // SAVE TO DISK
    const researchDir = path.resolve(process.cwd(), '../research');
    if (!fs.existsSync(researchDir)) {
      fs.mkdirSync(researchDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(researchDir, 'paper-results.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(researchDir, 'raw-games.json'), JSON.stringify(this.results, null, 2));
    fs.writeFileSync(path.join(researchDir, 'paper-latex-table3.tex'), summary.latexTable3);
    
    console.log('\n🎉 PAPER RESULTS SAVED!');
    console.log('📁 ./research/paper-results.json');
    console.log('📁 ./research/raw-games.json');
    console.log('📁 ./research/paper-latex-table3.tex');
    
    return summary;
  }

  private computeBlunderRate(): number {
    const totalMoves = this.results.reduce((sum, g) => sum + g.totalMoves, 0);
    if (totalMoves === 0) return 0;
    
    const totalBlunders = this.results.reduce((sum, g) => sum + g.blunders, 0);
    return totalBlunders / totalMoves;
  }

  private computePhasePerformance(): any {
    if (this.results.length === 0) {
      return {
        openingAccuracy: 0,
        midgameAccuracy: 0,
        endgameAccuracy: 0
      };
    }
    
    // Compute weighted average CPL for each phase
    let openingCPL = 0, midgameCPL = 0, endgameCPL = 0;
    let openingCount = 0, midgameCount = 0, endgameCount = 0;
    
    for (const g of this.results) {
      const totalMoves = g.totalMoves;
      const cpl = g.avgCPL;
      
      // Weight by number of moves in each phase
      const openingMoves = Math.min(15, totalMoves);
      const midgameMoves = Math.max(0, Math.min(35, totalMoves - 15));
      const endgameMoves = Math.max(0, totalMoves - 50);
      
      openingCPL += cpl * openingMoves;
      openingCount += openingMoves;
      midgameCPL += cpl * midgameMoves;
      midgameCount += midgameMoves;
      endgameCPL += cpl * endgameMoves;
      endgameCount += endgameMoves;
    }
    
    const avgOpeningCPL = openingCount > 0 ? openingCPL / openingCount : 0;
    const avgMidgameCPL = midgameCount > 0 ? midgameCPL / midgameCount : 0;
    const avgEndgameCPL = endgameCount > 0 ? endgameCPL / endgameCount : 0;
    
    return {
      openingAccuracy: Math.max(0, 100 - avgOpeningCPL / 2),
      midgameAccuracy: Math.max(0, 100 - avgMidgameCPL / 2),
      endgameAccuracy: Math.max(0, 100 - avgEndgameCPL / 2)
    };
  }

  private getTopBlunderGames(): string[] {
    // Find games with most blunders
    const sorted = [...this.results]
      .sort((a, b) => b.blunders - a.blunders)
      .slice(0, 5)
      .map(g => `${g.gameId} (${g.blunders} blunders)`);
    return sorted;
  }

  private generateLatexTable3(): string {
    const totalGames = this.results.length;
    if (totalGames === 0) {
      return '% No games completed yet';
    }
    
    const whiteWins = this.results.filter(g => g.winner === 'white').length;
    const blackWins = this.results.filter(g => g.winner === 'black').length;
    
    // Compute actual metrics from data
    const whiteGames = this.results.filter(g => g.whiteModel === this.whiteModel);
    const blackGames = this.results.filter(g => g.blackModel === this.blackModel);
    
    const avgCplWhite = whiteGames.length > 0 
      ? whiteGames.reduce((sum, g) => sum + g.avgCPL, 0) / whiteGames.length 
      : 0;
    const avgCplBlack = blackGames.length > 0 
      ? blackGames.reduce((sum, g) => sum + g.avgCPL, 0) / blackGames.length 
      : 0;
    
    const blundersPerGameWhite = whiteGames.length > 0
      ? whiteGames.reduce((sum, g) => sum + g.blunders, 0) / whiteGames.length
      : 0;
    const blundersPerGameBlack = blackGames.length > 0
      ? blackGames.reduce((sum, g) => sum + g.blunders, 0) / blackGames.length
      : 0;
    
    // Accuracy = 1 - (CPL / 100) as rough approximation
    const accuracyWhite = Math.max(0, 100 - avgCplWhite / 2);
    const accuracyBlack = Math.max(0, 100 - avgCplBlack / 2);
    
    return `\\begin{table}[h!]
\\centering
\\caption{LLM Chess Performance Comparison (${totalGames} games)}
\\begin{tabular}{lcccc}
\\toprule
Model & Win Rate & Avg CPL & Blunders/Game & Accuracy \\\\
\\midrule
${this.whiteModel} & ${(whiteWins/totalGames*100).toFixed(1)}\\% & ${avgCplWhite.toFixed(1)} & ${blundersPerGameWhite.toFixed(1)} & ${accuracyWhite.toFixed(1)}\\% \\\\
${this.blackModel} & ${(blackWins/totalGames*100).toFixed(1)}\\% & ${avgCplBlack.toFixed(1)} & ${blundersPerGameBlack.toFixed(1)} & ${accuracyBlack.toFixed(1)}\\% \\\\
\\bottomrule
\\end{tabular}
\\label{tab:llm-chess}
\\end{table}`;
  }
}
