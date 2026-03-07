type OllamaResponse = {
  message?: {
    content?: string;
  };
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type OllamaMoveResponse = {
  move: string | null;
  reasoning: string;
  confidence: number;
};

function parseConfidence(text: string): number {
  const match = text.match(/confidence\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  if (!match) {
    return 0.5;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

function sanitizeReasoning(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'No reasoning returned by model.';
  }
  return trimmed.slice(0, 500);
}

function pickMoveFromText(text: string, legalMoves: string[]): string | null {
  const compact = text.trim();
  if (!compact) {
    return null;
  }

  const firstToken = compact.split(/\s+/)[0] ?? '';
  if (legalMoves.includes(firstToken)) {
    return firstToken;
  }

  for (const move of legalMoves) {
    if (new RegExp(`\\b${escapeRegExp(move)}\\b`).test(compact)) {
      return move;
    }
  }

  return null;
}

export async function chooseMoveWithOllamaDetailed(
  baseUrl: string,
  model: string,
  fen: string,
  legalMoves: string[],
  timeoutMs: number
): Promise<OllamaMoveResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const prompt = [
    'You are a chess engine helper.',
    `FEN: ${fen}`,
    `Choose one legal move from this list: ${legalMoves.join(', ')}`,
    'Respond in two lines:',
    'MOVE: <move>',
    'CONFIDENCE: <0..1>',
    'Then one short sentence explaining why.'
  ].join('\n');

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
        options: {
          num_gpu: 999,        // Force ALL layers to GPU (GTX 1650 4GB can handle TinyLlama/Phi3 fully)
          num_predict: 40,     // Just move + 1 sentence
          temperature: 0.0,    // Deterministic = faster
          top_p: 0.9,
          top_k: 20,           // Limit sampling space
          num_ctx: 256,        // Minimal context (we only need current position)
          num_thread: 12,      // Use all 12 threads (Ryzen 5 4600H)
          repeat_penalty: 1.0, // No extra computation
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { move: null, reasoning: 'Model request failed.', confidence: 0.5 };
    }

    const data = (await response.json()) as OllamaResponse;
    const raw = (data.message?.content ?? '').trim();

    return {
      move: pickMoveFromText(raw, legalMoves),
      reasoning: sanitizeReasoning(raw),
      confidence: parseConfidence(raw)
    };
  } catch {
    return { move: null, reasoning: 'Model timed out or returned invalid output.', confidence: 0.5 };
  } finally {
    clearTimeout(timer);
  }
}

export async function chooseMoveWithOllama(
  baseUrl: string,
  model: string,
  fen: string,
  legalMoves: string[],
  timeoutMs: number
): Promise<string | null> {
  const result = await chooseMoveWithOllamaDetailed(baseUrl, model, fen, legalMoves, timeoutMs);
  return result.move;
}
