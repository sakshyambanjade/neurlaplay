import { parseIndexOnly } from './parser.js';
import { buildSelectionPrompts, splitProviderModel, type ModelBackend } from './base.js';
import type { MoveSelectionInput, ModelSelectionResult } from '../types/move.js';
import { GroqKeyPool } from './GroqKeyPool.js';

function buildGroqReasoningOptions(model: string): Record<string, unknown> {
  if (/qwen\/qwen3/i.test(model)) {
    return {
      reasoning_format: 'hidden',
      reasoning_effort: 'none'
    };
  }

  return {};
}

function parseRetryAfterMs(response: Response, rawOutput: string): number | null {
  const retryAfterHeader = response.headers.get('retry-after');
  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.round(retryAfterSeconds * 1000);
    }
  }

  const match = rawOutput.match(/try again in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!match?.[1]) {
    return null;
  }
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

export class GroqBackend implements ModelBackend {
  constructor(private readonly apiKeyOrPool: string | GroqKeyPool) {}

  async selectMoveIndex(input: MoveSelectionInput): Promise<ModelSelectionResult> {
    const startedAt = Date.now();
    const { model } = splitProviderModel(input.providerModel);
    const prompts = buildSelectionPrompts(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 10000);

    const lease =
      typeof this.apiKeyOrPool === 'string'
        ? { key: this.apiKeyOrPool, keyId: null }
        : await this.apiKeyOrPool.lease();

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lease.key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompts.system },
            { role: 'user', content: prompts.user }
          ],
          temperature: input.temperature ?? 0,
          top_p: 1,
          max_tokens: 2,
          stop: ['\n'],
          ...buildGroqReasoningOptions(model)
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const rawOutput = await response.text();
        const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response, rawOutput) : null;
        if (lease.keyId && this.apiKeyOrPool instanceof GroqKeyPool) {
          if (response.status === 429) {
            this.apiKeyOrPool.releaseRateLimited(lease.keyId, retryAfterMs ?? 2000);
          } else {
            this.apiKeyOrPool.releaseFailure(lease.keyId);
          }
        }
        return {
          rawOutput,
          selectedIndex: null,
          valid: false,
          failureMode: response.status === 429 ? 'rate_limited' : 'provider_error',
          latencyMs: Date.now() - startedAt,
          provider: 'groq',
          model,
          statusCode: response.status,
          retryAfterMs,
          keyId: lease.keyId
        };
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawOutput = data.choices?.[0]?.message?.content ?? '';
      const parsed = parseIndexOnly(rawOutput, input.legalMovesUci.length);
      if (lease.keyId && this.apiKeyOrPool instanceof GroqKeyPool) {
        this.apiKeyOrPool.releaseSuccess(lease.keyId);
      }
      return {
        rawOutput,
        selectedIndex: parsed.selectedIndex,
        valid: parsed.valid,
        failureMode: parsed.failureMode,
        latencyMs: Date.now() - startedAt,
        provider: 'groq',
        model,
        statusCode: 200,
        retryAfterMs: null,
        keyId: lease.keyId
      };
    } catch (error) {
      if (lease.keyId && this.apiKeyOrPool instanceof GroqKeyPool) {
        this.apiKeyOrPool.releaseFailure(lease.keyId);
      }
      return {
        rawOutput: '',
        selectedIndex: null,
        valid: false,
        failureMode:
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        latencyMs: Date.now() - startedAt,
        provider: 'groq',
        model,
        retryAfterMs: null,
        keyId: lease.keyId
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
