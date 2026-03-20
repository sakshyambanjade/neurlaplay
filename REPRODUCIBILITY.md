# Reproducibility

## Environment

- Node.js 20+
- Python 3.10+ if you want to run the helper scripts in `paper/scripts/`
- Groq API key for Groq-backed runs
- Ollama only for legacy/local debug endpoints outside the canonical paper pipeline

## Install

```powershell
cd E:\neurlaplay\server
npm install

cd ..\client
npm install
```

## Canonical configs

- `paper/configs/debug/smoke_10_games.json`
- `paper/configs/pilot/pilot_300_games.json`
- `paper/configs/main/main_1200_games.json`
- `paper/configs/ablations/free_vs_constrained.json`
- `paper/configs/ablations/fallback_policy_compare.json`

## Run from CLI

```powershell
cd E:\neurlaplay\server
npm run research:paper
```

## Run from the UI

1. Start the backend with `npm run dev` from `server/`.
2. Start the frontend with `npm run dev` from `client/`.
3. Open the Paper page and press the main experiment button.
4. The accepted config returned by the server is the source of truth.

## Resume an interrupted run

From the UI, use `Interrupted Runs -> Resume this run`.

From the API:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/paper/resume/<runId> -Method Post
```

## What makes a run reproducible

- The exact accepted config is saved to `accepted-config.json`.
- The immutable manifest is saved to both `manifest.json` and `run_manifest.json`.
- The accepted config hash is stored in both the manifest and run summary.
- Every move is append-only logged in `moves.jsonl`.
- Every completed game is append-only logged in `games.jsonl`.
- Partial checkpoint files are written as `paper-datapoints.live.jsonl` and `paper-games.live.jsonl`.
- Resume continues from the next unfinished game, not from the beginning.
- The final artifact index is saved to `artifacts_manifest.json`.

## After the run

Each run lives in `paper/runs/<runId>/`. Use `paper/scripts/build_figures.py` and `paper/scripts/build_tables.py` against that run directory if you want regenerated figure/table files.
