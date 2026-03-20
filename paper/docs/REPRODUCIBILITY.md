# Reproducibility

## Smoke test

```powershell
cd E:\neurlaplay\server
npx tsx src/research/paper-cli.ts --config ..\paper\configs\debug\smoke_test.json
```

## Main constrained run

```powershell
cd E:\neurlaplay\server
npx tsx src/research/paper-cli.ts --config ..\paper\configs\paper\groq_llama8b_constrained.json
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
- The immutable manifest is written to `run_manifest.json`.
