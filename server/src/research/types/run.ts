import type { ExperimentMode, FallbackPolicyName } from './provider.js';

export type MatchupConfig = {
  white: string;
  black: string;
  games: number;
  label: string;
};

export type RunConfig = {
  paperAngle: 'option_a_tension' | 'option_b_capability';
  mode: ExperimentMode;
  matchups: MatchupConfig[];
  seed: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  contextPolicy: 'full_pgn_history' | 'last_10_moves' | 'fen_only';
  stockfishEvalDepth: number;
  blunderThresholdCp: number;
  settings: {
    maxMoves: number;
    moveTimeoutMs: number;
    gameTimeoutMs: number;
    moveDelayMs: number;
    interGameDelayMs: number;
    exportInterval: number;
    seed: number;
    openingRandomMoves: number;
    retryCount: number;
    providerRetryCount?: number;
    providerBackoffMs?: number;
    maxTotalProviderWaitMs?: number;
    fallbackPolicy: FallbackPolicyName;
  };
  logging: {
    logEveryMove: boolean;
    schemaVersion: string;
  };
};

export type RunManifest = {
  runId: string;
  createdAt: string;
  gitCommit: string;
  nodeVersion: string;
  acceptedConfigHash: string;
  schemaVersion: string;
  config: RunConfig;
  promptTemplate: {
    system: string;
    user: string;
  };
  decodingParams: {
    temperature: number;
    topP: number;
    maxTokens: number;
  };
  contextPolicy: RunConfig['contextPolicy'];
  hardware: {
    platform: string;
    cpus: number;
    cpuModel: string;
    totalMemoryGB: string;
  };
  randomSeed: number;
};

export type RunStatus = {
  runId: string;
  step: string;
  progress: number;
  total: number;
  done: boolean;
  error?: string;
  startedAt: string;
  finishedAt?: string;
};

export type PreflightReport = {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    detail: string;
  }>;
};

export type ResumeState = {
  runId: string;
  exists: boolean;
  resumable: boolean;
  done: boolean;
  completedMatchups: string[];
  incompleteMatchups: string[];
};
