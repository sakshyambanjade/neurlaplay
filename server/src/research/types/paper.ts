import type { RunConfig, PreflightReport, RunManifest, RunStatus } from './run.js';

export type PaperArtifactsIndex = {
  files: string[];
  zipPath?: string | null;
};

export type PaperPipelineResult = {
  runId: string;
  runDir: string;
  status: RunStatus;
  manifest: RunManifest;
  preflight: PreflightReport;
  artifacts: PaperArtifactsIndex;
};

export type PaperLiveGameInfo = {
  white: string;
  black: string;
  moveNumber: number;
  gameNum: number;
  totalGames: number;
};

export type PaperLiveQuality = {
  illegalSuggestions: number;
  correctionsApplied: number;
  repeatStateMoves: number;
  oscillationRejected: number;
  oscillationOverrides: number;
  lastMove: string;
  lastModel: string;
  lastSide: string;
};

export type PaperLiveEta = {
  completedGames: number;
  totalGames: number;
  gamesPerHour: number;
  etaSec: number | null;
};

export type PaperLiveHealth = {
  ok: boolean;
  warnings: string[];
  completedGames: number;
  totalMoves: number;
  matchupLabel: string;
  fallbackMoves: number;
  repeatStateMoves: number;
  oscillationRejectedCount: number;
  collapseDetectedGames: number;
  noProgressMaxStreak: number;
};

export type PaperLiveState = {
  runId: string;
  updatedAt: string;
  currentFen: string;
  gameInfo: PaperLiveGameInfo;
  quality: PaperLiveQuality;
  eta: PaperLiveEta;
  health: PaperLiveHealth;
  status: RunStatus;
  acceptedConfig?: RunConfig;
};
