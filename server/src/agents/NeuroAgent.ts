import * as tf from '@tensorflow/tfjs-node';
import { Chess } from 'chess.js';
import { ChessArmMapper, RobotTrajectory } from '../robotics/ChessArmMapper';
import { ROS2ArmController, RobotExecutionResult, RobotPresets } from '../robotics/ROS2ArmController';

/**
 * Spike pattern recording for research metrics
 */
interface SpikePattern {
  neuronId: number;
  firingRate: number;
  moveIndex: number;
  timestamp: number;
}

/**
 * Move decision with neuro-symbolic confidence and robot execution
 */
interface NeuroDecision {
  move: string;
  llmConfidence: number;
  spikeVotes: number[];
  finalConfidence: number;
  spikeEfficiency: number;
  latencyMs: number;
  reasoning: string;
  trajectory?: RobotTrajectory;  // Robot arm path for physical execution
  robotExecution?: RobotExecutionResult;  // Physical arm execution result
}

/**
 * NeuroAgent - Hybrid LLM + SNN decision-making
 * 
 * Architecture:
 * 1. LLM Decision (prefrontal cortex) → Top 3 moves with confidence scores
 * 2. SNN Filtering (motor cortex) → Leaky integrate-and-fire neurons vote
 * 3. Population Coding (basal ganglia) → Final move selected by neuron consensus
 * 
 * Research metric: Spike efficiency = useful spikes / total spikes
 */
export class NeuroAgent {
  private modelName: string;
  private snnModel: tf.LayersModel | null = null;
  private modelCache: Map<string, tf.LayersModel> = new Map();
  private spikeHistory: SpikePattern[] = [];
  private totalDecisions: number = 0;
  private averageLatency: number = 0;
  private armMapper: ChessArmMapper;  // Chess-to-robot trajectory mapper
  private robotController: ROS2ArmController | null = null;  // Physical arm executor
  private enablePhysicalExecution: boolean = false;

  constructor(modelName: string = 'gpt-4o', enablePhysicalExecution: boolean = false) {
    this.modelName = modelName;
    this.armMapper = new ChessArmMapper();
    this.enablePhysicalExecution = enablePhysicalExecution;
    
    // Initialize robot controller if physical execution enabled
    if (enablePhysicalExecution) {
      this.robotController = new ROS2ArmController(RobotPresets.simulation);
    }
    
    this.initSNN();
  }

  /**
   * Initialize SNN model (leaky integrate-and-fire approximation)
   * Input: 3 LLM confidence scores
   * Output: Spike probability for each move (0-1)
   */
  private initSNN(): void {
    try {
      const cacheKey = `snn-${this.modelName}`;
      if (this.modelCache.has(cacheKey)) {
        this.snnModel = this.modelCache.get(cacheKey)!;
        return;
      }

      // Simplified SNN using dense layers with leaky ReLU
      // This approximates leaky integrate-and-fire neurons
      this.snnModel = tf.sequential({
        layers: [
          // First layer: 3 inputs (3 candidate moves) → 64 neurons (motor cortex)
          tf.layers.dense({
            units: 64,
            activation: 'leakyRelu',
            inputShape: [3],
            kernelInitializer: 'heNormal',
            name: 'motor_cortex'
          }),
          
          // Temporal integration layer
          tf.layers.dense({
            units: 32,
            activation: 'leakyRelu',
            name: 'integration'
          }),
          
          // Output layer: Spike probability for each move
          tf.layers.dense({
            units: 3,
            activation: 'sigmoid',
            name: 'spike_output'
          })
        ]
      });

      // Use Adam optimizer for online learning
      this.snnModel.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      this.modelCache.set(cacheKey, this.snnModel);
      console.log(`[NeuroAgent] SNN model initialized for ${this.modelName}`);
    } catch (error) {
      console.error('[NeuroAgent] SNN initialization failed:', error);
      this.snnModel = null;
    }
  }

  /**
   * Main decision function: LLM + SNN hybrid
   */
  async decideMove(
    fen: string,
    legalMoves: string[],
    llmReasoning: string
  ): Promise<NeuroDecision> {
    const startTime = Date.now();

    try {
      // Step 1: LLM generates top 3 moves with confidence
      const topMoves = await this.generateTopMoves(fen, legalMoves, llmReasoning);

      // Step 2: SNN motor cortex processes confidence scores
      const spikeVotes = await this.snnMotorSelect(topMoves.map(m => m.confidence));

      // Step 3: Population coding - neuron ensemble votes
      const selectedIndex = this.getMaxIndex(spikeVotes);
      const selectedMove = topMoves[selectedIndex];

      // Calculate final confidence (LLM * SNN ensemble)
      const spikeEfficiency = this.calculateSpikeEfficiency(spikeVotes);
      const finalConfidence = selectedMove.confidence * spikeEfficiency;

      const decision: NeuroDecision = {
        move: selectedMove.uci,
        llmConfidence: selectedMove.confidence,
        spikeVotes: Array.from(spikeVotes),
        finalConfidence: Math.round(finalConfidence * 10000) / 10000,
        spikeEfficiency: Math.round(spikeEfficiency * 10000) / 10000,
        latencyMs: Date.now() - startTime,
        reasoning: `LLM: ${selectedMove.san} (${selectedMove.confidence.toFixed(2)}) → SNN spike consensus (${spikeEfficiency.toFixed(2)})`
      };

      // Update research metrics
      this.recordDecision(decision);

      // Generate robot trajectory (brain→game→robot pipeline)
      try {
        const robotTraj = this.armMapper.mapChessMove(
          selectedMove.uci,
          finalConfidence,
          this.inferPieceType(selectedMove.uci)
        );
        decision.trajectory = robotTraj;

        console.log(
          `[NeuroAgent] ${this.modelName} | Move: ${selectedMove.san} | ` +
          `LLM: ${selectedMove.confidence.toFixed(2)} | ` +
          `Spikes: [${spikeVotes.map(v => v.toFixed(2)).join(', ')}] | ` +
          `Efficiency: ${spikeEfficiency.toFixed(2)} | ` +
          `${decision.latencyMs}ms`
        );

        // Log robot trajectory (🧠♟️🤖 = brain→game→robot)
        console.log(
          `🧠♟️🤖 ${selectedMove.san} → ${robotTraj.waypoints.length} waypoints (conf: ${finalConfidence.toFixed(2)})`
        );
      } catch (trajError) {
        console.warn('[NeuroAgent] Trajectory generation failed:', trajError);
      }

      return decision;
    } catch (error) {
      console.error('[NeuroAgent] Decision failed:', error);
      
      // Fallback: return first legal move
      return {
        move: legalMoves[0],
        llmConfidence: 0.5,
        spikeVotes: [1, 0, 0],
        finalConfidence: 0.5,
        spikeEfficiency: 0.5,
        latencyMs: Date.now() - startTime,
        reasoning: 'Fallback (error occurred)'
      };
    }
  }

  /**
   * Generate top 3 candidate moves (mock - replace with actual LLM call)
   */
  private async generateTopMoves(
    fen: string,
    legalMoves: string[],
    _llmReasoning: string
  ): Promise<Array<{ uci: string; san: string; confidence: number }>> {
    try {
      // For now: return first 3 legal moves with boosts
      const chess = new Chess(fen);
      const availableMoves = chess
        .moves({ verbose: true })
        .slice(0, 3);

      return availableMoves.map((move, index) => ({
        uci: move.from + move.to + (move.promotion || ''),
        san: move.san,
        // Confidence degrades: first move 0.92, second 0.78, third 0.65
        confidence: Math.max(0.5, 1.0 - index * 0.15 + Math.random() * 0.05)
      }));
    } catch (error) {
      console.error('[NeuroAgent] Move generation failed:', error);
      return legalMoves.slice(0, 3).map((move, i) => ({
        uci: move,
        san: move,
        confidence: 0.8 - i * 0.1
      }));
    }
  }

  /**
   * SNN Motor Cortex: Leaky integrate-and-fire neurons
   * Simulates 25 time steps of neural firing with Poisson noise
   */
  private async snnMotorSelect(confidences: number[]): Promise<number[]> {
    try {
      if (!this.snnModel) {
        // Fallback if SNN initialization failed
        return confidences;
      }

      return tf.tidy(() => {
        // Input: confidence scores for 3 candidate moves
        const input = tf.tensor2d([confidences]);

        // Forward pass through SNN (motor cortex activation)
        const motorOutput = this.snnModel!.predict(input) as tf.Tensor;

        // Temporal integration: 25 time steps of spiking
        let spikeAccumulator = tf.zeros([1, 3]);

        for (let t = 0; t < 25; t++) {
          // Leaky integrate-and-fire dynamics
          // Membrane potential decays by 10% per step
          const leakFactor = Math.exp(-0.1);
          spikeAccumulator = spikeAccumulator.mul(tf.scalar(leakFactor));

          // Input current (with Poisson noise)
          const poissonNoise = tf.randomUniform([1, 3], 0.85, 1.15);
          const inputCurrent = motorOutput.mul(poissonNoise);

          // Accumulate spikes
          spikeAccumulator = spikeAccumulator.add(inputCurrent.mul(tf.scalar(0.04)));

          // Spike threshold: if > 1.0, fire and reset
          const fired = spikeAccumulator.greater(tf.scalar(1.0));
          const spikesThisStep = tf.cast(fired, 'float32');
          
          // Reset fired neurons
          spikeAccumulator = tf.where(
            fired,
            tf.zeros([1, 3]),
            spikeAccumulator
          );

          // Store spike patterns for research
          this.recordSpikePattern(spikesThisStep, t);
        }

        // Return normalized spike counts (0-1)
        const maxSpikes = spikeAccumulator.max();
        const normalizedSpikes = spikeAccumulator.div(
          maxSpikes.add(tf.scalar(0.001)) // Prevent division by zero
        );

        return Array.from(normalizedSpikes.dataSync());
      });
    } catch (error) {
      console.error('[NeuroAgent] SNN selection failed:', error);
      return confidences; // Fallback to original confidences
    }
  }

  /**
   * Get index of maximum value
   */
  private getMaxIndex(values: number[]): number {
    let maxIndex = 0;
    let maxValue = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxValue) {
        maxValue = values[i];
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  /**
   * Calculate spike efficiency: useful spikes / total spike activity
   * Metric: how well the SNN distinguishes between candidates
   */
  private calculateSpikeEfficiency(spikeVotes: number[]): number {
    const maxVote = Math.max(...spikeVotes);
    const sumVotes = spikeVotes.reduce((a, b) => a + b, 0);

    if (sumVotes === 0) return 0.5;

    // Efficiency: concentration of votes (higher = clearer decision)
    return maxVote / sumVotes;
  }

  /**
   * Record spike pattern for research dataset
   */
  private recordSpikePattern(spikes: tf.Tensor, timeStep: number): void {
    try {
      const spikeData = spikes.dataSync();
      for (let i = 0; i < spikeData.length; i++) {
        if (spikeData[i] > 0) {
          this.spikeHistory.push({
            neuronId: i,
            firingRate: spikeData[i],
            moveIndex: i,
            timestamp: timeStep
          });
        }
      }
    } catch (error) {
      // Silently skip if recording fails
    }
  }

  /**
   * Record decision metrics for research
   */
  private recordDecision(decision: NeuroDecision): void {
    this.totalDecisions++;
    
    // Update running average latency
    this.averageLatency = 
      (this.averageLatency * (this.totalDecisions - 1) + decision.latencyMs) / 
      this.totalDecisions;
  }

  /**
   * Get research metrics for paper
   */
  getResearchMetrics() {
    return {
      modelName: this.modelName,
      totalDecisions: this.totalDecisions,
      averageLatency: Math.round(this.averageLatency * 100) / 100,
      spikeHistoryLength: this.spikeHistory.length,
      averageSpikeEfficiency: this.spikeHistory.length > 0 
        ? this.spikeHistory.reduce((sum, s) => sum + s.firingRate, 0) / this.spikeHistory.length
        : 0
    };
  }

  /**
   * Export spike raster plot data for visualization
   */
  exportSpikeRaster() {
    return this.spikeHistory.map(spike => ({
      time: spike.timestamp,
      neuron: spike.neuronId,
      firingRate: Math.round(spike.firingRate * 100) / 100
    }));
  }

  /**
   * Infer piece type from UCI move (for research logging)
   */
  private inferPieceType(uci: string): string {
    // Simple heuristic: doesn't try to be perfect
    const fromSquare = uci.slice(0, 2);
    return 'pawn';  // Default to pawn (most common move)
  }

  /**
   * FULL NEURO-CHESS PIPELINE: Brain→Game→Robot
   * 
   * Complete end-to-end system:
   * 1. LLM generates candidate moves (prefrontal cortex)
   * 2. SNN filters with spike voting (motor cortex)
   * 3. Move is validated and logged (game rules)
   * 4. Trajectory is generated (motor planning)
   * 5. Physical robot executes the move (embodied action)
   * 
   * Research data includes all stages for publication
   */
  async fullNeuroChessPipeline(
    fen: string,
    legalMoves: string[],
    llmReasoning: string
  ): Promise<NeuroDecision> {
    const pipelineStartTime = Date.now();

    try {
      // Step 1: Brain planning (LLM + SNN decision)
      const decision = await this.decideMove(fen, legalMoves, llmReasoning);

      // Step 2: Log research data
      console.log(`[NeuroChess] 🧠 Brain decision: ${decision.move} (confidence: ${decision.finalConfidence.toFixed(2)})`);

      // Step 3: Physical robot execution (if enabled)
      if (this.enablePhysicalExecution && this.robotController) {
        try {
          const robotResult = await this.robotController.executeChessTrajectory(
            decision.move,
            decision.finalConfidence,
            this.inferPieceType(decision.move)
          );

          decision.robotExecution = robotResult;

          // Log robot execution
          if (robotResult.success) {
            console.log(
              `[NeuroChess] 🤖 Robot EXECUTED: ${decision.move} ` +
              `(${robotResult.trajectory?.waypoints} waypoints, ${robotResult.executionTime.toFixed(0)}ms)`
            );
          } else {
            console.warn(
              `[NeuroChess] 🤖 Robot FAILED: ${decision.move} ` +
              `(${robotResult.error})`
            );
          }
        } catch (robotError) {
          console.error('[NeuroChess] Robot execution error:', robotError);
          decision.robotExecution = {
            success: false,
            executionTime: Date.now() - pipelineStartTime,
            error: robotError instanceof Error ? robotError.message : String(robotError)
          };
        }
      }

      // Step 4: Complete pipeline logging
      const totalPipelineTime = Date.now() - pipelineStartTime;
      console.log(
        `[NeuroChess] 🧠♟️🤖 Full pipeline: ${decision.move} completed in ${totalPipelineTime}ms ` +
        `(brain: ${decision.latencyMs}ms, robot: ${decision.robotExecution?.executionTime || 0}ms)`
      );

      return decision;
    } catch (error) {
      console.error('[NeuroChess] Pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Set custom robot controller for physical execution
   */
  setRobotController(controller: ROS2ArmController): void {
    this.robotController = controller;
    this.enablePhysicalExecution = true;
    console.log('[NeuroAgent] Robot controller set for physical execution');
  }

  /**
   * Connect to physical robot (establish ROS2 connection)
   */
  async connectToPhysicalRobot(): Promise<boolean> {
    if (!this.robotController) {
      console.warn('[NeuroAgent] No robot controller configured');
      return false;
    }

    try {
      const connected = await this.robotController.connect();
      this.enablePhysicalExecution = connected;
      return connected;
    } catch (error) {
      console.error('[NeuroAgent] Failed to connect to physical robot:', error);
      return false;
    }
  }

  /**
   * Get robot execution metrics for research paper
   */
  getRobotMetrics() {
    if (!this.robotController) {
      return { available: false };
    }

    return {
      available: true,
      metrics: this.robotController.getResearchMetrics()
    };
  }

  /**
   * Cleanup (dispose TensorFlow tensors and robot connection)
   */
  dispose(): void {
    if (this.snnModel) {
      this.snnModel.dispose();
      this.snnModel = null;
    }
    if (this.robotController) {
      this.robotController.dispose();
    }
    this.spikeHistory = [];
  }
}
