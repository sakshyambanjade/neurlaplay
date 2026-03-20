import type { ModelBackend } from '../model_backends/base.js';
import type { LegalMoveOption } from '../ollama.js';
import type { FallbackPolicyName } from '../types/provider.js';
import type { ModelSelectionResult } from '../types/move.js';
import { chooseFallbackMove } from './FallbackPolicy.js';

export type ValidatedMoveResult = {
  selectedMove: string;
  selectedIndex: number | null;
  primary: ModelSelectionResult;
  retry: ModelSelectionResult | null;
  usedRetry: boolean;
  usedFallback: boolean;
  fallbackReason: string | null;
};

export async function selectValidatedMove(args: {
  backend: ModelBackend;
  fen: string;
  legalMoves: LegalMoveOption[];
  providerModel: string;
  timeoutMs: number;
  retryCount: number;
  fallbackPolicy: FallbackPolicyName;
  seed?: number;
}): Promise<ValidatedMoveResult> {
  const legalMovesUci = args.legalMoves.map((move) => move.uci);
  const legalMovesSan = args.legalMoves.map((move) => move.san);
  const primary = await args.backend.selectMoveIndex({
    fen: args.fen,
    legalMovesUci,
    legalMovesSan,
    providerModel: args.providerModel,
    timeoutMs: args.timeoutMs,
    temperature: 0
  });

  const primaryMove =
    typeof primary.selectedIndex === 'number' ? args.legalMoves[primary.selectedIndex]?.san ?? null : null;
  if (primary.valid && primaryMove) {
    return {
      selectedMove: primaryMove,
      selectedIndex: primary.selectedIndex,
      primary,
      retry: null,
      usedRetry: false,
      usedFallback: false,
      fallbackReason: null
    };
  }

  let retry: ModelSelectionResult | null = null;
  if (args.retryCount > 0) {
    retry = await args.backend.selectMoveIndex({
      fen: args.fen,
      legalMovesUci,
      legalMovesSan,
      providerModel: args.providerModel,
      timeoutMs: args.timeoutMs,
      temperature: 0,
      strict: true
    });
    const retryMove =
      typeof retry.selectedIndex === 'number' ? args.legalMoves[retry.selectedIndex]?.san ?? null : null;
    if (retry.valid && retryMove) {
      return {
        selectedMove: retryMove,
        selectedIndex: retry.selectedIndex,
        primary,
        retry,
        usedRetry: true,
        usedFallback: false,
        fallbackReason: null
      };
    }
  }

  const fallback = chooseFallbackMove({
    legalMoves: args.legalMoves,
    policy: args.fallbackPolicy,
    rngSeed: args.seed
  });
  return {
    selectedMove: fallback.move,
    selectedIndex: null,
    primary,
    retry,
    usedRetry: retry !== null,
    usedFallback: true,
    fallbackReason: fallback.reason
  };
}
