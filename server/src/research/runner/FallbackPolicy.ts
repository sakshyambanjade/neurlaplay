import type { LegalMoveOption, RepetitionRisk } from '../types/move.js';
import type { FallbackPolicyName } from '../types/provider.js';

function isImmediateReverse(previousMoveUci: string | null | undefined, nextMoveUci: string): boolean {
  if (!previousMoveUci || previousMoveUci.length < 4 || nextMoveUci.length < 4) {
    return false;
  }
  return (
    previousMoveUci.slice(0, 2) === nextMoveUci.slice(2, 4) &&
    previousMoveUci.slice(2, 4) === nextMoveUci.slice(0, 2)
  );
}

export function chooseFallbackMove(args: {
  legalMoves: LegalMoveOption[];
  policy: FallbackPolicyName;
  stockfishBestMove?: string | null;
  rngSeed?: number;
  lastMoveUci?: string | null;
  previousFenSet?: Set<string>;
  simulatedFenByMove?: Record<string, string>;
  repetitionRiskByMove?: Record<string, RepetitionRisk>;
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

  const withoutReverse = legalMoves.filter(
    (entry) => !isImmediateReverse(args.lastMoveUci, entry.uci)
  );
  const reverseFiltered = withoutReverse.length > 0 ? withoutReverse : legalMoves;

  const withoutRepeatState = reverseFiltered.filter((entry) => {
    const nextFen = args.simulatedFenByMove?.[entry.uci];
    if (!nextFen || !args.previousFenSet) {
      return true;
    }
    return !args.previousFenSet.has(nextFen);
  });
  const repeatFiltered = withoutRepeatState.length > 0 ? withoutRepeatState : reverseFiltered;

  const withoutNoProgress = repeatFiltered.filter((entry) => {
    const risk = args.repetitionRiskByMove?.[entry.uci];
    return !risk?.noProgressRisk;
  });
  const noProgressFiltered = withoutNoProgress.length > 0 ? withoutNoProgress : repeatFiltered;

  const sorted = [...noProgressFiltered].sort((a, b) => a.uci.localeCompare(b.uci));
  const chosen = sorted[0]!;
  let reason = 'deterministic_first_forced_repeat';
  if (withoutReverse.length > 0 && withoutRepeatState.length > 0 && withoutNoProgress.length > 0) {
    reason = 'deterministic_first_safe';
  } else if (withoutReverse.length > 0 && withoutRepeatState.length === 0) {
    reason = 'deterministic_first_avoided_reverse';
  } else if (withoutReverse.length === 0 && withoutRepeatState.length > 0) {
    reason = 'deterministic_first_avoided_repeat_state';
  } else if (withoutNoProgress.length > 0) {
    reason = 'deterministic_first_safe';
  }
  return { move: chosen.san, reason };
}
