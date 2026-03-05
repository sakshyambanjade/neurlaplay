import * as fs from 'fs';
import * as path from 'path';

export interface GameRecord {
  matchId: string;
  timestamp: string;
  whiteBotName: string;
  whiteModel: string;
  blackBotName: string;
  blackModel: string;
  result: 'white' | 'black' | 'draw';
  pgn: string;
  fen: string;
  moves: MoveRecord[];
  totalMoves: number;
  gameStatus: string;
  duration_ms: number;
}

export interface MoveRecord {
  moveNumber: number;
  color: 'white' | 'black';
  move: string;
  fen: string;
  confidence: number;
  spikeEfficiency: number;
  latencyMs: number;
  reasoning: string;
  timestamp: string;
}

export class GameLogger {
  private gamesDir: string;

  constructor(gamesDir: string = './game-data') {
    this.gamesDir = gamesDir;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.gamesDir)) {
      fs.mkdirSync(this.gamesDir, { recursive: true });
    }
  }

  /**
   * Log a move during game play
   */
  logMove(matchId: string, moveRecord: MoveRecord): void {
    const gameFile = path.join(this.gamesDir, `${matchId}-moves.jsonl`);
    const line = JSON.stringify(moveRecord) + '\n';
    fs.appendFileSync(gameFile, line, 'utf-8');
  }

  /**
   * Save complete game after it ends
   */
  saveGameResult(gameRecord: GameRecord): string {
    const fileName = `${gameRecord.matchId}.json`;
    const filePath = path.join(this.gamesDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(gameRecord, null, 2), 'utf-8');
    return filePath;
  }

  /**
   * Get all past games
   */
  getAllGames(): GameRecord[] {
    this.ensureDirectoryExists();
    
    const files = fs.readdirSync(this.gamesDir).filter(f => f.endsWith('.json'));
    const games: GameRecord[] = [];

    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(this.gamesDir, file), 'utf-8');
        const game = JSON.parse(content);
        games.push(game);
      } catch (err) {
        console.error(`Error reading game file ${file}:`, err);
      }
    });

    // Sort by timestamp descending (newest first)
    return games.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get a specific game by matchId
   */
  getGame(matchId: string): GameRecord | null {
    const filePath = path.join(this.gamesDir, `${matchId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`Error reading game ${matchId}:`, err);
      return null;
    }
  }

  /**
   * Get move history for a game
   */
  getMoveHistory(matchId: string): MoveRecord[] {
    const movesFile = path.join(this.gamesDir, `${matchId}-moves.jsonl`);
    
    if (!fs.existsSync(movesFile)) {
      return [];
    }

    try {
      const lines = fs.readFileSync(movesFile, 'utf-8').split('\n').filter(l => l);
      return lines.map(line => JSON.parse(line));
    } catch (err) {
      console.error(`Error reading moves for ${matchId}:`, err);
      return [];
    }
  }

  /**
   * Delete old games (cleanup)
   */
  deleteGamesOlderThan(daysOld: number): number {
    this.ensureDirectoryExists();
    
    const files = fs.readdirSync(this.gamesDir);
    const now = Date.now();
    const ageMs = daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(this.gamesDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > ageMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    return deletedCount;
  }

  /**
   * Export game as PGN
   */
  exportGameAsPGN(matchId: string): string {
    const game = this.getGame(matchId);
    
    if (!game) {
      throw new Error(`Game ${matchId} not found`);
    }

    return game.pgn;
  }

  /**
   * Get game statistics for research
   */
  getGameStats() {
    const games = this.getAllGames();
    
    const totalGames = games.length;
    const whiteWins = games.filter(g => g.result === 'white').length;
    const blackWins = games.filter(g => g.result === 'black').length;
    const draws = games.filter(g => g.result === 'draw').length;
    
    const avgMoves = games.length > 0
      ? games.reduce((sum, g) => sum + g.totalMoves, 0) / games.length
      : 0;

    const avgDuration = games.length > 0
      ? games.reduce((sum, g) => sum + g.duration_ms, 0) / games.length
      : 0;

    return {
      totalGames,
      whiteWins,
      blackWins,
      draws,
      averageMoves: avgMoves.toFixed(1),
      averageDuration_ms: Math.round(avgDuration),
      games: games.map(g => ({
        matchId: g.matchId,
        timestamp: g.timestamp,
        whiteBotName: g.whiteBotName,
        blackBotName: g.blackBotName,
        result: g.result,
        totalMoves: g.totalMoves
      }))
    };
  }
}
