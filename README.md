# Deterministic Chess Decision Benchmark

This project evaluates language models as constrained decision systems in chess. The benchmark is designed to separate action hallucination from downstream decision failure.

## Core protocol

- `chess.js` is the source of truth for legal moves.
- Models do not generate arbitrary moves in paper mode.
- Each turn is presented as an indexed legal-move list.
- The model must return exactly one integer index.
- Invalid output is rejected, retried once, then replaced with a deterministic fallback.
- Every move and every game is append-only logged.

## Repo layout

```text
client/                     React dashboard
server/                     Express + Socket.IO + research pipeline
paper/configs/              Canonical experiment presets
paper/docs/                 Methods and reproducibility notes
paper/scripts/              Figure/table/artifact helpers
paper/runs/                 Immutable run outputs
research_legacy/            Legacy assets retained during migration
```

## Quick start

```powershell
cd E:\neurlaplay\server
npm install

cd ..\client
npm install

cd ..\server
npm run dev
```

Frontend: [http://localhost:5173](http://localhost:5173)  
Backend: [http://localhost:3001](http://localhost:3001)

## Run the benchmark

Smoke test:

```powershell
cd E:\neurlaplay\server
npm run research:smoke
```

Pilot run:

```powershell
cd E:\neurlaplay\server
npm run research:pilot
```

Main constrained run:

```powershell
cd E:\neurlaplay\server
npm run research:paper
```

From the UI:

- open the Paper page,
- press the main experiment button,
- if the server restarts or the run pauses, press it again to resume the latest interrupted run.

## Output artifacts

Each run writes a self-contained directory under `paper/runs/<runId>/` with:

- `accepted-config.json`
- `manifest.json`
- `run_manifest.json`
- `status.json`
- `pipeline.log`
- `health.json` per matchup
- `run_summary.json`
- `stats.json`
- `figures_data.json`
- per-matchup `moves.jsonl`
- per-matchup `games.jsonl`
- per-matchup `paper-results.json`
- per-matchup `paper-stats.json`
- `artifacts_manifest.json`

Interrupted runs are resumable because the pipeline checkpoints:

- `paper-datapoints.live.jsonl`
- `paper-games.live.jsonl`

## Research claim

Even when action hallucination is removed through constrained index selection, language models still exhibit systematic decision failures that scale with complexity and pressure.
