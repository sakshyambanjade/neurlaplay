import { Chess, type Square } from 'chess.js';
import type { BindingProfile, IllegalMoveFailureMode } from './types.js';

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
  rawResponse: string;
  failureMode: IllegalMoveFailureMode | null;
  bindingProfile: BindingProfile;
};

const EMPTY_BINDING_PROFILE: BindingProfile = {
  hasPiece: false,
  hasOrigin: false,
  hasDestination: false,
  hasLegalConstraint: false,
  boundCount: 0
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

function isBoardSquare(token: string): boolean {
  return /^[a-h][1-8]$/i.test(token.trim());
}

function hasExplicitPieceMention(text: string): boolean {
  if (/(\bking\b|\bqueen\b|\brook\b|\bbishop\b|\bknight\b|\bpawn\b)/i.test(text)) {
    return true;
  }
  const tokens = tokenizeCandidates(text);
  return tokens.some((t) => /^[KQRBN]/.test(t.trim()));
}

function toBoundCount(profile: Omit<BindingProfile, 'boundCount'>): BindingProfile {
  const boundCount =
    Number(profile.hasPiece) +
    Number(profile.hasOrigin) +
    Number(profile.hasDestination) +
    Number(profile.hasLegalConstraint);
  return {
    ...profile,
    boundCount: Math.max(0, Math.min(4, boundCount)) as 0 | 1 | 2 | 3 | 4
  };
}

function buildBindingProfile(raw: string, fen: string, legalMoves: LegalMoveOption[]): BindingProfile {
  const compact = raw.trim();
  if (!compact) {
    return EMPTY_BINDING_PROFILE;
  }

  let chess: Chess | null = null;
  try {
    chess = new Chess(fen);
  } catch {
    chess = null;
  }

  const sideToMove = chess?.turn() ?? null;
  const legalByUci = new Set(legalMoves.map((m) => normalizeUci(m.uci)).filter(Boolean));
  const legalBySan = new Set(legalMoves.map((m) => normalizeSan(m.san)).filter(Boolean));

  const uciMatch = compact.match(/\b([a-h][1-8])([a-h][1-8])([qrbn])?\b/i);
  const sanMatch = compact.match(/\b(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/i);

  let origin: string | null = null;
  let destination: string | null = null;
  let moveToken = '';

  if (uciMatch) {
    origin = uciMatch[1]!.toLowerCase();
    destination = uciMatch[2]!.toLowerCase();
    moveToken = `${origin}${destination}${(uciMatch[3] ?? '').toLowerCase()}`;
  } else if (sanMatch) {
    moveToken = sanMatch[1] ?? '';
    const squares = moveToken.match(/[a-h][1-8]/gi) ?? [];
    if (squares.length > 0) {
      destination = squares[squares.length - 1]!.toLowerCase();
    }
  }

  const anySquares = compact.match(/\b[a-h][1-8]\b/gi) ?? [];
  const hasDestination = Boolean(destination) || anySquares.length >= 1;

  let hasOrigin = false;
  let hasPiece = hasExplicitPieceMention(compact);

  if (origin && isBoardSquare(origin) && chess) {
    const piece = chess.get(origin as Square);
    hasOrigin = Boolean(piece && piece.color === sideToMove);
    if (piece && piece.color === sideToMove) {
      hasPiece = true;
    }
  }

  let hasLegalConstraint = false;
  if (moveToken) {
    const normalizedUci = normalizeUci(moveToken);
    const normalizedSan = normalizeSan(moveToken);
    hasLegalConstraint = legalByUci.has(normalizedUci) || legalBySan.has(normalizedSan);
  }

  return toBoundCount({
    hasPiece,
    hasOrigin,
    hasDestination,
    hasLegalConstraint
  });
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

function classifyIllegalMoveFailure(raw: string): IllegalMoveFailureMode {
  const compact = raw.trim();
  if (!compact) {
    return 'empty_output';
  }

  const lower = compact.toLowerCase();
  if (/(timeout|timed out|abort|aborted|cancelled)/i.test(lower)) {
    return 'timeout_or_abort';
  }
  if (/(request failed|internal server error|connection refused|service unavailable|status\s*\d{3})/i.test(lower)) {
    return 'request_failed';
  }
  if (/(sorry|cannot|can't|unable|as an ai|i do not)/i.test(lower)) {
    return 'non_chess_text';
  }

  const tokens = tokenizeCandidates(compact);
  const hasMoveTag = /\bmove\s*[:=]/i.test(compact);
  const looksLikeUci = tokens.some((t) => /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(t));
  const looksLikeSan = tokens.some((t) => /^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)$/i.test(t));

  if (looksLikeUci || looksLikeSan) {
    return 'pseudo_legal_or_illegal';
  }
  if (!hasMoveTag && /\b(confidence|reason)\b/i.test(compact)) {
    return 'wrong_format';
  }
  if (hasMoveTag && !looksLikeUci && !looksLikeSan) {
    return 'wrong_format';
  }
  return 'unparseable';
}

export async function chooseMoveWithOllamaDetailed(
  baseUrl: string,
  model: string,
  fen: string,
  legalMoves: LegalMoveOption[],
  timeoutMs: number
): Promise<OllamaMoveResponse> {
  const moveList = legalMoves.map((m) => m.san).join(' ');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `Output exactly one SAN move from this list: ${moveList}. No other text.`
          },
          {
            role: 'user',
            content: `FEN: ${fen}\nAllowed moves: ${moveList}\nMove:`
          }
        ],
        options: {
          num_predict: 4,     // force very short output
          temperature: 0.0,
          top_k: 10,          // small shortlist, but not locked to a single token
          top_p: 0.9,
          num_ctx: 512,
          num_thread: 12,
          repeat_penalty: 1.3,
          stop: [' ', '\n', '.', ',']
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        move: null,
        reasoning: 'Model request failed.',
        confidence: 0.5,
        rawResponse: `HTTP ${response.status}`,
        failureMode: 'request_failed',
        bindingProfile: EMPTY_BINDING_PROFILE
      };
    }

    const data = (await response.json()) as OllamaResponse;
    const raw = (data.message?.content ?? '').trim();
    const move = pickMoveFromText(raw, legalMoves);

    return {
      move: move,
      reasoning: sanitizeReasoning(raw),
      confidence: parseConfidence(raw),
      rawResponse: raw,
      failureMode: move ? null : classifyIllegalMoveFailure(raw),
      bindingProfile: buildBindingProfile(raw, fen, legalMoves)
    };
  } catch {
    return {
      move: null,
      reasoning: 'Model timed out or returned invalid output.',
      confidence: 0.5,
      rawResponse: '',
      failureMode: 'timeout_or_abort',
      bindingProfile: EMPTY_BINDING_PROFILE
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function chooseMoveWithGroq(
  apiKey: string,
  model: string,
  fen: string,
  legalMoves: LegalMoveOption[],
  timeoutMs: number
): Promise<OllamaMoveResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const moveList = legalMoves.map((m) => m.san).join(' ');
  const nonce = Math.random().toString(36).slice(2, 8); // break deterministic tie, keeps moves varied

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Output exactly one SAN move from this list: ${moveList}. No other text.`
          },
          {
            role: 'user',
            content: `FEN: ${fen}\nAllowed moves: ${moveList}\nMove:\nContext nonce: ${nonce}`
          }
        ],
        max_tokens: 6,
        temperature: 0.1,
        top_p: 0.95,
        stop: [' ', '\n', '.', ',']
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        move: null,
        reasoning: `Groq request failed: ${err.slice(0, 100)}`,
        confidence: 0.5,
        rawResponse: err,
        failureMode: 'request_failed',
        bindingProfile: EMPTY_BINDING_PROFILE
      };
    }

    const data = (await response.json()) as any;
    const raw = (data.choices?.[0]?.message?.content ?? '').trim();
    const move = pickMoveFromText(raw, legalMoves);

    return {
      move,
      reasoning: sanitizeReasoning(raw),
      confidence: parseConfidence(raw),
      rawResponse: raw,
      failureMode: move ? null : classifyIllegalMoveFailure(raw),
      bindingProfile: buildBindingProfile(raw, fen, legalMoves)
    };
  } catch {
    return {
      move: null,
      reasoning: 'Groq request timed out.',
      confidence: 0.5,
      rawResponse: '',
      failureMode: 'timeout_or_abort',
      bindingProfile: EMPTY_BINDING_PROFILE
    };
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
