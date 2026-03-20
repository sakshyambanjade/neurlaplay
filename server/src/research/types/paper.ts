import type { PreflightReport, RunManifest, RunStatus } from './run.js';

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
