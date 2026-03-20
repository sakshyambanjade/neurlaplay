import type { ModelBackend } from '../model_backends/base.js';
import type { FallbackPolicyName } from '../types/provider.js';
import type { LegalMoveOption, ModelSelectionResult } from '../types/move.js';
import { chooseFallbackMove } from './FallbackPolicy.js';

export type ValidatedMoveResult = {
  selectedMove: string;
  selectedIndex: number | null;
  primary: ModelSelectionResult;
  retry: ModelSelectionResult | null;
  usedRetry: boolean;
  usedFallback: boolean;
  fallbackReason: string | null;
  providerRetries: number;
};

function isProviderFailure(result: ModelSelectionResult): boolean {
  return (
    result.failureMode === 'rate_limited' ||
    result.failureMode === 'network_error' ||
    result.failureMode === 'timeout' ||
    result.failureMode === 'provider_error'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function selectValidatedMove(args: {
  backend: ModelBackend;
  fen: string;
  legalMoves: LegalMoveOption[];
  providerModel: string;
  timeoutMs: number;
  retryCount: number;
  fallbackPolicy: FallbackPolicyName;
  seed?: number;
  providerRetryCount?: number;
  providerBackoffMs?: number;
  maxTotalProviderWaitMs?: number;
  lastMoveUci?: string | null;
  previousFenSet?: Set<string>;
  simulatedFenByMove?: Record<string, string>;
}): Promise<ValidatedMoveResult> {
  const legalMovesUci = args.legalMoves.map((move) => move.uci);
  const providerRetryCount = Math.max(0, args.providerRetryCount ?? 3);
  const providerBackoffMs = Math.max(250, args.providerBackoffMs ?? 2000);
  const maxTotalProviderWaitMs = Math.max(providerBackoffMs, args.maxTotalProviderWaitMs ?? 30000);

  let providerRetries = 0;
  let totalProviderWaitMs = 0;

  async function requestWithProviderRecovery(strict: boolean): Promise<ModelSelectionResult> {
    let attempt = 0;
    let latest = await args.backend.selectMoveIndex({
      fen: args.fen,
      legalMovesUci,
      providerModel: args.providerModel,
      timeoutMs: args.timeoutMs,
      temperature: 0,
      strict
    });

    while (
      isProviderFailure(latest) &&
      attempt < providerRetryCount &&
      totalProviderWaitMs < maxTotalProviderWaitMs
    ) {
      const waitMs = Math.min(
        maxTotalProviderWaitMs - totalProviderWaitMs,
        latest.retryAfterMs ?? providerBackoffMs * (attempt + 1)
      );
      if (waitMs > 0) {
        await sleep(waitMs);
        totalProviderWaitMs += waitMs;
      }
      attempt += 1;
      providerRetries += 1;
      latest = await args.backend.selectMoveIndex({
        fen: args.fen,
        legalMovesUci,
        providerModel: args.providerModel,
        timeoutMs: args.timeoutMs,
        temperature: 0,
        strict
      });
    }

    return latest;
  }

  const primary = await requestWithProviderRecovery(false);

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
      fallbackReason: null,
      providerRetries
    };
  }

  let retry: ModelSelectionResult | null = null;
  if (args.retryCount > 0 && !isProviderFailure(primary)) {
    retry = await requestWithProviderRecovery(true);
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
        fallbackReason: null,
        providerRetries
      };
    }
  }

  const fallback = chooseFallbackMove({
    legalMoves: args.legalMoves,
    policy: args.fallbackPolicy,
    rngSeed: args.seed,
    lastMoveUci: args.lastMoveUci,
    previousFenSet: args.previousFenSet,
    simulatedFenByMove: args.simulatedFenByMove
  });
  return {
    selectedMove: fallback.move,
    selectedIndex: null,
    primary,
    retry,
    usedRetry: retry !== null,
    usedFallback: true,
    fallbackReason: fallback.reason,
    providerRetries
  };
}
