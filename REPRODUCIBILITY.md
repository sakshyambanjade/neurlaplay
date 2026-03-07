# Reproducing the Benchmark

## Requirements
- Node.js 20+
- Python 3.10+
- Ollama running locally with required models pulled
- Stockfish 17.1 lite via npm package (`server/node_modules/stockfish`)

## Environment Setup
```bash
cd server
npm install

cd ../client
npm install

cd ..
pip install -r requirements.txt
```

## Run the Benchmark
```bash
# 1) Prepare config (copy and edit)
copy research\configs\batch_config_ollama_quick_test.json research\configs\my_run.json
# Edit settings.stockfishEvalDepth, settings.blunderThresholdCp, model pairings, and games

# 2) Start backend (from repo root)
cd server
npm run dev

# 3) Launch a paper run (new terminal)
cd server
npm run research:paper -- --games=5
```

## Verify Artifacts
After the run, confirm:
- `research/runs/<run-id>/run_manifest.json` contains your exact config
- `research/paper-stats.json` -> `eval_settings.depth` matches your config
- `research/paper-stats.json` -> `eval_settings.blunder_threshold_cp` matches your config
- `research/paper-stats.json` -> `eval_settings.statistics.ci_method` is `"wilson"`

## Re-run Exact Experiment
To reproduce a previous run exactly:
- Use the prior `run_manifest.json` values for matchup matrix and settings.
- Re-run with the same model tags, `stockfishEvalDepth`, and `blunderThresholdCp`.
- Keep `package-lock.json`, `requirements.txt`, and runtime versions pinned.
