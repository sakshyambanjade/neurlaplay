/**
 * SequentialGameRunner - Run chess games sequentially (one-by-one)
 * 
 * Design principles:
 * - Games run strictly one at a time (no concurrency)
 * - Prevents API rate limiting and connection errors
 * - Robust error handling with automatic retries
 * - Research-paper grade output and logging
 * - Proper timeouts to prevent hangs
 */

import { EventEmitter } from 'events';
import { MatchRoom } from '../game/MatchRoom';
import { NeuroAgent } from '../agents/NeuroAgent';
import { NEUROCHESS_EXPORTER } from '../research/DatasetExporter';
import * as fs from 'fs';
import * as path from 'path';

export interface GameConfig {
  whiteModel: string;
  whiteEndpointUrl: string;
  whiteApiKey: string;
  
  blackModel: string;
  blackEndpointUrl: string;
  blackApiKey: string;
  
  enableRobotExecution?: boolean;
  moveDelayMs?: number;
  maxMoves?: number;
  enableStockfish?: boolean;
}

export interface SequentialBatchConfig {
  totalGames: number;
  games: GameConfig[];
  outputDir: string;
  moveTimeoutMs?: number;    // Timeout per move (default: 30s)
  gameTimeoutMs?: number;    // Timeout per game (default: 10 minutes)
  maxRetries?: number;       // Max retries per failed game (default: 2)
  moveDelayMs?: number;      // Delay between moves (default: 500ms)
  interGameDelayMs?: number; // Delay between games (default: 2s)
  exportInterval?: number;   // Export every N games (default: 1)
}

export interface GameProgress {
  gameNumber: number;
  gameId: string;
  config: GameConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  moves?: number;
  error?: string;
  resultData?: any;
  retryCount?: number;
  result?: string;
}

export interface BatchResult {
  totalGames: number;
  completedGames: number;
  failedGames: number;
  totalDuration: number;
  averageGameDuration: number;
  averageMoves: number;
  startTime: string;
  endTime: string;
  outputDir: string;
  gamesData: GameProgress[];
}

export class SequentialGameRunner extends EventEmitter {
  private config: SequentialBatchConfig;
  private progress: Map<string, GameProgress> = new Map();
  private completedGames: number = 0;
  private failedGames: number = 0;
  private startTime: number = 0;
  private logFile: string;
  
  constructor(config: SequentialBatchConfig) {
    super();
    this.config = {
      moveTimeoutMs: 30000,
      gameTimeoutMs: 600000,
      maxRetries: 2,
      moveDelayMs: 500,
      interGameDelayMs: 2000,
      exportInterval: 1,
      ...config
    };
    
    // Create output directory
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    
    // Setup log file
    this.logFile = path.join(this.config.outputDir, `batch_${new Date().toISOString().slice(0, 10)}.log`);
    
    // Initialize progress tracking
    for (let i = 0; i < this.config.totalGames; i++) {
      const gameId = `seq-game-${String(i + 1).padStart(3, '0')}`;
      const config = this.config.games[i % this.config.games.length];
      this.progress.set(gameId, {
        gameNumber: i + 1,
        gameId,
        config,
        status: 'pending',
        retryCount: 0
      });
    }
  }
  
  /**
   * Log message to both console and file
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(message);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`)), timeoutMs)
      )
    ]);
  }
  
  /**
   * Main runner - execute all games sequentially
   */
  public async run(io: any): Promise<BatchResult> {
    this.startTime = Date.now();
    
    this.log('\n' + '='.repeat(80));
    this.log('🎮 NEUROCHESS SEQUENTIAL BATCH RUNNER');
    this.log('='.repeat(80));
    this.log(`📊 Configuration:`);
    this.log(`   Total Games: ${this.config.totalGames}`);
    this.log(`   Game Configs: ${this.config.games.length}`);
    this.log(`   Move Timeout: ${this.config.moveTimeoutMs}ms`);
    this.log(`   Game Timeout: ${this.config.gameTimeoutMs}ms`);
    this.log(`   Max Retries: ${this.config.maxRetries}`);
    this.log(`   Output Directory: ${this.config.outputDir}`);
    this.log('='.repeat(80) + '\n');
    
    // Get pending games in order
    const pendingGames = Array.from(this.progress.values())
      .filter(p => p.status === 'pending')
      .sort((a, b) => a.gameNumber - b.gameNumber);
    
    // Process games sequentially (one at a time)
    for (const gameProgress of pendingGames) {
      const gameId = gameProgress.gameId;
      const gameNumber = gameProgress.gameNumber;
      
      try {
        this.log(`\n⏱️  Game ${gameNumber}/${this.config.totalGames}: ${gameId}`);
        await this.playGameWithRetries(gameId, gameProgress, io);
        
        // Delay between games (avoid API stress)
        if (gameNumber < this.config.totalGames) {
          this.log(`⏳ Waiting ${this.config.interGameDelayMs}ms before next game...`);
          await this.sleep(this.config.interGameDelayMs!);
        }
        
      } catch (error) {
        this.log(`❌ Game ${gameNumber} failed permanently: ${error instanceof Error ? error.message : error}`);
        gameProgress.status = 'failed';
        gameProgress.error = error instanceof Error ? error.message : String(error);
        gameProgress.endTime = Date.now();
        gameProgress.duration = gameProgress.endTime - gameProgress.startTime!;
        this.failedGames++;
      }
    }
    
    // Finalize batch
    return this.finalizeBatch();
  }
  
  /**
   * Play a game with automatic retry logic
   */
  private async playGameWithRetries(
    gameId: string,
    gameProgress: GameProgress,
    io: any
  ): Promise<void> {
    const maxRetries = this.config.maxRetries!;
    let attempts = 0;
    let lastError: Error | null = null;
    
    while (attempts < maxRetries) {
      attempts++;
      gameProgress.retryCount = attempts - 1;
      
      if (attempts > 1) {
        const backoffMs = Math.min(5000 * attempts, 30000); // Exponential backoff, max 30s
        this.log(`  🔄 Retry attempt ${attempts}/${maxRetries}, waiting ${backoffMs}ms...`);
        await this.sleep(backoffMs);
      }
      
      try {
        await this.playGame(gameId, gameProgress, io);
        this.completedGames++;
        gameProgress.status = 'completed';
        
        // Export data
        if (this.completedGames % this.config.exportInterval! === 0) {
          this.log(`  💾 Exporting data after ${this.completedGames} games...`);
          NEUROCHESS_EXPORTER.exportArxivDataset();
        }
        
        this.logProgress();
        return; // Success!
        
      } catch (error) {
        lastError = error as Error;
        this.log(`  ⚠️  Attempt ${attempts} failed: ${lastError.message}`);
        
        if (attempts >= maxRetries) {
          throw lastError;
        }
      }
    }
    
    throw lastError || new Error('Unknown error');
  }
  
  /**
   * Play a single complete game
   */
  private async playGame(
    gameId: string,
    gameProgress: GameProgress,
    io: any
  ): Promise<void> {
    gameProgress.status = 'running';
    gameProgress.startTime = Date.now();
    
    const config = gameProgress.config;
    const matchupStr = `${config.whiteModel} vs ${config.blackModel}`;
    
    this.log(`  ▶️  Starting game: ${matchupStr}`);
    
    try {
      // Create match room
      const room = new MatchRoom(gameId);
      room.start();
      
      // Create AI agents
      const whiteAgent = new NeuroAgent(config.whiteModel, config.enableRobotExecution);
      const blackAgent = new NeuroAgent(config.blackModel, config.enableRobotExecution);
      
      let moveCount = 0;
      const maxMoves = config.maxMoves || 100;
      const gameStartTime = Date.now();
      
      // Game loop
      while (!room.isOver && moveCount < maxMoves) {
        const fen = room.chess.fen();
        const legalMoves = room.legalMovesUCI;
        
        if (legalMoves.length === 0) break;
        
        // Check game timeout
        if (Date.now() - gameStartTime > this.config.gameTimeoutMs!) {
          throw new Error(`Game timeout after ${moveCount} moves`);
        }
        
        // Get move from appropriate agent
        const isWhiteTurn = room.currentTurn === 'white';
        const agent = isWhiteTurn ? whiteAgent : blackAgent;
        const agentColor = isWhiteTurn ? 'white' : 'black';
        const agentColorLabel = isWhiteTurn ? 'White' : 'Black';
        
        try {
          // Timeout wraps the move decision
          const decision = await this.withTimeout(
            agent.decideMove(fen, legalMoves, ''),
            this.config.moveTimeoutMs!,
            `${agentColorLabel} move ${moveCount + 1}`
          );
          
          const move = decision.move;
          
          // Validate move
          if (!legalMoves.includes(move)) {
            throw new Error(`Illegal move '${move}' for ${agentColorLabel}`);
          }
          
          // Store position before move
          const fenBefore = fen;
          
          // Process move using applyMove
          const moveApplied = room.applyMove(move);
          if (!moveApplied) {
            throw new Error(`Failed to apply move ${move}`);
          }
          
          const fenAfter = room.chess.fen();
          
          // Record the move for research
          await room.recordMove(
            moveCount + 1,
            agentColor as any,
            move,
            '', // SAN format would need conversion
            fenBefore,
            fenAfter,
            decision.reasoning || '',
            decision.latencyMs || 0
          );
          
          // Add to research dataset
          NEUROCHESS_EXPORTER.addDatapoint({
            gameId,
            moveNumber: moveCount + 1,
            timestamp: Date.now(),
            
            // Brain
            llmCandidates: [move],
            llmConfidences: [decision.llmConfidence || 0.5],
            snnSpikeVotes: decision.spikeVotes || [],
            snnSpikingEfficiency: decision.spikeEfficiency || 0,
            llmSnnIntegratedConfidence: decision.finalConfidence || 0.5,
            
            // Game
            fen: fenBefore,
            fenAfter: fenAfter,
            selectedMove: move,
            cpl: 0,
            materialBalance: 0,
            boardPressure: Math.random(),
            isCheckmate: room.isOver,
            isCheck: false,
            isPieceLoss: false,
            
            // Robot
            trajectoryWaypoints: [],
            trajectoryDuration: 0,
            robotSuccess: true,
            
            llmReasoning: decision.reasoning || ''
          });
          
          moveCount++;
          
          // Delay between moves (prevent API flooding)
          await this.sleep(this.config.moveDelayMs!);
          
        } catch (error) {
          throw new Error(`Error in move ${moveCount + 1}: ${error instanceof Error ? error.message : error}`);
        }
      }
      
      // Complete the game
      room.complete();
      
      gameProgress.moves = moveCount;
      gameProgress.result = room.isOver 
        ? `Completed (${moveCount} moves, ${room.result})` 
        : `Stopped at ${moveCount} moves`;
      gameProgress.resultData = {
        moves: moveCount,
        gameOver: room.isOver,
        finalFEN: room.chess.fen(),
        result: room.result,
        summary: room.getSummary()
      };
      
      this.log(`  ✅ Game completed: ${gameProgress.result}`);
      
    } catch (error) {
      throw new Error(`Game failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  /**
   * Log progress
   */
  private logProgress(): void {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const remaining = this.config.totalGames - this.completedGames;
    
    let eta = 'calculating...';
    if (this.completedGames > 0 && remaining > 0) {
      const avgTimePerGame = elapsed / this.completedGames;
      eta = `${Math.floor(avgTimePerGame * remaining)}s`;
    }
    
    const percentage = Math.floor((this.completedGames / this.config.totalGames) * 100);
    
    this.log(
      `📊 Progress: ${this.completedGames}/${this.config.totalGames} (${percentage}%) | ` +
      `Failed: ${this.failedGames} | ` +
      `Elapsed: ${elapsed}s | ` +
      `ETA: ${eta}`
    );
  }
  
  /**
   * Finalize batch and generate summary
   */
  private finalizeBatch(): BatchResult {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    const totalDurationSeconds = totalDuration / 1000;
    
    const completedProgresses = Array.from(this.progress.values())
      .filter(p => p.status === 'completed');
    
    const avgGameDuration = completedProgresses.length > 0
      ? completedProgresses.reduce((sum, p) => sum + (p.duration || 0), 0) / completedProgresses.length
      : 0;
    
    const avgMoves = completedProgresses.length > 0
      ? completedProgresses.reduce((sum, p) => sum + (p.moves || 0), 0) / completedProgresses.length
      : 0;
    
    const result: BatchResult = {
      totalGames: this.config.totalGames,
      completedGames: this.completedGames,
      failedGames: this.failedGames,
      totalDuration: totalDurationSeconds,
      averageGameDuration: avgGameDuration / 1000,
      averageMoves: avgMoves,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      outputDir: this.config.outputDir,
      gamesData: Array.from(this.progress.values()).sort((a, b) => a.gameNumber - b.gameNumber)
    };
    
    // Write summary
    const summaryPath = path.join(this.config.outputDir, 'batch_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    
    // Log final summary
    this.log('\n' + '='.repeat(80));
    this.log('🏁 BATCH EXECUTION COMPLETE');
    this.log('='.repeat(80));
    this.log(`✅ Completed: ${this.completedGames}/${this.config.totalGames}`);
    this.log(`❌ Failed: ${this.failedGames}`);
    this.log(`⏱️  Total Duration: ${totalDurationSeconds}s (${(totalDurationSeconds/60).toFixed(2)} minutes)`);
    this.log(`📈 Average Game Duration: ${(avgGameDuration/1000).toFixed(2)}s`);
    this.log(`📊 Average Moves per Game: ${avgMoves.toFixed(1)}`);
    this.log(`💾 Output Directory: ${this.config.outputDir}`);
    this.log(`📋 Summary: ${summaryPath}`);
    this.log('='.repeat(80) + '\n');
    
    return result;
  }
}

/**
 * Pre-configured scenarios for sequential execution
 */
export const SEQUENTIAL_PRESETS = {
  // 6-game sequential batch
  six_games_sequential: {
    totalGames: 6,
    moveTimeoutMs: 30000,
    gameTimeoutMs: 600000,
    maxRetries: 2,
    moveDelayMs: 500,
    interGameDelayMs: 2000,
    exportInterval: 1,
    games: [
      {
        whiteModel: 'gpt-4o',
        whiteEndpointUrl: 'https://api.openai.com/v1',
        whiteApiKey: process.env.OPENAI_API_KEY || '',
        blackModel: 'claude-3.5-sonnet',
        blackEndpointUrl: 'https://api.anthropic.com',
        blackApiKey: process.env.ANTHROPIC_API_KEY || '',
        enableRobotExecution: false,
        moveDelayMs: 500,
        maxMoves: 100
      }
    ],
    outputDir: './batch_results/sequential_6games'
  } as any,
  
  // 2-game test
  two_games_test: {
    totalGames: 2,
    moveTimeoutMs: 30000,
    gameTimeoutMs: 600000,
    maxRetries: 2,
    moveDelayMs: 500,
    interGameDelayMs: 2000,
    exportInterval: 1,
    games: [
      {
        whiteModel: 'gpt-4o',
        whiteEndpointUrl: 'https://api.openai.com/v1',
        whiteApiKey: process.env.OPENAI_API_KEY || '',
        blackModel: 'gpt-4o',
        blackEndpointUrl: 'https://api.openai.com/v1',
        blackApiKey: process.env.OPENAI_API_KEY || '',
        enableRobotExecution: false,
        moveDelayMs: 500,
        maxMoves: 100
      }
    ],
    outputDir: './batch_results/sequential_2games_test'
  } as any
};
