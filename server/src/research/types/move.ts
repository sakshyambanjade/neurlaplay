import type { ProviderKind } from './provider.js';

export type SelectionFailureMode =
  | 'none'
  | 'empty'
  | 'non_integer'
  | 'out_of_range'
  | 'network_error'
  | 'timeout'
  | 'provider_error'
  | 'invalid_output';

export type MoveSelectionInput = {
  fen: string;
  legalMovesUci: string[];
  legalMovesSan?: string[];
  providerModel: string;
  systemPrompt?: string;
  temperature?: number;
  seed?: number;
  timeoutMs?: number;
  strict?: boolean;
};

export type ModelSelectionResult = {
  rawOutput: string;
  selectedIndex: number | null;
  valid: boolean;
  failureMode: SelectionFailureMode;
  latencyMs: number;
  provider: ProviderKind;
  model: string;
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
};
