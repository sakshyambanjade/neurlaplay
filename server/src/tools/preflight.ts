import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';
import { resolveStockfishEnginePath } from '../research/StockfishAnalyzer.js';

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

async function checkStockfish(): Promise<void> {
  const enginePath = resolveStockfishEnginePath();
  if (!enginePath) {
    throw new Error('Stockfish engine script not found.');
  }
  console.log(`Stockfish engine script found: ${enginePath}`);
}

function checkConfigs(): void {
  const required = [
    'paper/configs/debug/smoke_10_games.json',
    'paper/configs/pilot/pilot_300_games.json',
    'paper/configs/main/main_1200_games.json'
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
  console.log('Required configs present.');
}

function checkChessJs(): void {
  const chess = new Chess();
  if (chess.moves().length === 0) {
    throw new Error('Chess.js failed to generate legal moves from the starting position.');
  }
  console.log('Chess.js operational.');
}

async function main() {
  try {
    console.log('Running preflight checks...');
    checkConfigs();
    checkChessJs();
    console.log('Skipping Ollama preflight for canonical Groq paper configs.');
    await checkStockfish();
    console.log('All preflight checks passed.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Preflight failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
