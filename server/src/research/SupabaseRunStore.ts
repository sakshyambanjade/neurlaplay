import { Pool } from 'pg';
import type { MatchupConfig, PreflightReport, RunConfig, RunManifest, RunStatus } from './types/run.js';

type RunRecordExtras = {
  runDir?: string;
  acceptedConfig?: RunConfig;
  manifest?: RunManifest;
  preflight?: PreflightReport;
  artifacts?: { files: string[]; zipPath: string | null };
};

type MatchupRecordPayload = {
  runId: string;
  matchup: MatchupConfig;
  matchupDir: string;
  completedGames: number;
  status: string;
};

type IncompleteRunRow = {
  runId: string;
  startedAt: string;
  step: string;
  progress: number;
  total: number;
};

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getConnectionString(): string | null {
  const value = process.env.SUPABASE_DB_URL?.trim() ?? process.env.DATABASE_URL?.trim() ?? '';
  return value.length > 0 ? value : null;
}

function isConfigured(): boolean {
  return getConnectionString() !== null;
}

function getPool(): Pool | null {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  const db = getPool();
  if (!db) {
    return;
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`
        create table if not exists paper_runs (
          run_id text primary key,
          status text not null,
          step text not null,
          progress integer not null default 0,
          total integer not null default 0,
          done boolean not null default false,
          started_at timestamptz not null,
          finished_at timestamptz null,
          error text null,
          run_dir text null,
          accepted_config jsonb null,
          manifest jsonb null,
          preflight jsonb null,
          artifacts jsonb null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists paper_matchups (
          run_id text not null references paper_runs(run_id) on delete cascade,
          label text not null,
          white_model text not null,
          black_model text not null,
          games integer not null default 0,
          completed_games integer not null default 0,
          status text not null,
          matchup_dir text null,
          summary jsonb null,
          updated_at timestamptz not null default now(),
          primary key (run_id, label)
        );

        create index if not exists paper_runs_done_started_idx on paper_runs(done, started_at desc);
        create index if not exists paper_matchups_run_status_idx on paper_matchups(run_id, status);
      `);
    })();
  }
  await schemaReady;
}

function toJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export async function upsertRunRecord(status: RunStatus, extras: RunRecordExtras = {}): Promise<void> {
  const db = getPool();
  if (!db) {
    return;
  }
  await ensureSchema();
  await db.query(
    `
      insert into paper_runs (
        run_id, status, step, progress, total, done, started_at, finished_at, error,
        run_dir, accepted_config, manifest, preflight, artifacts, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9,
        $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, now()
      )
      on conflict (run_id) do update set
        status = excluded.status,
        step = excluded.step,
        progress = excluded.progress,
        total = excluded.total,
        done = excluded.done,
        started_at = excluded.started_at,
        finished_at = coalesce(excluded.finished_at, paper_runs.finished_at),
        error = coalesce(excluded.error, paper_runs.error),
        run_dir = coalesce(excluded.run_dir, paper_runs.run_dir),
        accepted_config = coalesce(excluded.accepted_config, paper_runs.accepted_config),
        manifest = coalesce(excluded.manifest, paper_runs.manifest),
        preflight = coalesce(excluded.preflight, paper_runs.preflight),
        artifacts = coalesce(excluded.artifacts, paper_runs.artifacts),
        updated_at = now()
    `,
    [
      status.runId,
      status.done ? (status.error ? 'failed' : 'completed') : 'running',
      status.step,
      status.progress,
      status.total,
      status.done,
      status.startedAt,
      status.finishedAt ?? null,
      status.error ?? null,
      extras.runDir ?? null,
      toJson(extras.acceptedConfig),
      toJson(extras.manifest),
      toJson(extras.preflight),
      toJson(extras.artifacts)
    ]
  );
}

export async function upsertMatchupRecord(payload: MatchupRecordPayload): Promise<void> {
  const db = getPool();
  if (!db) {
    return;
  }
  await ensureSchema();
  await db.query(
    `
      insert into paper_matchups (
        run_id, label, white_model, black_model, games, completed_games, status, matchup_dir, summary, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now()
      )
      on conflict (run_id, label) do update set
        completed_games = excluded.completed_games,
        status = excluded.status,
        matchup_dir = excluded.matchup_dir,
        summary = excluded.summary,
        updated_at = now()
    `,
    [
      payload.runId,
      payload.matchup.label,
      payload.matchup.white,
      payload.matchup.black,
      payload.matchup.games,
      payload.completedGames,
      payload.status,
      payload.matchupDir,
      JSON.stringify({
        white: payload.matchup.white,
        black: payload.matchup.black,
        games: payload.matchup.games,
        completedGames: payload.completedGames,
        status: payload.status
      })
    ]
  );
}

export async function listIncompleteRunsFromStore(): Promise<IncompleteRunRow[]> {
  const db = getPool();
  if (!db) {
    return [];
  }
  await ensureSchema();
  const result = await db.query<{
    run_id: string;
    started_at: Date | string;
    step: string;
    progress: number;
    total: number;
  }>(
    `
      select run_id, started_at, step, progress, total
      from paper_runs
      where done = false
      order by started_at desc
    `
  );

  return result.rows.map((row) => ({
    runId: row.run_id,
    startedAt:
      row.started_at instanceof Date ? row.started_at.toISOString() : new Date(row.started_at).toISOString(),
    step: row.step,
    progress: Number(row.progress ?? 0),
    total: Number(row.total ?? 0)
  }));
}

export async function getRunStatusFromStore(runId: string): Promise<RunStatus | null> {
  const db = getPool();
  if (!db) {
    return null;
  }
  await ensureSchema();
  const result = await db.query<{
    run_id: string;
    step: string;
    progress: number;
    total: number;
    done: boolean;
    error: string | null;
    started_at: Date | string;
    finished_at: Date | string | null;
  }>(
    `
      select run_id, step, progress, total, done, error, started_at, finished_at
      from paper_runs
      where run_id = $1
      limit 1
    `,
    [runId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    runId: row.run_id,
    step: row.step,
    progress: Number(row.progress ?? 0),
    total: Number(row.total ?? 0),
    done: Boolean(row.done),
    error: row.error ?? undefined,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : new Date(row.started_at).toISOString(),
    finishedAt:
      row.finished_at == null
        ? undefined
        : row.finished_at instanceof Date
          ? row.finished_at.toISOString()
          : new Date(row.finished_at).toISOString()
  };
}

export async function checkSupabaseStore(): Promise<{ ok: boolean; detail: string }> {
  const db = getPool();
  if (!db) {
    return { ok: true, detail: 'Supabase run store not configured' };
  }
  try {
    await ensureSchema();
    await db.query('select 1');
    return { ok: true, detail: 'Supabase run store reachable' };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

export function isSupabaseStoreConfigured(): boolean {
  return isConfigured();
}
