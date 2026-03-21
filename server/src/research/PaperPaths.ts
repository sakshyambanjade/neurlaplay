import path from 'node:path';

function resolveConfiguredPath(envName: string, fallbackPath: string): string {
  const configured = process.env[envName]?.trim();
  return configured ? path.resolve(configured) : fallbackPath;
}

export function getPaperWorkspaceRoot(): string {
  return resolveConfiguredPath('PAPER_WORKSPACE_ROOT', path.resolve(process.cwd(), '../paper'));
}

export function getPaperDataRoot(): string {
  return resolveConfiguredPath('PAPER_DATA_ROOT', getPaperWorkspaceRoot());
}

export function getPaperConfigsRoot(): string {
  return path.join(getPaperWorkspaceRoot(), 'configs');
}

export function getPaperRunsRoot(): string {
  return path.join(getPaperDataRoot(), 'runs');
}

export function getPaperLogsRoot(): string {
  return path.join(getPaperDataRoot(), 'logs');
}

export function getPaperAuditRoot(): string {
  return path.join(getPaperDataRoot(), 'audit');
}

export function resolvePaperConfigPath(...segments: string[]): string {
  return path.join(getPaperConfigsRoot(), ...segments);
}
