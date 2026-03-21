import fs from 'node:fs';
import path from 'node:path';
import { getPaperConfigsRoot } from './PaperPaths.js';

export type ExperimentPreset = {
  id: string;
  name: string;
  category: string;
  path: string;
};

function toPresetId(configsRoot: string, fullPath: string): string {
  return path.relative(configsRoot, fullPath).split(path.sep).join('/');
}

function listJsonFiles(root: string, configsRoot: string): ExperimentPreset[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const out: ExperimentPreset[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsonFiles(fullPath, configsRoot));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const id = toPresetId(configsRoot, fullPath);
      out.push({
        id,
        name: path.basename(entry.name, '.json'),
        category: id.split('/')[0] ?? 'default',
        path: fullPath
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function getExperimentRegistry(): ExperimentPreset[] {
  const configsRoot = getPaperConfigsRoot();
  const allowedRoots = ['debug', 'pilot', 'main', 'ablations']
    .map((segment) => path.join(configsRoot, segment))
    .filter((fullPath) => fs.existsSync(fullPath));
  return allowedRoots.flatMap((root) => listJsonFiles(root, configsRoot));
}

export function findExperimentPreset(id: string): ExperimentPreset | null {
  const normalized = id.replace(/\\/g, '/').trim();
  return getExperimentRegistry().find((preset) => preset.id === normalized) ?? null;
}
