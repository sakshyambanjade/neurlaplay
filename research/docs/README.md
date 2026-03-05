# 📚 NeuroChess Research Documentation

> **Clean, focused guides for running research experiments with the Sequential Game Runner**

## Getting Started

### 1. **First Time? Start Here**
→ Read **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** (5-minute setup)
- Create `.env` with API keys
- Run first test (2 games)
- Verify everything works

### 2. **Ready to Run Your Research?**
→ Read **[SEQUENTIAL_FOR_RESEARCH.md](SEQUENTIAL_FOR_RESEARCH.md)** (complete guide)
- How to run 6-game batch
- How to configure experiments
- How to use output in your paper
- How to cite results

## Quick Commands

```bash
# Setup (one time)
cd server
# Create .env with OPENAI_API_KEY and ANTHROPIC_API_KEY

# Test (15 minutes)
npm run batch:sequential:test

# Run research batch (60 minutes)
npm run batch:sequential:6games

# Get help
npm run batch:sequential -- help
```

## Output Files

After running, you'll get:
- `batch_summary.json` - Main results (include in paper)
- `batch_YYYY-MM-DD.log` - Timestamped log (for reproducibility)
- `dataset.json` - Complete game data (for analysis)

## For Your Paper

**Methods Section:**
Include SEQUENTIAL_FOR_RESEARCH.md's citation example

**Results Section:**
Use the table from batch_summary.json

**Supplementary Materials:**
Archive batch_results/ folder

## That's It!

Two docs, zero confusion. Start with SETUP_CHECKLIST.md and you're good.

Questions? Everything is documented in those two files. 🎮♟️
