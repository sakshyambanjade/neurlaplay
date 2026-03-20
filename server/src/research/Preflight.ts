import { access, mkdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import type { PreflightReport, RunConfig } from './types/run.js';
import { inferProviderFromModel } from './types/provider.js';

async function canWrite(dir: string): Promise<boolean> {
  try {
    await mkdir(dir, { recursive: true });
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

export async function runPreflightChecks(
  config: RunConfig,
  opts: { runDir: string; ollamaBaseUrl: string }
): Promise<PreflightReport> {
  const checks: PreflightReport['checks'] = [];

  const runDirOk = await canWrite(opts.runDir);
  checks.push({
    name: 'run_dir_writable',
    ok: runDirOk,
    detail: runDirOk ? opts.runDir : `Cannot write ${opts.runDir}`
  });

  const needsGroq = config.matchups.some((m) => inferProviderFromModel(m.white) === 'groq' || inferProviderFromModel(m.black) === 'groq');
  const groqKeys = (process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? '').trim();
  checks.push({
    name: 'groq_keys',
    ok: !needsGroq || groqKeys.length > 0,
    detail: needsGroq ? (groqKeys.length > 0 ? 'Groq API key(s) present' : 'Missing GROQ_API_KEY(S)') : 'Groq not required'
  });

  const needsOllama = config.matchups.some((m) => inferProviderFromModel(m.white) === 'ollama' || inferProviderFromModel(m.black) === 'ollama');
  if (needsOllama) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${opts.ollamaBaseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      checks.push({
        name: 'ollama_health',
        ok: response.ok,
        detail: response.ok ? 'Ollama reachable' : `Ollama HTTP ${response.status}`
      });
    } catch (error) {
      checks.push({
        name: 'ollama_health',
        ok: false,
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    checks.push({
      name: 'ollama_health',
      ok: true,
      detail: 'Ollama not required'
    });
  }

  const stockfishPackage = path.resolve(process.cwd(), 'node_modules', 'stockfish');
  checks.push({
    name: 'stockfish_package',
    ok: fs.existsSync(stockfishPackage),
    detail: fs.existsSync(stockfishPackage) ? 'stockfish package installed' : 'stockfish package missing'
  });

  const scriptsRoot = path.resolve(process.cwd(), '../paper');
  checks.push({
    name: 'paper_root',
    ok: fs.existsSync(scriptsRoot),
    detail: scriptsRoot
  });

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}
