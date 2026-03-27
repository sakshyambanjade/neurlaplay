# NeuraPlay

NeuraPlay is a deterministic chess decision benchmark for language models. It evaluates how models perform when move legality is removed as a source of error: the engine supplies the legal move set, the model returns an index, and the pipeline records what happens next.

The current codebase ships:

- a React/Vite dashboard in `client/`
- an Express + Socket.IO backend in `server/`
- a resumable paper pipeline in `server/src/research/`
- canonical experiment configs and run artifacts in `paper/`

## What the benchmark enforces

- `chess.js` is the legal-move source of truth.
- Canonical paper runs use constrained index selection.
- Model output is validated and retried once on invalid responses.
- Fallback handling is deterministic and logged.
- Every move, game, status update, and artifact is written to disk.
- Interrupted runs can be resumed instead of restarted.

## Repository layout

```text
client/                     React dashboard for paper runs
server/                     Express API, Socket.IO bridge, research pipeline
paper/configs/              Locked run presets for smoke, pilot, main, ablations
paper/docs/                 Method and research notes
paper/logs/                 Generated logs
paper/runs/                 Run outputs and downloadable artifacts
paper/scripts/              Reproducibility helpers
REPRODUCIBILITY.md          Reproduction notes and artifact expectations
start-local.ps1             Starts backend and frontend in separate shells
start-server-local.ps1      Builds and starts backend only
```

## Requirements

- Node.js 20+
- npm
- Stockfish available to the backend
- `GROQ_API_KEY` for the canonical paper configs
- Ollama only if you want the local debug endpoints under `/api/research`

Optional integrations:

- Supabase for persisting run state across restarts
- Resend for completion/error email notifications

## Environment

Create `server/.env` from `server/.env.example` and set the values you need:

```powershell
Copy-Item server\.env.example server\.env
```

Common variables:

- `PORT=3001`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `GROQ_API_KEY=...`
- `PAPER_WORKSPACE_ROOT=` optional alternate workspace root
- `PAPER_DATA_ROOT=` optional alternate artifact root
- `SUPABASE_DB_URL=` optional run-store persistence
- `SUPABASE_PUBLISHABLE_KEY=` optional run-store persistence
- `RESEND_API_KEY=` and `RUN_NOTIFY_*` optional notifications

For the frontend, `client` uses:

- `http://localhost:3001` in local Vite dev mode
- `https://neurlaplay.fly.dev` in production unless `VITE_API_BASE_URL` is set

## Install

```powershell
cd E:\neurlaplay\server
npm install

cd ..\client
npm install
```

## Preflight

Run the backend preflight before long experiments:

```powershell
cd E:\neurlaplay\server
npm run check:preflight
```

The preflight currently checks:

- required paper configs exist
- `chess.js` is operational
- the Stockfish engine path resolves

## Local development

Start the backend:

```powershell
cd E:\neurlaplay\server
npm run dev
```

Start the frontend in a second shell:

```powershell
cd E:\neurlaplay\client
npm run dev
```

Or use the helper launcher from the repo root:

```powershell
.\start-local.ps1
```

Local URLs:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend health: [http://localhost:3001/health](http://localhost:3001/health)

## Production-style local run

If you want the backend to serve the built frontend:

```powershell
cd E:\neurlaplay\client
npm run build

cd ..\server
npm run build
npm run start:built
```

`server/src/index.ts` will serve `client/dist` when it exists.

## Paper runs

From `server/`:

```powershell
npm run research:smoke
npm run research:pilot
npm run research:paper
npm run research:extended
```

Available presets:

- `research:smoke`: debug run using `paper/configs/debug/smoke_10_games.json`
- `research:pilot`: pilot run using `paper/configs/pilot/pilot_300_games.json`
- `research:paper`: canonical 300-game main preset
- `research:extended`: canonical 1200-game main preset

Audit helpers:

```powershell
npm run research:audit
npm run research:audit:latest
```

## UI workflow

The dashboard is currently a dedicated paper-run interface, not a general multi-page app. It provides:

- main and pilot run launch controls
- interrupted-run discovery and resume
- live board state
- step/progress tracking
- live quality and health metrics
- artifact download links after completion

If an unfinished run exists, the backend blocks new locked runs and requires resuming the latest run first.

## API surface

Key endpoints exposed by the backend:

- `GET /health`
- `POST /api/paper/run/main`
- `POST /api/paper/run/pilot`
- `GET /api/paper/incomplete`
- `GET /api/paper/status/:runId`
- `GET /api/paper/live/:runId`
- `POST /api/paper/resume/:runId`
- `GET /api/paper/artifacts/:runId`
- `GET /api/research/backend-health`
- `POST /api/research/position`
- `POST /api/research/smoke`

Socket.IO events drive the live UI for status, logs, ETA, health, and per-game updates.

## Artifacts and resume behavior

Each run writes a self-contained directory under `paper/runs/<runId>/`, including:

- `accepted-config.json`
- `manifest.json`
- `run_manifest.json`
- `status.json`
- `pipeline.log`
- `run_summary.json`
- `stats.json`
- `figures_data.json`
- per-matchup `moves.jsonl`
- per-matchup `games.jsonl`
- per-matchup `paper-results.json`
- per-matchup `paper-stats.json`
- `artifacts_manifest.json`
- `artifacts.zip`

Resume relies on live checkpoints such as:

- `paper-datapoints.live.jsonl`
- `paper-games.live.jsonl`

## Model backends

Canonical paper presets are Groq-backed today. The codebase also contains Ollama integration for local research/debug flows, including the position endpoint and model backend adapters under `server/src/research/model_backends/`.

## Reproducibility

See [REPRODUCIBILITY.md](./REPRODUCIBILITY.md) for the reproducibility checklist, canonical configs, and run-restoration details.
