/**
 * MultiProviderLLM - Unified interface for 6 free LLM providers
 * 
 * Supported providers:
 * - Groq (llama3.1-405B) → ~1850 Elo
 * - OpenRouter (deepseek-r1:free) → ~1750 Elo
 * - Google AI Studio (gemini-2.0-flash) → ~1650 Elo
 * - Mistral (codestral:free) → ~1600 Elo
 * - HuggingFace (qwen2.5-coder) → ~1550 Elo
 * - Together AI (llama3.2-3B) → ~1500 Elo
 * 
 * Rate limits: Safe with 30s between concurrent games
 */

import axios from 'axios';

export interface LLMProvider {
  name: string;
  model: string;
  endpoint: string;
  apiKey: string;
  estimatedElo: number;
}

export interface LLMResponse {
  move: string;
  reasoning: string;
  latencyMs: number;
}

const PROVIDER_CONFIGS = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    estimatedElo: 1850,
    rateLimit: { tpm: 131000, rpm: 14000 }
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['deepseek/deepseek-r1:free', 'gryphe/mythomist-7b:free'],
    estimatedElo: 1750,
    rateLimit: { rpm: 20 }
  },
  google: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash'],
    estimatedElo: 1650,
    rateLimit: { rpm: 60 }
  },
  mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    models: ['codestral-latest', 'mistral-small-latest'],
    estimatedElo: 1600,
    rateLimit: { tpm: 500000 }
  },
  huggingface: {
    endpoint: 'https://api-inference.huggingface.co/v1/chat/completions',
    models: ['Qwen/Qwen2.5-Coder-32B-Instruct', 'meta-llama/Llama-2-70b-chat-hf'],
    estimatedElo: 1550,
    rateLimit: { unlimited: true }
  },
  together: {
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    models: ['meta-llama/Llama-3.2-3B-Instruct'],
    estimatedElo: 1500,
    rateLimit: { rpm: 'unlimited with credit' }
  }
};

export class MultiProviderLLM {
  private provider: string;
  private model: string;
  private apiKey: string;
  private endpoint: string;
  private estimatedElo: number;

  constructor(providerName: string, model: string, apiKey: string) {
    const config = PROVIDER_CONFIGS[providerName as keyof typeof PROVIDER_CONFIGS];
    if (!config) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    this.provider = providerName;
    this.model = model || config.models[0];
    this.apiKey = apiKey;
    this.endpoint = config.endpoint;
    this.estimatedElo = config.estimatedElo;
  }

  async getMove(
    fen: string,
    legalMoves: string[],
    context?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    const systemPrompt = `You are an expert chess engine in a research tournament. Your objective is to WIN.

STRATEGIC INSTRUCTIONS:
1. Play to WIN - make aggressive, winning moves
2. Analyze tactics: Look for checks, captures, threats
3. Avoid repetitive moves - do NOT move pieces back and forth
4. Prioritize: Checkmate > Material gain > Position > Avoiding loss
5. Each move should improve your position or harm opponent's

RESPONSE REQUIREMENTS:
- Output EXACTLY ONE move from the legal moves list
- Use standard algebraic notation: e4, Nf3, Qxd5, O-O, etc.
- NO explanations, NO extra text, NO punctuation
- ONLY the move symbol itself

CRITICAL: If you see repetition happening, STOP and make a decisive move instead.`;

    const legalMovesStr = legalMoves.slice(0, 30).join(', ');
    const userPrompt = `FEN: ${fen}

Available legal moves (${legalMoves.length} total):
${legalMovesStr}${legalMoves.length > 30 ? '... and ' + (legalMoves.length - 30) + ' more' : ''}

Your next move (output only the move):`;

    try {
      let response;

      switch (this.provider) {
        case 'groq':
          response = await this.callGroq(systemPrompt, userPrompt);
          break;
        case 'openrouter':
          response = await this.callOpenRouter(systemPrompt, userPrompt);
          break;
        case 'google':
          response = await this.callGoogle(systemPrompt, userPrompt);
          break;
        case 'mistral':
          response = await this.callMistral(systemPrompt, userPrompt);
          break;
        case 'huggingface':
          response = await this.callHuggingFace(systemPrompt, userPrompt);
          break;
        case 'together':
          response = await this.callTogether(systemPrompt, userPrompt);
          break;
        default:
          throw new Error(`Unknown provider: ${this.provider}`);
      }

      const latencyMs = Date.now() - startTime;

      // Parse move from response
      const move = this.parseMove(response, legalMoves);

      if (!move) {
        throw new Error(`Could not extract valid move from response: ${response}`);
      }

      return {
        move,
        reasoning: response.substring(0, 200),
        latencyMs
      };
    } catch (error: any) {
      // Handle rate limiting with retry
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers['retry-after'] || 2;
        const waitTime = parseInt(retryAfter) * 1000;
        console.log(`⏳ Rate limit hit. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Retry the request once
        return this.getMove(fen, legalMoves);
      }
      
      const errorDetails = error.response?.data 
        ? JSON.stringify(error.response.data).substring(0, 200)
        : error.message;
      throw new Error(
        `${this.provider} (${this.model}) error: ${errorDetails}`
      );
    }
  }

  private async callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await axios.post(
      this.endpoint,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private async callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await axios.post(
      this.endpoint,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'LLMArena'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private async callGoogle(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await axios.post(
      `${this.endpoint}chat/completions?key=${this.apiKey}`,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private async callMistral(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await axios.post(
      this.endpoint,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private async callHuggingFace(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await axios.post(
      this.endpoint,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private async callTogether(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await axios.post(
      this.endpoint,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private parseMove(response: string, legalMoves: string[]): string | null {
    // Clean the response - remove whitespace, newlines, extra characters
    let cleaned = response.trim();
    
    // Remove common extra characters and punctuation
    cleaned = cleaned
      .replace(/[.\n\r\t]/g, '') // Remove dots, newlines, tabs
      .replace(/^[^a-zA-Z0-9]+/, '') // Remove leading non-alphanumeric
      .replace(/[^a-zA-Z0-9x#+=-]+$/, '') // Remove trailing non-alphanumeric
      .trim();

    // Extract first token (in case there's text after the move)
    const firstToken = cleaned.split(/[\s,;:!?()]+/)[0].trim();

    // Try to find exact match in legal moves
    for (const move of legalMoves) {
      if (firstToken === move) {
        return move;
      }
    }

    // Try case-insensitive match
    const firstTokenUpper = firstToken.toUpperCase();
    for (const move of legalMoves) {
      if (firstTokenUpper === move.toUpperCase()) {
        return move;
      }
    }

    // Last resort: check if response contains any legal move
    for (const move of legalMoves) {
      if (cleaned.includes(move)) {
        return move;
      }
    }

    return null;
  }

  getInfo() {
    return {
      provider: this.provider,
      model: this.model,
      estimatedElo: this.estimatedElo
    };
  }
}

export default MultiProviderLLM;
