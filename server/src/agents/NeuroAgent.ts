// Simplified NeuroAgent - without TensorFlow dependency
// Uses basic LLM + simple decision making (no SNN)

import { Chess } from 'chess.js';
import { ChessArmMapper, RobotTrajectory } from '../robotics/ChessArmMapper';
import { ROS2ArmController, RobotExecutionResult } from '../robotics/ROS2ArmController';
import axios from 'axios';

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
  private endpointUrl: string;
  private apiKey: string;
  private enableRobotExecution: boolean;
  private gameHistory: Array<{ move: string; confidence: number }> = [];
  private armController: ROS2ArmController | null = null;
  private armMapper: ChessArmMapper;

  constructor(modelName: string, endpointUrl: string, apiKey: string, enableRobotExecution: boolean = false) {
    this.modelName = modelName;
    this.endpointUrl = endpointUrl;
    this.apiKey = apiKey;
    this.enableRobotExecution = enableRobotExecution;
    this.armMapper = new ChessArmMapper();
    
    console.log(`🤖 [NeuroAgent] Created: ${modelName} → ${endpointUrl}`);
    
    if (enableRobotExecution) {
      this.armController = new ROS2ArmController();
    }
  }

  /**
   * Make a decision by evaluating all legal moves using LLM API
   * Returns the best move with real confidence based on LLM analysis
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

    // Call the actual LLM API
    try {
      const llmResponse = await this.callLLMApi(fen, legalMoves);
      const latencyMs = performance.now() - startTime;
      
      const spikeVotes = [llmResponse.confidence, llmResponse.confidence * 0.95, llmResponse.confidence * 0.9];
      const finalConfidence = spikeVotes.reduce((a, b) => a + b) / spikeVotes.length;
      
      this.gameHistory.push({
        move: llmResponse.move,
        confidence: finalConfidence
      });
      
      return {
        move: llmResponse.move,
        llmConfidence: llmResponse.confidence,
        spikeVotes,
        finalConfidence,
        spikeEfficiency: 1.0,
        latencyMs,
        reasoning: llmResponse.reasoning,
      };
    } catch (error: any) {
      console.error(`❌ [NeuroAgent] LLM API call failed for ${this.modelName}:`, error.message);
      // Fallback to heuristic if API fails
      return this.fallbackHeuristicMove(fen, legalMoves, startTime);
    }
  }

  /**
   * Call the actual LLM API endpoint
   */
  private async callLLMApi(fen: string, legalMoves: string[]): Promise<{ move: string; confidence: number; reasoning: string }> {
    const prompt = `You are a chess grandmaster. Analyze this position and choose the best move.

Current position (FEN): ${fen}

Legal moves (UCI format): ${legalMoves.join(', ')}

Respond with ONLY a JSON object in this exact format:
{
  "move": "<your chosen move in UCI format>",
  "reasoning": "<brief explanation>",
  "confidence": <number between 0.5 and 0.95>
}

Your move MUST be one from the legal moves list above.`;

    console.log(`📡 [NeuroAgent] Calling ${this.modelName} at ${this.endpointUrl.split('//')[1]?.split('/')[0]}`);
    
    const response = await axios.post(
      this.endpointUrl,
      {
        model: this.modelName,
        messages: [
          { role: 'system', content: 'You are a chess grandmaster. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content.trim();
    
    // Parse JSON response
    let result;
    try {
      // Try to extract JSON if wrapped in markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      result = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Failed to parse LLM response: ${content}`);
    }

    // Validate move is legal
    if (!legalMoves.includes(result.move)) {
      console.warn(`⚠️ [NeuroAgent] LLM suggested illegal move ${result.move}, picking first legal move`);
      result.move = legalMoves[0];
      result.confidence = 0.6;
    }

    console.log(`✅ [NeuroAgent] ${this.modelName} chose: ${result.move} (confidence: ${result.confidence})`);
    
    return {
      move: result.move,
      confidence: result.confidence || 0.75,
      reasoning: result.reasoning || 'No reasoning provided'
    };
  }

  /**
   * Fallback heuristic move selection if LLM API fails
   */
  private async fallbackHeuristicMove(fen: string, legalMoves: string[], startTime: number): Promise<NeuroDecision> {
    console.warn(`⚠️ [NeuroAgent] Using fallback heuristic for ${this.modelName}`);
    
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
