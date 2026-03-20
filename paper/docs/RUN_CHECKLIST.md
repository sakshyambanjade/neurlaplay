# Paper Run Checklist

## Before running

- confirm the intended preset under `paper/configs/`
- confirm Groq / Ollama availability for the chosen models
- confirm the run manifest fields match the intended protocol
- confirm `retryCount = 1`
- confirm `fallbackPolicy = deterministic_first`
- confirm `temperature = 0`
- confirm the mode is `constrained_index` for the main paper run

## During running

- keep the server alive
- monitor `pipeline.log`
- verify `moves.jsonl` and `games.jsonl` are growing
- verify `paper-datapoints.live.jsonl` and `paper-games.live.jsonl` are growing
- verify `health.json` appears once at least one game has completed
- verify the current run appears under `Interrupted Runs` if the server is restarted

## After completion

- confirm `run_summary.json` exists
- confirm `stats.json` exists
- confirm `figures_data.json` exists
- confirm each matchup folder contains `paper-stats.json` and `paper-results.json`
- fill `paper/manuscript/RESULTS_FILL_TEMPLATE.md`
- update `paper/manuscript/PAPER_DRAFT.md` with final numeric results
