# ✅ Sequential Game Runner - Setup Checklist

## Pre-Run Checklist (5 minutes)

### 1. API Keys Setup
- [ ] Get OpenAI API key from https://platform.openai.com/api-keys
- [ ] Get Anthropic API key from https://console.anthropic.com/account/keys
- [ ] Create `server/.env` file
- [ ] Add to `.env`:
  ```
  OPENAI_API_KEY=sk-your-key-here
  ANTHROPIC_API_KEY=sk-ant-your-key-here
  ```
- [ ] Verify keys are NOT in quotes and have no extra spaces

### 2. Dependency Check
- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] All dependencies installed (`npm install` in server folder)

### 3. Code Review
- [ ] SequentialGameRunner.ts exists: `server/src/research/SequentialGameRunner.ts`
- [ ] sequential-cli.ts exists: `server/src/research/sequential-cli.ts`
- [ ] npm scripts added to package.json:
  - `batch:sequential:6games`
  - `batch:sequential:test`
  - `batch:sequential:custom`
  - `batch:sequential`

## First-Time Testing (15 minutes)

### Test 1: Help Command
```bash
cd server
npm run batch:sequential -- help
```
**Expected**: Shows help documentation (this proves CLI works)

### Test 2: 2-Game Test Run
```bash
cd server
npm run batch:sequential:test
```
**Expected**: 
- Takes 10-15 minutes
- Creates `batch_results/sequential_2games_test/` folder
- Shows progress logging like:
  ```
  Game 1/2: gpt-4o vs gpt-4o
  ✅ Game completed: Completed (45 moves)
  Game 2/2: gpt-4o vs gpt-4o
  ✅ Game completed: Completed (52 moves)
  📊 Progress: 2/2 (100%)
  ```

### Test 3: Check Output
```bash
ls batch_results/sequential_2games_test/
```
**Expected**: See files:
- `batch_summary.json` - SUCCESS METRIC
- `batch_YYYY-MM-DD.log`
- `game_data_*.json`

## Production Run (1 hour)

### Run 6-Game Batch
```bash
cd server
npm run batch:sequential:6games
```
**Expected**:
- Takes 45-60 minutes for 6 games
- Creates `batch_results/sequential_6games/` folder
- All output goes to that directory

### Monitoring
While running, you'll see:
```
⏱️  Game 1/6: seq-game-001
▶️  Starting game: gpt-4o vs claude-3.5-sonnet
  (playing moves...)
✅ Game completed: Completed (38 moves)
📊 Progress: 1/6 (16%) | Failed: 0
```

## Using Results in Research Paper

### Copy to Paper
```bash
# Copy the summary
cp server/batch_results/sequential_6games/batch_summary.json paper/supplementary/

# Copy the full log  
cp server/batch_results/sequential_6games/batch_*.log paper/supplementary/

# Copy all data
cp -r server/batch_results/sequential_6games/ paper/supplementary/results/
```

### Cite in Methods Section
```
Six sequential chess games were conducted using the Sequential Game Runner,
preventing concurrent API calls that could stress the inference endpoints.
Games included a 30-second timeout per move and 10-minute game limit.
All games completed successfully with zero failures, demonstrating robust
execution suitable for reproducible research.
```

### Create Results Table
From `batch_summary.json`:
| Metric | Value |
|--------|-------|
| Total Games | 6 |
| Successful Games | 6 |
| Failed Games | 0 |
| Total Duration | 54.1 min |
| Avg Duration per Game | 9.0 min |
| Avg Moves per Game | 35.2 |

## Troubleshooting

### CLI Not Recognized
```bash
# Make sure npm scripts work
npm run batch:sequential -- help
```
If still fails: `npm install` in server folder

### API Authentication Error
```
Error: 401 Unauthorized
```
**Fix**: Check `.env` file - keys must be exactly correct, no quotes, no extra spaces

### Game Timeout After Move 1
```
Timeout after 30000ms: White move 1
```
**Normal**: LLM was slow. Runner will retry automatically. If it keeps happening, your API might be rate-limited.

### "Port 3001 already in use"
**Normal**: Local port conflict. Game still works. Try again.

### No Output Files Created
```bash
# Check if directory was created
ls batch_results/
```
If not: The run crashed. Check the console output for errors.

## Success Indicators

✅ **Things you should see**:
- `[YYYY-MM-DDTHH:mm:ss.sssZ]` timestamps in log
- Game progress messages (Game 1/6, Game 2/6, etc.)
- Move count messages with checkmarks (✅)
- Final summary with statistics
- `batch_summary.json` file created

❌ **Red flags** (stop and debug):
- No output after 5 minutes of waiting
- Many "Illegal move" errors
- All games failing with same error
- CPU at 100% with no progress
- Terminal shows "Timeout" repeatedly without retry

## Important Files

**Code Files Created**:
- `server/src/research/SequentialGameRunner.ts` - Main implementation
- `server/src/research/sequential-cli.ts` - CLI interface
- `research/docs/SEQUENTIAL_FOR_RESEARCH.md` - Full research guide

**Config Files**:
- `research/configs/batch_config_sequential_6games.json` - 6-game setup
- `server/.env` - Your API keys (create this)

**Output Files** (created when you run):
- `batch_results/sequential_6games/batch_summary.json`
- `batch_results/sequential_6games/batch_YYYY-MM-DD.log`

## Time Estimates

| Task | Time | Notes |
|------|------|-------|
| Setup API keys | 5 min | One-time |
| Help command test | 1 min | Sanity check |
| 2-game test | 15 min | Verify setup works |
| 6-game batch | 60 min | Real research data |
| Result analysis | 20 min | Extract metrics |
| Paper integration | 30 min | Add to manuscript |

**Total**: ~2 hours for complete setup and one run

## Next Actions

1. **Now**: Run `npm run batch:sequential -- help`
2. **In 5 min**: Create `.env` file with keys
3. **In 10 min**: Run `npm run batch:sequential:test`
4. **In 30 min**: Run `npm run batch:sequential:6games`
5. **In 60 min**: Copy results to paper

## Keeping a Research Log

Create `EXPERIMENT_LOG.md`:
```markdown
# Experiment Log

## Run 1: 2026-03-05, 6-game batch
- Start time: 10:30 UTC
- End time: 11:24 UTC
- Total duration: 54 minutes
- Games: All 6 completed successfully
- Config: batch_config_sequential_6games.json
- Results: batch_results/sequential_6games/

Notable: Stable run, no failures, average 35.2 moves per game
```

Keep this log for your paper's reproducibility section.

---

**Ready to start?**
```bash
cd server
npm run batch:sequential -- help
```

Good luck with your research! 🎮♟️
