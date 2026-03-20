# Reproducibility

## Smoke test

```powershell
cd E:\neurlaplay\server
npm run research:smoke
```

## Pilot run

```powershell
cd E:\neurlaplay\server
npm run research:pilot
```

## Main constrained run

```powershell
cd E:\neurlaplay\server
npm run research:paper
```

## Resume an interrupted run

From the UI, use `Interrupted Runs -> Resume this run`.

From the API:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/paper/resume/<runId> -Method Post
```

## Notes

- Runs are written to `paper/runs/<runId>/`.
- The accepted config is saved before the first game.
- Every move is append-only logged in `moves.jsonl`.
- Every completed game is append-only logged in `games.jsonl`.
- Partial checkpoints are written to `paper-datapoints.live.jsonl` and `paper-games.live.jsonl`.
- The immutable manifest is written to both `manifest.json` and `run_manifest.json`.
