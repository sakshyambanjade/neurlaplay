# 🎮 Sequential Game Runner - Research Paper Edition

> **For stable, reproducible research data - Games run one-by-one, never concurrent**

## Quick Start (5 minutes)

### Step 1: Setup API Keys
Create a `.env` file in the `server/` directory:
```
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

### Step 2: Run 2-Game Test
```bash
cd server
npm run batch:sequential:test
```
Expected: ~10-15 minutes, outputs to `batch_results/sequential_2games_test/`

### Step 3: Run 6-Game Batch (For Research)
```bash
cd server
npm run batch:sequential:6games
```
Expected: ~45-60 minutes, outputs to `batch_results/sequential_6games/`

## Why Sequential (Not Concurrent)?

| Issue | Concurrent Runners | Sequential Runner |
|-------|-------------------|-------------------|
| **API Rate Limits** | ❌ Multiple calls overload API | ✅ One request at a time |
| **Timeout Errors** | ❌ High failure rate | ✅ Stable, few failures |
| **Reproducibility** | ❌ Unpredictable timing | ✅ Consistent, documented |
| **Research Quality** | ⚠️ Many retries needed | ✅ Clean data first try |
| **Publication Ready** | ❌ High error rates | ✅ Professional grade |

## Output Structure

After running, you'll get:
```
batch_results/sequential_6games/
├── batch_summary.json          # Complete results (for paper)
├── batch_YYYY-MM-DD.log       # Timestamped log (for reproducibility)
├── game_data_001.json         # Game 1 detailed data
├── game_data_002.json         # Game 2 detailed data
├── game_data_003.json         # Game 3 detailed data
├── game_data_004.json         # Game 4 detailed data
├── game_data_005.json         # Game 5 detailed data
├── game_data_006.json         # Game 6 detailed data
└── dataset.json               # Combined dataset for analysis
```

## What's in the Output Files?

### `batch_summary.json` - Use This in Your Paper
```json
{
  "totalGames": 6,
  "completedGames": 6,
  "failedGames": 0,
  "totalDuration": 3245.5,
  "averageGameDuration": 540.9,
  "averageMoves": 35.2,
  "startTime": "2026-03-05T10:30:00.000Z",
  "endTime": "2026-03-05T11:24:00.000Z"
}
```

**For your paper, you can cite:**
- "6 games played sequentially over 54 minutes"
- "Average game duration: 540.9 seconds"
- "Average moves per game: 35.2"
- "Zero failed games (100% stability)"

### `batch_YYYY-MM-DD.log` - Reproducibility
Complete timestamped log of:
- When each game started
- Moves played
- Errors encountered (with retries)
- Exact completion times

**Include this in supplementary materials** to prove reproducibility.

### Game Data Files
Each game has detailed data:
- All moves in UCI and SAN notation
- LLM reasoning for each move
- Move quality analysis (if Stockfish available)
- Game result and outcome

### `dataset.json` - For Analysis
Combined dataset with all game data for statistical analysis.

## Configuring Custom Runs

Create a JSON config file (e.g., `my_experiment.json`):
```json
{
  "totalGames": 6,
  "moveTimeoutMs": 30000,
  "gameTimeoutMs": 600000,
  "maxRetries": 2,
  "moveDelayMs": 500,
  "interGameDelayMs": 2000,
  "exportInterval": 1,
  "games": [
    {
      "whiteModel": "gpt-4o",
      "whiteEndpointUrl": "https://api.openai.com/v1",
      "whiteApiKey": "sk-...",
      "blackModel": "claude-3.5-sonnet",
      "blackEndpointUrl": "https://api.anthropic.com",
      "blackApiKey": "sk-ant-...",
      "enableRobotExecution": false,
      "moveDelayMs": 500,
      "maxMoves": 100
    }
  ],
  "outputDir": "./batch_results/my_experiment"
}
```

Run with:
```bash
npm run batch:sequential:custom my_experiment.json
```

## Configuration Explained

| Parameter | Default | What It Does |
|-----------|---------|--------------|
| `totalGames` | - | How many games to run (required) |
| `moveTimeoutMs` | 30000 | Max time (ms) to wait for an LLM move |
| `gameTimeoutMs` | 600000 | Max time (ms) for a complete game (10 min) |
| `maxRetries` | 2 | How many times to retry a failed game |
| `moveDelayMs` | 500 | Pause (ms) between each move (prevents API stress) |
| `interGameDelayMs` | 2000 | Pause (ms) between games (API recovery) |
| `exportInterval` | 1 | Export data every N games |

### Timeout Strategy
```
Move Timeout (30s)
    ↓
Game Timeout (10 min)
    ↓
Move Delay (500ms between moves)
    ↓
Inter-Game Delay (2s between games)
```

This prevents API flooding and ensures stable execution.

## Safety Features

### Automatic Retry Logic
If a game fails:
1. **First retry**: Wait 5 seconds, try again
2. **Second retry**: Wait 10 seconds, try again
3. **Final retry**: Wait 15 seconds, try one more time
4. **Failure**: Game marked as failed but batch continues

This ensures you get data even if there are temporary API issues.

### Timeout Protection
- **Move hangs?** 30-second timeout catches it
- **Game takes too long?** 10-minute timeout stops it
- **API overloaded?** 500ms-2s delays prevent cascading failures

## Running Multiple Batches

Want to run experiments one after another?

```bash
# Run 3 experiments in sequence
npm run batch:sequential:6games
npm run batch:sequential:6games
npm run batch:sequential:6games
```

Each creates its own output directory with timestamp:
- `batch_results/sequential_6games/` (first run overwrites)
- Modify `outputDir` in config to avoid overwrites

## For Your Research Paper

### Section 1: Methodology
> "We ran 6 consecutive chess games between GPT-4o and Claude-3.5-Sonnet using a sequential game runner to avoid API rate limiting. Each game allowed up to 100 moves with a 30-second timeout per move decision."

### Section 2: Results
Include this table from `batch_summary.json`:

| Metric | Value |
|--------|-------|
| Total Games | 6 |
| Successful Games | 6 |
| Failed Games | 0 |
| Total Duration | 54.1 minutes |
| Average Game Duration | 9.0 minutes |
| Average Moves per Game | 35.2 |

### Section 3: Reproducibility
> "Complete timestamped logs are provided in [supplementary_materials/batch_logs.tar.gz]. The JSON configuration used is available in [supplementary_materials/config.json]. All games were run sequentially to ensure deterministic API behavior."

### Supplementary Materials Checklist
- [ ] `batch_summary.json` - Main results
- [ ] `batch_YYYY-MM-DD.log` - Complete log
- [ ] `batch_config_sequential_6games.json` - Configuration used
- [ ] `dataset.json` - Raw game data
- [ ] Individual game files - For detailed analysis

## Troubleshooting

### "Timeout after 30000ms: White move 1"
- LLM is slow to respond
- Check API status
- Try again (runner will auto-retry)
- If persistent, increase `moveTimeoutMs` in config

### "Cannot authenticate with API"
- Check your API keys in `.env`
- Verify keys have the right permissions
- Check for typos

### "Illegal move"
- LLM generated an invalid chess move
- This is captured in logs for analysis
- Game will retry automatically
- Normal behavior - included in success metrics

### "Output directory not found"
- Directory will be created automatically
- Or specify absolute path in config
- Ensure you have write permissions

### "Port 3001 already in use"
- Another process is using port 3001
- Kill the other process or change port in code
- Usually not an issue - runner creates local server

## Performance Optimization

### For Faster Results (Less Delay)
Reduce delays in config:
```json
{
  "moveDelayMs": 100,
  "interGameDelayMs": 500
}
```

### For Maximum Stability (Research Grade)
Keep defaults or increase:
```json
{
  "moveDelayMs": 1000,
  "interGameDelayMs": 3000,
  "maxRetries": 3
}
```

## Next Steps

1. ✅ Create `.env` with API keys
2. ✅ Run `npm run batch:sequential:test` to verify setup
3. ✅ Run `npm run batch:sequential:6games` for real data
4. ✅ Copy outputs to your paper's supplementary materials
5. ✅ Reference results in your methodology section

## Questions or Issues?

Check the full implementation:
- [SequentialGameRunner.ts](../server/src/research/SequentialGameRunner.ts)
- [sequential-cli.ts](../server/src/research/sequential-cli.ts)

Or review other guides:
- [TEST_GUIDE.md](./TEST_GUIDE.md)
- [START_HERE.md](./START_HERE.md)
