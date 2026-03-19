# ♟️ Research Chess Batch

**Run 50+ automated LLM vs LLM chess games. Export results for research papers.**

**NEW**: 🦙 Ollama local model support + 📊 Enhanced chess analytics!

---

## 🚀 Quick Start (5 minutes)

### Option A: Use Local Ollama Models (Recommended)

```powershell
# 1. Ensure Ollama is running
ollama serve

# 2. Install dependencies (per workspace)
cd client && npm install
cd ../server && npm install

# 3. Run quick test with your local models
cd server
npm run batch:ollama:quick
```

> Runs now fail fast if Ollama is unreachable or returns an illegal move -- no random fallbacks are used.

**See [research/docs/OLLAMA_GUIDE.md](research/docs/OLLAMA_GUIDE.md) for full Ollama integration guide!**

### Option B: Cloud models (not yet implemented)

Cloud providers listed previously are not wired up in code; all runs currently require a local Ollama model.

Open: **http://localhost:5173**

## Preflight & Smoke Test

```powershell
# Verify Ollama + Stockfish + configs
cd server
npm run check:preflight

# 2-game sanity batch (fast, fails on illegal moves/timeouts)
npm run research:sanity
```

---

## 📊 Usage

1. **Pick Models** → White & Black players (or use config files)
2. **Set Games** → Default 50
3. **Start Batch** → Watch live progress
4. **Export Results** → Table 3 LaTeX or CSV/PGN
5. **Analyze** → Enhanced chess metrics and visualizations

---

## 🆕 Enhanced Research Analytics

### Run Analysis
```bash
cd research
python analyze_research.py ../server/game-data/research-match-TIMESTAMP.json --paper
```

### New Metrics Included:
- **Game Phase Analysis**: Opening (1-10), Middlegame (11-40), Endgame (41+) performance
- **Accuracy Breakdown**: 6 quality categories from Excellent to Blunder
- **Critical Moments**: Automatic detection of game-deciding positions
- **Time Management**: Thinking time vs move quality correlation
- **Head-to-Head**: Direct model comparison with detailed stats

### Generate Visualizations
```bash
pip install matplotlib seaborn
python visualize_research.py ../server/game-data/research-match-TIMESTAMP_paper.json
```

Generates:
- Move quality distribution charts
- Game phase performance comparison
- CPL timeline throughout games
- Model-vs-model comparison graphs

---

## 📁 Project Structure

```
client/
└── src/pages/ResearchBatch.tsx      ← Single research page

server/
├── src/routes/research.ts           ← Batch endpoints
├── src/research/
│   └── SequentialGameRunner.ts      ← Game runner engine
└── src/game/MatchRoom.ts            ← Chess logic
```

---

## ✅ What's Included

- **🦙 Ollama Local Models** (Run models on your own hardware - FREE!)
- **6 Cloud LLM Providers** (Groq, OpenRouter, Google, Mistral, HuggingFace, Together)
- **Batch Runner** (50+ games, live socket updates)
- **Enhanced Analytics** (Chess-specific metrics, game phase analysis, visualizations)
- **Results Export** (LaTeX table, CSV, PGN files, paper-ready JSON)
- **No Database** (filesystem only)
- **Zero Cost Option** (use Ollama + free tier API keys)

---

## 🦙 Ollama Models Available

Your current Ollama installation:
- **qwen3-coder:30b** (18 GB) - Code-focused, strong reasoning
- **llama3.1:8b** (4.9 GB) - Latest Llama with improved capabilities
- **llama3:8b** (4.7 GB) - Original Llama 3
- **phi3:latest** (2.2 GB) - Microsoft's compact model
- **tinyllama:latest** (637 MB) - Smallest for testing

Plus cloud models: deepseek-v3.1:671b, gpt-oss:120b, qwen3-coder:480b

**Ready-to-use configs:**
- `research/configs/batch_config_ollama_quick_test.json` - 4 games (2 min)
- `research/configs/batch_config_ollama_tournament.json` - 18 games (full comparison)

---

## 📝 Table 3 Export

After running 50 games:
- **Export Table 3 (LaTeX)** → Ready for arXiv
- **Download All (CSVs/PGNs)** → Full game data

---

## 🛠️ Architecture

- **Frontend**: React + Vite + Tailwind
- **Backend**: Express + Socket.io
- **Games**: Chess.js (moves) + LLM (strategy)
- **No Matchmaking**, **No Ratings**, **No Auth** ← Keep it simple.

---

## 📌 Next Steps

1. Run first batch (10 games) to test
2. Run second batch (50 games) for paper
3. Export LaTeX → Include in paper
4. Done! 🎉

---

**⚠️ Batch is running in background.** Browser refresh is safe. Progress syncs via socket.io.
