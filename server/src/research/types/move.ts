import type { ProviderKind } from './provider.js';

export type LegalMoveOption = {
  san: string;
  uci: string;
  flags?: string;
  piece?: string;
  isCapture?: boolean;
  isPawnMove?: boolean;
};

export type SelectionFailureMode =
  | 'none'
  | 'empty'
  | 'non_integer'
  | 'out_of_range'
  | 'network_error'
  | 'timeout'
  | 'provider_error'
  | 'invalid_output'
  | 'rate_limited';

export type RepetitionRisk = {
  reversesLastMove: boolean;
  recreatesPriorFen: boolean;
  noProgressRisk: boolean;
  repeatStateCountAfterMove: number;
};

export type MoveSelectionInput = {
  fen: string;
  legalMovesUci: string[];
  providerModel: string;
  systemPrompt?: string;
  temperature?: number;
  seed?: number;
  timeoutMs?: number;
  strict?: boolean;
  recentMoves?: string[];
  repetitionRiskByIndex?: RepetitionRisk[];
  avoidImmediateRepetition?: boolean;
  promptVariant?: 'paper' | 'debug' | 'free_generation';
};

export type ModelSelectionResult = {
  rawOutput: string;
  selectedIndex: number | null;
  valid: boolean;
  failureMode: SelectionFailureMode;
  latencyMs: number;
  provider: ProviderKind;
  model: string;
  statusCode?: number;
  retryAfterMs?: number | null;
  keyId?: string | null;
};

export type MoveTrace = {
  schemaVersion: string;
  runId: string;
  matchupLabel: string;
  gameId: string;
  ply: number;
  sideToMove: 'white' | 'black';
  fenBefore: string;
  legalMovesUci: string[];
  legalMovesSan: string[];
  provider: ProviderKind;
  model: string;
  rawOutputPrimary: string;
  rawOutputRetry: string | null;
  selectedIndex: number | null;
  selectedMove: string;
  primaryValid: boolean;
  retryValid: boolean;
  usedRetry: boolean;
  usedFallback: boolean;
  fallbackReason: string | null;
  fenAfter: string;
  evalBefore?: number | null;
  evalAfter?: number | null;
  cpl?: number | null;
  latencyMs: number;
  timestamp: string;
  repetitionRiskSelected?: boolean;
  reversesLastMove?: boolean;
  recreatesPriorFen?: boolean;
  noProgressRisk?: boolean;
  recentRepeatCount?: number;
  oscillationRejected?: boolean;
  oscillationOverrideUsed?: boolean;
};
