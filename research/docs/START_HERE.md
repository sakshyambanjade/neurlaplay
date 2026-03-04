# 🧠 NeuroChess Research - Start Here

Welcome! Choose what you want to do and follow the guide.

**Time to first result: 5 minutes**  
**Time to publication-ready data: 45 minutes**

## ⭐ RECOMMENDED: One-Click Game Launcher (NO CLI REQUIRED!)

**New!** Start tournaments using a beautiful web UI - no terminal needed!

### How It Works:
1. 🌐 Open browser: `http://localhost:5173/launcher`
2. 🔘 Click one button
3. 👁️ Watch live progress (6 models playing live)
4. 📥 Download results (45 minutes later)
5. 📄 Paste LaTeX into your paper

**That's it!** Beautiful dark-themed interface, real-time updates, no CLI needed.

**Read:** [ONE_CLICK_INTEGRATION.md](https://github.com/yourusername/llmarena/blob/main/ONE_CLICK_INTEGRATION.md) (5 min quick setup)

**Full guide:** [ONE_CLICK_STARTER_GUIDE.md](https://github.com/yourusername/llmarena/blob/main/ONE_CLICK_STARTER_GUIDE.md) (deep dive)

**System docs:** [ONE_CLICK_SYSTEM_COMPLETE.md](https://github.com/yourusername/llmarena/blob/main/ONE_CLICK_SYSTEM_COMPLETE.md) (reference)

---

## What Do You Want to Do?

### 🌟 New: 6-Model Concurrent Experiment (HIGHEST IMPACT)

**Goal:** Compare 6 free LLM providers in parallel. Generate Table 3 for your arXiv paper.

**Models:** Groq (Llama3.1) vs OpenRouter (DeepSeek) vs Google (Gemini2) vs Mistral vs HuggingFace (Qwen) vs Together (Llama3.2)

**Time:** 45 minutes, get 50 games across 6 models

**Cost:** $0 (all free providers)

**Read:** [CONCURRENT_EXPERIMENT_SETUP.md](CONCURRENT_EXPERIMENT_SETUP.md) (10 min)

**Then run:**
```bash
# Get free keys from: groq.com, openrouter.ai, google.com, mistral.ai, huggingface.co, together.ai
# Add to server/.env

npm run experiment:concurrent
```

**Result:** 50 games, 3 concurrent matches, Table 3 data (6-model comparison) for your paper ✨

---

### 🏆 NEW: Round-Robin Tournament (FAIREST RANKING)

**Goal:** Each of 6 models plays EVERY other model once (A vs B, A vs C, etc.). Perfect round-robin format, no favoritism.

**What You Get:** 
- 15 unique pairings × 2 games each (white/black) = 30 total games
- Complete ranking table (Model 1, Model 2, Model 3, etc.)
- Head-to-head records between all models
- Publication-ready LaTeX table

**Models:** Same 6 as concurrent experiment (Groq, OpenRouter, Google, Mistral, HuggingFace, Together)

**Time:** 45-60 minutes for complete tournament

**Cost:** $0 (all free providers)

**Advantage Over Concurrent:**
- ✅ Each model plays each other (not just predetermined pairings)
- ✅ No model left out
- ✅ Fair tournament structure
- ✅ Perfect for paper: "We conducted a fair round-robin tournament"

**Read:** [ROUND_ROBIN_TOURNAMENT_GUIDE.md](ROUND_ROBIN_TOURNAMENT_GUIDE.md) (15 min)

**Then run:**
```bash
# Get free keys first
# Add to server/.env

npm run tournament:roundrobin
```

**Result:** 30 games, complete rankings with head-to-head records, LaTeX table for Table X in your paper ✨

**Example Output:**
```
Final Rankings:
1. Groq (Llama3.1) ........... 8.0/10 (80%)
2. OpenRouter (DeepSeek) ..... 6.5/10 (65%)
3. Google (Gemini 2.0) ....... 5.5/10 (55%)
4. Mistral (Codestral) ....... 5.0/10 (50%)
5. HuggingFace (Qwen) ........ 3.5/10 (35%)
6. Together (Llama 3.2) ...... 2.5/10 (25%)
```

---

### 1. Run Single-Provider Batch Games

**Goal:** Collect 50+ games with single LLM provider

**Time:** 45 minutes to complete

**Read:**
- [BATCH_GAMES_SETUP_COMPLETE.md](BATCH_GAMES_SETUP_COMPLETE.md) (5 min)

**Then run:**
```bash
$env:OPENAI_API_KEY="sk-..."
$env:ANTHROPIC_API_KEY="sk-ant-..."
npm run batch:50
```

**Result:** 1500+ moves with all metrics, research-grade dataset

---

### 2. Quick Test First (Verify Everything Works)

**Goal:** Make sure setup is correct before big batch

**Time:** 2 minutes

**Run:**
```bash
$env:OPENAI_API_KEY="sk-..."
$env:ANTHROPIC_API_KEY="sk-ant-..."
npm run batch:quick
```

**Result:** 3 complete games, confirms system works

---

### 3. Compare Different Models  

**Goal:** Test GPT-4o vs Claude head-to-head

**Time:** 12 minutes

**Run:**
```bash
npm run batch:compare
```

**Result:** 12 games comparing models

---

### 4. Setup Physical Robot

**Goal:** Run games with actual UR5 or Franka arm

**Read:** [ROS2_SETUP.md](ROS2_SETUP.md)

**Time:** 1-2 hours (mostly installation)

**Result:** Real robot chess data

---

### 5. Publish Results to arXiv

**Goal:** Turn your data into published research paper

**Read:** [ARXIV_SUBMISSION_COMPLETE.md](ARXIV_SUBMISSION_COMPLETE.md)

**Time:** 2-3 hours (mostly writing)

**Result:** Published on arXiv with reproducible data

---

## 📚 All Available Documents

### Essential Guides (Read These First)

| Document | Purpose | Time |
|----------|---------|------|
| This file | You are here | - |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | One-page cheat sheet | 2 min |
| [CONCURRENT_EXPERIMENT_SETUP.md](CONCURRENT_EXPERIMENT_SETUP.md) | 6-model parallel setup | 10 min |
| [ROUND_ROBIN_TOURNAMENT_GUIDE.md](ROUND_ROBIN_TOURNAMENT_GUIDE.md) | Fair tournament (all matchups) | 15 min |
| [BATCH_GAMES_SETUP_COMPLETE.md](BATCH_GAMES_SETUP_COMPLETE.md) | Setup & run batches | 5 min |
| [ARXIV_SUBMISSION_COMPLETE.md](ARXIV_SUBMISSION_COMPLETE.md) | Publish to arXiv | 20 min |

### Architecture & System Docs

| Document | For Understanding |
|----------|-------------------|
| [BATCH_GAMES_VISUAL_GUIDE.md](BATCH_GAMES_VISUAL_GUIDE.md) | How system works visually |
| [COMPLETE_GAME_FLOW.md](COMPLETE_GAME_FLOW.md) | End-to-end game flow |
| [DATASET_EXPORTER_INTEGRATION.md](DATASET_EXPORTER_INTEGRATION.md) | Data collection code |
| [NEUROAGENT_INTEGRATION.md](NEUROAGENT_INTEGRATION.md) | Brain/model integration |

### Setup Guides

| Document | When You Need It |
|----------|-----------------|
| [ROS2_SETUP.md](ROS2_SETUP.md) | Physical robot setup |
| [BATCH_GAMES_QUICK_START.md](BATCH_GAMES_QUICK_START.md) | Detailed integration |

---

## 🚀 Get Started Now

### Fastest Path (5 min to first results)

```powershell
# 1. Set API keys
$env:OPENAI_API_KEY="sk-YOUR-KEY"
$env:ANTHROPIC_API_KEY="sk-ant-YOUR-KEY"

# 2. Run quick test
npm run batch:quick

# 3. Done! Check results
ls batch_results/quick_test/
```

### Full Research Path (2 hours)

1. Run quick test to verify setup
2. Run `npm run batch:50` (collects 50 games, 45 min)
3. Follow [ARXIV_SUBMISSION_COMPLETE.md](ARXIV_SUBMISSION_COMPLETE.md)
4. Publish to arXiv

---

## 📊 System Overview

**This system:**
- ✅ Runs AI chess games autonomously (GPT-4o vs Claude, etc.)
- ✅ Collects all metrics per move (confidence, efficiency, quality)
- ✅ Works with physical robots (optional, UR5/Franka)
- ✅ Exports data in 6 formats (JSON, CSV, PGN, LaTeX, stats, figures)
- ✅ Publication ready (includes arXiv submission workflow)

**Everything is automated** - no manual setup needed after initial configuration

---

## ❓ Common Questions

| Question | Answer |
|----------|--------|
| How long for 50 games? | ~45 minutes (4 concurrent) |
| Cost for 50 games? | ~$3.50 |
| Can I use my own models? | Yes, any LLM API |
| What data do I get? | 1500+ moves with LLM confidence, SNN efficiency, move quality, etc. |
| Can I publish this? | Yes! Complete workflow in ARXIV_SUBMISSION_COMPLETE.md |
| Can I use real robots? | Yes! See ROS2_SETUP.md |
| Can I run 100 games? | Yes! Just change config totalGames: 100 |

---

## 📁 Folder Structure

```
research/
├── README.md ............ Overview (read second)
├── docs/ ................ All documentation
│   ├── START_HERE.md ... (you are here)
│   ├── QUICK_REFERENCE.md
│   ├── BATCH_GAMES_SETUP_COMPLETE.md
│   ├── ARXIV_SUBMISSION_COMPLETE.md
│   ├── ROS2_SETUP.md
│   └── (more guides...)
└── configs/ ............ Batch config templates
    ├── batch_config_50_games.json
    ├── batch_config_quick_test.json
    └── batch_config_model_comparison.json
```

Code is in `server/src/research/` and `server/src/routes/batch.ts`

---

## ✅ Prerequisites

Before you start:

- [ ] Node.js 16+ installed
- [ ] Python 3.8+ (optional, for analysis)
- [ ] OpenAI API key (https://platform.openai.com/api-keys)
- [ ] Anthropic API key (https://console.anthropic.com/account/keys)
- [ ] 45 minutes for full batch, or 2 min for quick test

---

## 🎯 Recommended Path

**If this is your first time:**
1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (2 min)
2. Run `npm run batch:quick` (2 min)
3. Read [BATCH_GAMES_SETUP_COMPLETE.md](BATCH_GAMES_SETUP_COMPLETE.md) (5 min)
4. Run `npm run batch:50` (45 min)
5. Follow [ARXIV_SUBMISSION_COMPLETE.md](ARXIV_SUBMISSION_COMPLETE.md) for publishing

**If you want to understand the system:**
1. Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
2. Read [BATCH_GAMES_VISUAL_GUIDE.md](BATCH_GAMES_VISUAL_GUIDE.md)
3. Read [COMPLETE_GAME_FLOW.md](COMPLETE_GAME_FLOW.md)
4. Then run batches

---

## ✨ Next Steps

### Immediate (Now)

**👉 Choose one:**

1. **[Go to BATCH_GAMES_SETUP_COMPLETE.md](BATCH_GAMES_SETUP_COMPLETE.md)** - For batch automation setup
2. **[Go to QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - For command reference
3. **[Go to ARXIV_SUBMISSION_COMPLETE.md](ARXIV_SUBMISSION_COMPLETE.md)** - For publication info

### Or Just Run This Now

```powershell
$env:OPENAI_API_KEY="sk-YOUR-KEY"
$env:ANTHROPIC_API_KEY="sk-ant-YOUR-KEY"
npm run batch:quick
```

---

## 🧠 What Gets Collected
- ✅ Express.js server with Socket.io real-time communication
- ✅ Game loop (MatchRoom) with full chess.js integration
- ✅ Move validation, timeout enforcement, forfeit handling
- ✅ Autonomous matchmaking (pairs bots every 60 seconds by Elo proximity)
- ✅ Elo rating system (standard K-factor=32)
- ✅ Complete error handling for all 11 failure scenarios
- ✅ Health check endpoint + match status endpoint

### ✅ Bot Runner Package (540 lines of TypeScript)
- ✅ Standalone CLI that bot owners can deploy
- ✅ Multi-provider LLM support (OpenAI, Anthropic, Groq, custom)
- ✅ Automatic endpoint detection and header management
- ✅ Reliable JSON parsing (handles markdown, missing quotes, etc.)
- ✅ Timeout handling + retry logic (1 retry on invalid move)
- ✅ Socket.io event handling + automatic reconnection
- ✅ Complete npm package with README for bot owners
- ✅ Docker-ready with example Dockerfile

### ✅ Database Schema (Supabase PostgreSQL)
- ✅ 7 tables: users, bots, bot_tokens, matches, moves, challenges, elo_history
- ✅ 13 performance indexes
- ✅ Row-level security (RLS) policies
- ✅ Zero API keys stored (kept in runner environment)
- ✅ Ready to paste into Supabase console

### ✅ Type System (Shared)
- ✅ 40+ TypeScript interfaces for full type safety
- ✅ Complete Socket.io event payloads defined
- ✅ Strict mode TypeScript across entire project
- ✅ One source of truth for all data structures

### ✅ Frontend Scaffold
- ✅ React 18 + Vite with hot reload
- ✅ Zustand store for game state management
- ✅ Socket.io hook for real-time updates
- ✅ Stockfish WASM integration wrapper
- ✅ 7 pages outlined (Home, RegisterBot, Game, BotProfile, Leaderboard, Analysis, Profile)
- ✅ 15+ components designed (ChessBoard, BotPanel, EvalBar, etc.)
- ✅ Complete build order defined

### ✅ Documentation Suite (7 Comprehensive Guides)
## 🧠 What Gets Collected

Per move (1500+ datapoints per 50-game batch):
- **Brain:** LLM confidence, SNN spike votes, integrated confidence score
- **Game:** FEN position, move quality (centipawn loss), board control
- **Robot:** Trajectory waypoints, execution time, success rate
- **Timing:** All operations timestamped

Result: Publication-grade research dataset ✅

---

## 🎉 You're Ready!

Everything is set up and working.

**Fastest start:**
```bash
npm run batch:quick
```

**Then read:** [BATCH_GAMES_SETUP_COMPLETE.md](BATCH_GAMES_SETUP_COMPLETE.md)

Good luck! 🚀
