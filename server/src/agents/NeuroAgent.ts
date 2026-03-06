// Simplified NeuroAgent - LLM Chess Decision Making

import { Chess } from 'chess.js';
import axios from 'axios';

interface NeuroDecision {
  move: string;
  llmConfidence: number;
  finalConfidence: number;
  latencyMs: number;
  reasoning: string;
}

export class NeuroAgent {
  private modelName: string;
  private apiModel: string;
  private endpointUrl: string;
  private apiKey: string;
  private gameHistory: Array<{ move: string; confidence: number }> = [];

  constructor(modelName: string, apiModel: string, endpointUrl: string, apiKey: string) {
    this.modelName = modelName;
    this.apiModel = apiModel;
    this.endpointUrl = endpointUrl;
    this.apiKey = apiKey;
    
    console.log(`🤖 [NeuroAgent] Created: ${modelName} (API: ${apiModel})`);
  }

  /**
   * Make a decision by calling LLM API
   */
  async decideMove(
    fen: string,
    legalMoves: string[],
    _llmReasoning: string
  ): Promise<NeuroDecision> {
    const startTime = performance.now();
    
    if (!legalMoves || legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    try {
      const llmResponse = await this.callLLMApi(fen, legalMoves);
      const latencyMs = performance.now() - startTime;
      const finalConfidence = llmResponse.confidence;
      
      this.gameHistory.push({
        move: llmResponse.move,
        confidence: finalConfidence
      });
      
      return {
        move: llmResponse.move,
        llmConfidence: llmResponse.confidence,
        finalConfidence,
        latencyMs,
        reasoning: llmResponse.reasoning,
      };
    } catch (error: any) {
      console.error(`❌ [NeuroAgent] LLM API call failed for ${this.modelName}:`, error.message);
      return this.fallbackHeuristicMove(fen, legalMoves, startTime);
    }
  }

  /**
   * Call the actual LLM API endpoint with retry logic
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

    console.log(`📡 [NeuroAgent] Calling ${this.modelName} (${this.apiModel})`);
    
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Build headers - only include Authorization if not Ollama
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Ollama doesn't use auth - skip Authorization header for local Ollama
        if (this.apiKey && !this.apiKey.includes('ollama') && !this.apiKey.includes('no-auth')) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        
        const response = await axios.post(
          this.endpointUrl,
          {
            model: this.apiModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 200
          },
          {
            headers,
            timeout: 30000
          }
        );
        
        // Parse and return successful response
        const responseText = response.data.choices?.[0]?.message?.content || '';
        let result: { move: string; confidence: number; reasoning: string } | null = null;

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch {
            result = null;
          }
        }

        // Fallback parser for models that don't strictly return JSON.
        if (!result) {
          const tokens = responseText.match(/[a-h][1-8][a-h][1-8][qrbn]?/gi) || [];
          const legalSet = new Set(legalMoves.map((m) => m.toLowerCase()));
          const detectedMove = tokens.map((t) => t.toLowerCase()).find((t) => legalSet.has(t));

          if (detectedMove) {
            result = {
              move: detectedMove,
              confidence: 0.7,
              reasoning: responseText.slice(0, 200) || 'Parsed move from non-JSON response'
            };
          }
        }

        if (!result) {
          throw new Error('Failed to parse LLM response');
        }
        
        if (!legalMoves.includes(result.move)) {
          console.warn(`⚠️ [NeuroAgent] LLM suggested illegal move ${result.move}, picking first legal move`);
          result.move = legalMoves[0];
        }

        if (!result.confidence || Number.isNaN(result.confidence)) {
          result.confidence = 0.7;
        }

        if (!result.reasoning) {
          result.reasoning = 'LLM move selection';
        }

        console.log(`✅ [NeuroAgent] ${this.modelName} chose: ${result.move} (confidence: ${result.confidence})`);
        return result;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        
        // Only retry on rate limit (429) or server errors (5xx)
        if (status === 429 || (status && status >= 500)) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff up to 10s
          console.warn(`⚠️ [NeuroAgent] Got ${status}, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // Don't retry on other errors (401, 404, etc.)
        throw error;
      }
    }
    
    // All retries failed
    throw lastError;
  }

  /**
   * Fallback heuristic if LLM fails
   */
  private fallbackHeuristicMove(
    fen: string,
    legalMoves: string[],
    startTime: number
  ): NeuroDecision {
    console.warn(`⚠️ [NeuroAgent] Using fallback heuristic for ${this.modelName}`);
    
    const chess = new Chess(fen);
    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      const before = chess.fen();
      chess.move(move);
      
      // Simple heuristic: prefer captures and checks
      let score = 0;
      const lastMove = chess.moves({ verbose: true }).pop();
      if (lastMove?.captured) score += 10;
      if (chess.inCheck()) score += 5;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      
      chess.load(before);
    }

    const latencyMs = performance.now() - startTime;
    return {
      move: bestMove,
      llmConfidence: 0.5,
      finalConfidence: 0.5,
      latencyMs,
      reasoning: 'Fallback heuristic - LLM failed'
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No async resources to cleanup
  }

  /**
   * Dispose - cleanup alias
   */
  async dispose(): Promise<void> {
    await this.cleanup();
  }
}
