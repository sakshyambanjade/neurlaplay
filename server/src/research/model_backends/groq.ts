import { parseIndexOnly } from './parser.js';
import { buildSelectionPrompts, splitProviderModel, type ModelBackend } from './base.js';
import type { MoveSelectionInput, ModelSelectionResult } from '../types/move.js';

export class GroqBackend implements ModelBackend {
  constructor(private readonly apiKey: string) {}

  async selectMoveIndex(input: MoveSelectionInput): Promise<ModelSelectionResult> {
    const startedAt = Date.now();
    const { model } = splitProviderModel(input.providerModel);
    const prompts = buildSelectionPrompts(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 10000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompts.system },
            { role: 'user', content: prompts.user }
          ],
          temperature: input.temperature ?? 0,
          top_p: 1,
          max_tokens: 6,
          stop: ['\n', '.', ',']
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
          provider: 'groq',
          model
        };
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawOutput = data.choices?.[0]?.message?.content ?? '';
      const parsed = parseIndexOnly(rawOutput, input.legalMovesUci.length);
      return {
        rawOutput,
        selectedIndex: parsed.selectedIndex,
        valid: parsed.valid,
        failureMode: parsed.failureMode,
        latencyMs: Date.now() - startedAt,
        provider: 'groq',
        model
      };
    } catch (error) {
      return {
        rawOutput: '',
        selectedIndex: null,
        valid: false,
        failureMode:
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
        latencyMs: Date.now() - startedAt,
        provider: 'groq',
        model
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
