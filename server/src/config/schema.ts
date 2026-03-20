import type { BatchConfig } from '../research/types.js';
import type { RunConfig } from '../research/types/run.js';
import type { MatchupConfig } from '../research/types/run.js';

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Config must be an object.');
  }
  return input as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback?: string
): string {
  const value = record[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required string field: ${key}`);
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  fallback?: number,
  min?: number
): number {
  const raw = record[key];
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number(raw)
        : fallback;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid numeric field: ${key}`);
  }
  if (typeof min === 'number' && value < min) {
    throw new Error(`Field ${key} must be >= ${min}`);
  }
  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const raw = record[key];
  if (typeof raw === 'boolean') {
    return raw;
  }
  return fallback;
}

function validateMatchups(input: unknown): MatchupConfig[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Config must include at least one matchup.');
  }

  return input.map((entry, index) => {
    const record = asRecord(entry);
    const white = readString(record, 'white');
    const black = readString(record, 'black');
    const games = Math.floor(readNumber(record, 'games', undefined, 1));
    const label =
      typeof record.label === 'string' && record.label.trim().length > 0
        ? record.label.trim()
        : `${white}_vs_${black}`.replace(/[^a-zA-Z0-9._-]+/g, '_');

    if (white.length === 0 || black.length === 0) {
      throw new Error(`Matchup ${index + 1} must include white and black models.`);
    }

    return { white, black, games, label };
  });
}

export function validateRunConfig(input: unknown): RunConfig {
  const record = asRecord(input);
  const settingsRecord = asRecord(record.settings ?? {});
  const loggingRecord = asRecord(record.logging ?? {});

  const paperAngle = readString(record, 'paperAngle', 'option_b_capability');
  if (paperAngle !== 'option_a_tension' && paperAngle !== 'option_b_capability') {
    throw new Error(`Unsupported paperAngle: ${paperAngle}`);
  }

  const mode = readString(record, 'mode', 'constrained_index');
  if (!['free_generation', 'constrained_index', 'move_scoring'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const contextPolicy = readString(record, 'contextPolicy', 'full_pgn_history');
  if (!['full_pgn_history', 'last_10_moves', 'fen_only'].includes(contextPolicy)) {
    throw new Error(`Unsupported contextPolicy: ${contextPolicy}`);
  }

  return {
    paperAngle,
    mode: mode as RunConfig['mode'],
    matchups: validateMatchups(record.matchups),
    seed: Math.floor(readNumber(record, 'seed', 42, 0)),
    temperature: readNumber(record, 'temperature', 0, 0),
    topP: readNumber(record, 'topP', 1, 0),
    maxTokens: Math.floor(readNumber(record, 'maxTokens', 8, 1)),
    contextPolicy: contextPolicy as RunConfig['contextPolicy'],
    stockfishEvalDepth: Math.floor(readNumber(record, 'stockfishEvalDepth', 8, 1)),
    blunderThresholdCp: Math.floor(readNumber(record, 'blunderThresholdCp', 200, 1)),
    settings: {
      maxMoves: Math.floor(readNumber(settingsRecord, 'maxMoves', 200, 1)),
      moveTimeoutMs: Math.floor(readNumber(settingsRecord, 'moveTimeoutMs', 10000, 1)),
      gameTimeoutMs: Math.floor(readNumber(settingsRecord, 'gameTimeoutMs', 3600000, 1)),
      moveDelayMs: Math.floor(readNumber(settingsRecord, 'moveDelayMs', 100, 0)),
      interGameDelayMs: Math.floor(readNumber(settingsRecord, 'interGameDelayMs', 100, 0)),
      exportInterval: Math.floor(readNumber(settingsRecord, 'exportInterval', 1, 1)),
      seed: Math.floor(readNumber(settingsRecord, 'seed', readNumber(record, 'seed', 42, 0), 0)),
      openingRandomMoves: Math.floor(readNumber(settingsRecord, 'openingRandomMoves', 4, 0)),
      retryCount: Math.floor(readNumber(settingsRecord, 'retryCount', 1, 0)),
      fallbackPolicy: readString(settingsRecord, 'fallbackPolicy', 'deterministic_first') as RunConfig['settings']['fallbackPolicy']
    },
    logging: {
      logEveryMove: readBoolean(loggingRecord, 'logEveryMove', true),
      schemaVersion: readString(loggingRecord, 'schemaVersion', 'paper-run-v2')
    }
  };
}

export function runConfigToBatchConfig(
  config: RunConfig,
  matchup: MatchupConfig,
  outputDir: string
): BatchConfig {
  return {
    mode: config.mode,
    games: matchup.games,
    outputDir,
    models: {
      white: matchup.white,
      black: matchup.black
    },
    settings: {
      maxMoves: config.settings.maxMoves,
      moveTimeoutMs: config.settings.moveTimeoutMs,
      gameTimeoutMs: config.settings.gameTimeoutMs,
      moveDelayMs: config.settings.moveDelayMs,
      interGameDelayMs: config.settings.interGameDelayMs,
      exportInterval: config.settings.exportInterval,
      stockfishEvalDepth: config.stockfishEvalDepth,
      blunderThresholdCp: config.blunderThresholdCp,
      seed: config.settings.seed,
      openingRandomMoves: config.settings.openingRandomMoves,
      retryCount: config.settings.retryCount,
      fallbackPolicy: config.settings.fallbackPolicy
    }
  };
}
