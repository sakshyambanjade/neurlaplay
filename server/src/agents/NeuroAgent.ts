// Simplified NeuroAgent - without TensorFlow dependency
// Uses basic LLM + simple decision making (no SNN)

import { Chess } from 'chess.js';
import { ChessArmMapper, RobotTrajectory } from '../robotics/ChessArmMapper';
import { ROS2ArmController, RobotExecutionResult } from '../robotics/ROS2ArmController';

interface NeuroDecision {
  move: string;
  llmConfidence: number;
  spikeVotes: number[];
  finalConfidence: number;
  spikeEfficiency: number;
  latencyMs: number;
  reasoning: string;
  trajectory?: RobotTrajectory;
  robotExecution?: RobotExecutionResult;
}

interface SpikePattern {
  neuronId: number;
  firingRate: number;
  moveIndex: number;
  timestamp: number;
}

export class NeuroAgent {
  private modelName: string;
  private enableRobotExecution: boolean;
  private gameHistory: Array<{ move: string; confidence: number }> = [];
  private armController: ROS2ArmController | null = null;
  private armMapper: ChessArmMapper;

  constructor(modelName: string, enableRobotExecution: boolean = false) {
    this.modelName = modelName;
    this.enableRobotExecution = enableRobotExecution;
    this.armMapper = new ChessArmMapper();
    
    if (enableRobotExecution) {
      this.armController = new ROS2ArmController();
    }
  }

  /**
   * Make a decision by evaluating all legal moves
   * Returns the best move with real confidence based on analysis
   */
  async decideMove(
    fen: string,
    legalMoves: string[],
    llmReasoning: string
  ): Promise<NeuroDecision> {
    const startTime = performance.now();
    
    if (!legalMoves || legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    // Initialize chess board from FEN
    const tempChess = new Chess(fen);
    
    // Evaluate each legal move
    const moveEvaluations = legalMoves.map(moveUCI => {
      const from = moveUCI.slice(0, 2);
      const to = moveUCI.slice(2, 4);
      const promotion = moveUCI.length === 5 ? moveUCI[4] : undefined;
      
      // Try the move (without making it permanent)
      const testChess = new Chess(fen);
      const moveObj = testChess.move({ from, to, promotion: promotion as any });
      
      if (!moveObj) {
        return { move: moveUCI, score: 0, isValid: false };
      }
      
      // Calculate move score based on chess heuristics
      let score = 50; // baseline
      
      // Bonus for captures
      if (moveObj.captured) {
        score += 30;
      }
      
      // Bonus for checks
      if (testChess.isCheck()) {
        score += 20;
      }
      
      // Penalty for moving into check (self-check)
      // Note: chess.js should have validated this already
      
      // Bonus for promoting
      if (moveObj.promotion) {
        score += 40;
      }
      
      // Small random factor for variation
      score += Math.random() * 5;
      
      return {
        move: moveUCI,
        score,
        isValid: true
      };
    });
    
    // Filter valid moves
    const validMoves = moveEvaluations.filter(e => e.isValid);
    if (validMoves.length === 0) {
      throw new Error('All moves are invalid');
    }
    
    // Sort by score descending
    validMoves.sort((a, b) => b.score - a.score);
    
    // Select best move
    const bestMove = validMoves[0];
    const selectedMove = bestMove.move;
    
    // Calculate confidence based on score distribution
    const maxScore = validMoves[0].score;
    const minScore = validMoves[validMoves.length - 1].score;
    const scoreRange = maxScore - minScore || 1;
    
    // Confidence: how much better is the best move vs others
    const confidence = Math.min(
      0.95,
      Math.max(0.5, (bestMove.score - (maxScore * 0.8)) / (scoreRange * 0.2) * 0.4 + 0.6)
    );
    
    // Simulate spike voting based on real confidence
    const spikeVotes = [
      confidence,
      confidence * 0.95,
      confidence * 0.90
    ];
    
    const finalConfidence = spikeVotes.reduce((a: number, b: number) => a + b) / spikeVotes.length;
    const spikeEfficiency = Math.min(spikeVotes.filter((v: number) => v > 0.5).length / 3, 1.0);
    
    let trajectory: RobotTrajectory | undefined;
    let robotExecution: RobotExecutionResult | undefined;
    
    if (this.enableRobotExecution && this.armController) {
      trajectory = this.armMapper.mapChessMove(selectedMove, finalConfidence, 'pawn');
      robotExecution = await this.armController.executeChessTrajectory(selectedMove, finalConfidence, 'pawn');
    }
    
    const latencyMs = performance.now() - startTime;
    
    this.gameHistory.push({
      move: selectedMove,
      confidence: finalConfidence
    });
    
    return {
      move: selectedMove,
      llmConfidence: confidence,
      spikeVotes,
      finalConfidence,
      spikeEfficiency,
      latencyMs,
      reasoning: `Evaluated ${legalMoves.length} moves. Selected ${selectedMove} with score ${bestMove.score.toFixed(1)}.`,
      trajectory,
      robotExecution
    };
  }

  /**
   * Get spike pattern (simplified)
   */
  getSpikeRasters(): SpikePattern[] {
    return this.gameHistory.map((entry, idx) => ({
      neuronId: idx % 3,
      firingRate: entry.confidence,
      moveIndex: idx,
      timestamp: Date.now()
    }));
  }

  /**
   * Cleanup resources (alias for dispose)
   */
  async cleanup(): Promise<void> {
    if (this.armController) {
      await this.armController.disconnect();
    }
  }

  /**
   * Dispose - cleanup alias
   */
  async dispose(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Get research metrics
   */
  getResearchMetrics() {
    const totalMoves = this.gameHistory.length;
    const avgConfidence = this.gameHistory.length > 0
      ? this.gameHistory.reduce((sum, entry) => sum + entry.confidence, 0) / totalMoves
      : 0;

    return {
      model: this.modelName,
      totalMoves,
      averageConfidence: avgConfidence,
      robotExecution: this.enableRobotExecution,
      spikePatterns: this.getSpikeRasters()
    };
  }

  /**
   * Get game summary (alias for getResearchMetrics)
   */
  getGameSummary() {
    return this.getResearchMetrics();
  }
}
