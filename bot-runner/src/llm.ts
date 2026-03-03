/**
 * LLM caller for the bot runner
 * Handles all LLM provider compatibility
 */

import { buildPrompt, buildRetryPrompt } from './prompts';

export type EndpointType = 'openai' | 'anthropic' | 'groq' | 'custom';

export interface LLMConfig {
  apiKey: string;
  endpointUrl: string;
  model: string;
  endpointType: EndpointType;
}

export interface LLMCallParams {
  fen: string;
  legalMoves: string[];
  pgn: string;
  color: 'white' | 'black';
  config: LLMConfig;
  timeoutMs: number;
}

export interface MoveResult {
  move: string;
  reasoning: string;
}

export async function callLLMForMove(params: LLMCallParams): Promise<MoveResult> {
  const prompt = buildPrompt({
    fen: params.fen,
    legalMoves: params.legalMoves,
    pgn: params.pgn,
    color: params.color
  });

  try {
    const result = await callLLM(params.config, prompt, params.timeoutMs);

    // Parse the response
    const parsed = parseResponse(result);

    // Validate move is in legalMoves
    if (!params.legalMoves.includes(parsed.move)) {
      // Retry once with error context
      const retryPrompt = buildRetryPrompt({
        fen: params.fen,
        legalMoves: params.legalMoves,
        pgn: params.pgn,
        color: params.color,
        badMove: parsed.move
      });

      const retryResult = await callLLM(params.config, retryPrompt, params.timeoutMs);
      const retryParsed = parseResponse(retryResult);

      if (!params.legalMoves.includes(retryParsed.move)) {
        throw new Error(`INVALID: Move "${retryParsed.move}" not in legal moves after retry`);
      }

      return retryParsed;
    }

    return parsed;
  } catch (err: any) {
    if (err.message.includes('TIMEOUT') || err.code === 'ECONNABORTED') {
      throw new Error(`TIMEOUT: LLM call exceeded ${params.timeoutMs}ms`);
    }
    throw err;
  }
}

async function callLLM(config: LLMConfig, prompt: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;

    if (config.endpointType === 'openai') {
      response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0
        }),
        signal: controller.signal
      });
    } else if (config.endpointType === 'anthropic') {
      response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0
        }),
        signal: controller.signal
      });
    } else if (config.endpointType === 'groq') {
      response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0
        }),
        signal: controller.signal
      });
    } else {
      // Custom endpoint (assume OpenAI-compatible)
      response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0
        }),
        signal: controller.signal
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 429) {
        throw new Error(`QUOTA: API rate limit exceeded (429)`);
      }
      if (response.status === 401) {
        throw new Error(`UNAUTHORIZED: Invalid API key (401)`);
      }
      if (response.status === 403) {
        throw new Error(`FORBIDDEN: Access denied (403)`);
      }

      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();

    // Extract content based on provider
    let content = '';

    if (config.endpointType === 'openai' || config.endpointType === 'groq' || config.endpointType === 'custom') {
      content = data.choices?.[0]?.message?.content || '';
    } else if (config.endpointType === 'anthropic') {
      content = data.content?.[0]?.text || '';
    }

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function parseResponse(text: string): MoveResult {
  // Limit text length for logging/debugging
  const MAX_TEXT_LENGTH = 5000;
  if (text.length > MAX_TEXT_LENGTH) {
    console.warn(`[LLM] Response too long (${text.length} chars), truncating for parsing`);
    text = text.substring(0, MAX_TEXT_LENGTH);
  }

  // Try to extract JSON from the response
  // Handle cases where LLM returns markdown code blocks or extra text
  
  let json: any;

  // Try direct JSON parse first
  try {
    json = JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        json = JSON.parse(jsonMatch[1]);
      } catch {
        // Fall through to regex extraction
      }
    }
  }

  // If still no JSON, try regex extraction
  if (!json) {
    const jsonMatch = text.match(/\{[\s\S]*"move"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        json = JSON.parse(jsonMatch[0]);
      } catch {
        // Continue
      }
    }
  }

  // If we got JSON, validate it
  if (json && typeof json === 'object') {
    const move = json.move || json.uci || '';
    const reasoning = json.reasoning || json.reason || json.explanation || '';

    if (move && typeof move === 'string') {
      return {
        move: move.toLowerCase().trim(),
        reasoning: reasoning && typeof reasoning === 'string' 
          ? reasoning.substring(0, 500).trim() 
          : 'No reasoning provided'
      };
    }
  }

  // If all parsing failed, log a helpful error with preview
  const preview = text.substring(0, 200);
  console.error('[LLM] Failed to parse response. Preview:', preview);
  throw new Error('Could not parse LLM response as valid JSON with "move" field');
}
