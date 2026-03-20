import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const TIMEOUT_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await Promise.race([
      promise,
      delay(TIMEOUT_MS + 100, null, { signal: controller.signal }).then(() => {
        throw new Error(`${label} timed out after ${TIMEOUT_MS}ms`);
      })
    ]);
    return result as T;
  } finally {
    clearTimeout(timer);
  }
}

function resolveConfigPath(relPath: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), relPath),
    path.resolve(process.cwd(), '..', relPath)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function checkOllama(): Promise<void> {
  const res = await withTimeout(
    fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: 'GET' }),
    'Ollama /api/tags'
  );
  if (!res.ok) {
    throw new Error(`Ollama health check failed (HTTP ${res.status}) at ${OLLAMA_BASE_URL}`);
  }
  const data = (await res.json()) as { models?: Array<{ name: string }> };
  const models = (data.models ?? []).map((m) => m.name);
  if (models.length === 0) {
    throw new Error('Ollama reachable but no models are available; pull at least one model.');
  }
  console.log(`✓ Ollama reachable (${models.length} models). Example: ${models[0]}`);
}

async function checkStockfish(): Promise<void> {
  const mod = (await import('stockfish')) as { default?: () => any };
  const factory = typeof mod.default === 'function' ? mod.default : null;
  if (!factory) {
    throw new Error('Stockfish module not found or invalid.');
  }
  const engine = factory();
  await withTimeout(
    new Promise<void>((resolve) => {
      engine.onmessage = (msg: unknown) => {
        const raw = String(msg);
        if (/uciok/.test(raw)) {
          resolve();
        }
      };
      engine.postMessage('uci');
    }),
    'Stockfish uci handshake'
  );
  console.log('✓ Stockfish wasm loads and responds to UCI.');
}

function checkConfigs(): void {
  const required = [
    'paper/configs/debug/smoke_test.json',
    'paper/configs/paper/groq_llama8b_constrained.json'
  ];
  const missing: string[] = [];
  for (const rel of required) {
    const resolved = resolveConfigPath(rel);
    if (!resolved) {
      missing.push(rel);
    }
  }
  if (missing.length) {
    throw new Error(`Missing required config files: ${missing.join(', ')}`);
  }
  console.log('✓ Required configs present.');
}

function checkChessJs(): void {
  const chess = new Chess();
  if (chess.moves().length === 0) {
    throw new Error('Chess.js failed to generate legal moves from the starting position.');
  }
  console.log('✓ Chess.js operational.');
}

async function main() {
  try {
    console.log('Running preflight checks...');
    checkConfigs();
    checkChessJs();
    await checkOllama();
    await checkStockfish();
    console.log('All preflight checks passed.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Preflight failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
