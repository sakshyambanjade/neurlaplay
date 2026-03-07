type OllamaResponse = {
  message?: {
    content?: string;
  };
};

export type LegalMoveOption = {
  san: string;
  uci: string;
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

function normalizeSan(move: string): string {
  return move
    .trim()
    .replace(/[+#?!]+$/g, '')
    .replace(/0-0-0/g, 'O-O-O')
    .replace(/0-0/g, 'O-O');
}

function normalizeUci(move: string): string {
  return move
    .trim()
    .toLowerCase()
    .replace(/[^a-h1-8qrbn]/g, '');
}

function tokenizeCandidates(text: string): string[] {
  const picks: string[] = [];

  const moveLine = text.match(/move\s*[:=]\s*([^\n\r]+)/i);
  if (moveLine?.[1]) {
    picks.push(moveLine[1].trim().split(/\s+/)[0] ?? '');
  }

  const firstToken = text.trim().split(/\s+/)[0] ?? '';
  if (firstToken) {
    picks.push(firstToken);
  }

  const allTokens = text.match(/[A-Za-z0-9=+#-]+/g) ?? [];
  picks.push(...allTokens);
  return picks.filter(Boolean);
}

function pickMoveFromText(text: string, legalMoves: LegalMoveOption[]): string | null {
  const compact = text.trim();
  if (!compact) {
    return null;
  }

  const byUci = new Map<string, string>();
  const bySan = new Map<string, string>();
  for (const move of legalMoves) {
    byUci.set(normalizeUci(move.uci), move.san);
    bySan.set(normalizeSan(move.san), move.san);
  }

  const candidates = tokenizeCandidates(compact);
  for (const token of candidates) {
    const asUci = byUci.get(normalizeUci(token));
    if (asUci) {
      return asUci;
    }
    const asSan = bySan.get(normalizeSan(token));
    if (asSan) {
      return asSan;
    }
  }

  // Last chance: search full text for an exact legal token boundary.
  for (const move of legalMoves) {
    if (new RegExp(`\\b${escapeRegExp(move.uci)}\\b`, 'i').test(compact)) {
      return move.san;
    }
    if (new RegExp(`\\b${escapeRegExp(move.san)}\\b`, 'i').test(compact)) {
      return move.san;
    }
  }

  return null;
}

export async function chooseMoveWithOllamaDetailed(
  baseUrl: string,
  model: string,
  fen: string,
  legalMoves: LegalMoveOption[],
  timeoutMs: number
): Promise<OllamaMoveResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const prompt = [
    'You are a chess move selector.',
    `FEN: ${fen}`,
    `Legal SAN moves: ${legalMoves.map((m) => m.san).join(', ')}`,
    `Legal UCI moves: ${legalMoves.map((m) => m.uci).join(', ')}`,
    'Return EXACTLY this format:',
    'MOVE: <one legal UCI move from the list>',
    'CONFIDENCE: <0..1>',
    'REASON: <one short sentence>'
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
  legalMoves: LegalMoveOption[],
  timeoutMs: number
): Promise<string | null> {
  const result = await chooseMoveWithOllamaDetailed(baseUrl, model, fen, legalMoves, timeoutMs);
  return result.move;
}
