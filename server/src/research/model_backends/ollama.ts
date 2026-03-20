import { parseIndexOnly } from './parser.js';
import { buildSelectionPrompts, splitProviderModel, type ModelBackend } from './base.js';
import type { MoveSelectionInput, ModelSelectionResult } from '../types/move.js';

export class OllamaBackend implements ModelBackend {
  constructor(private readonly baseUrl: string) {}

  async selectMoveIndex(input: MoveSelectionInput): Promise<ModelSelectionResult> {
    const startedAt = Date.now();
    const { model } = splitProviderModel(input.providerModel);
    const prompts = buildSelectionPrompts(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 10000);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: prompts.system },
            { role: 'user', content: prompts.user }
          ],
          options: {
            temperature: input.temperature ?? 0,
            top_k: 1,
            top_p: 1,
            num_predict: 2,
            stop: ['\n']
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          rawOutput: await response.text(),
          selectedIndex: null,
          valid: false,
          failureMode: 'provider_error',
          latencyMs: Date.now() - startedAt,
          provider: 'ollama',
          model,
          statusCode: response.status,
          retryAfterMs: null,
          keyId: null
        };
      }

      const data = (await response.json()) as { message?: { content?: string } };
      const rawOutput = data.message?.content ?? '';
      const parsed = parseIndexOnly(rawOutput, input.legalMovesUci.length);
      return {
        rawOutput,
        selectedIndex: parsed.selectedIndex,
        valid: parsed.valid,
        failureMode: parsed.failureMode,
        latencyMs: Date.now() - startedAt,
        provider: 'ollama',
        model,
        statusCode: 200,
        retryAfterMs: null,
        keyId: null
      };
    } catch (error) {
      return {
        rawOutput: '',
        selectedIndex: null,
        valid: false,
        failureMode:
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        latencyMs: Date.now() - startedAt,
        provider: 'ollama',
        model,
        retryAfterMs: null,
        keyId: null
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
