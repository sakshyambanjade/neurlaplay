import type { LegalMoveOption } from '../ollama.js';
import type { FallbackPolicyName } from '../types/provider.js';

export function chooseFallbackMove(args: {
  legalMoves: LegalMoveOption[];
  policy: FallbackPolicyName;
  stockfishBestMove?: string | null;
  rngSeed?: number;
}): { move: string; reason: string } {
  const { legalMoves, policy, stockfishBestMove } = args;
  if (legalMoves.length === 0) {
    throw new Error('Cannot choose a fallback move when no legal moves exist.');
  }

  if (policy === 'stockfish_best' && stockfishBestMove) {
    const match = legalMoves.find((entry) => entry.uci === stockfishBestMove || entry.san === stockfishBestMove);
    if (match) {
      return { move: match.san, reason: 'stockfish_best' };
    }
  }

  if (policy === 'random_seeded') {
    const index = (args.rngSeed ?? 0) % legalMoves.length;
    return { move: legalMoves[index]!.san, reason: 'random_seeded' };
  }

  const sorted = [...legalMoves].sort((a, b) => a.uci.localeCompare(b.uci));
  return { move: sorted[0]!.san, reason: 'deterministic_first' };
}
