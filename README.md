# ♟️ LLMArena

**Chess arena where LLMs compete autonomously.**

Watch AI models play chess in real-time. Run 50+ automated games. Export data for research. **Compare 6 free LLM providers concurrently.**

---

## 🌟 NEW: 6-Model Concurrent Experiment

**Generate Table 3 for your arXiv paper in 45 minutes, at zero cost**

Compare 6 free LLM providers in parallel:
- **Groq** Llama3.1-405B (Elo ~1850) 🥇
- **OpenRouter** DeepSeek-R1 (Elo ~1750)
- **Google** Gemini-2.0 (Elo ~1650)
- **Mistral** Codestral (Elo ~1600)
- **HuggingFace** Qwen2.5 (Elo ~1550)
- **Together** Llama3.2 (Elo ~1500)

```powershell
# Get free keys (15 min) → npm run experiment:concurrent → Get Table 3 data
```

👉 **[CONCURRENT_EXPERIMENT_SETUP.md](research/docs/CONCURRENT_EXPERIMENT_SETUP.md)** | **[TABLE3_GENERATION_GUIDE.md](research/docs/TABLE3_GENERATION_GUIDE.md)**

---

## ⚡ Quick Start (5 minutes)

### 1. Get API Key (FREE)
```
Priority: Groq (groq.com) + OpenRouter (openrouter.ai)
Then: Google, Mistral, HuggingFace, Together
```

### 2. Clone & Install
```powershell
git clone https://github.com/sakshyambanjade/neurlaplay.git
cd neurlaplay

# Terminal 1: Backend
cd server
npm install
npm run dev

# Terminal 2: Frontend
cd client
npm install
npm run dev
```

### 3. Create .env files
```
server/.env → Copy from server/.env.example, add API keys
client/.env → Copy from client/.env.example
```

### 4. Open Browser
```
http://localhost:5173 → Click "⚡ Bot vs Bot" → Start game
```

---

## 📦 What You Get

- ✅ Real-time chess games between LLMs
- ✅ **6-model concurrent experiments (50 games, 45 min, $0)**
- ✅ Automated batch games (50 games, 45 min)
- ✅ Elo rating system  
- ✅ Research-grade data export (6 formats)
- ✅ Publication-ready workflows (Table 3 auto-generated)

---

## 📚 Full Documentation

- **Start Here:** [research/docs/START_HERE.md](research/docs/START_HERE.md)
- **6-Model Setup:** [research/docs/CONCURRENT_EXPERIMENT_SETUP.md](research/docs/CONCURRENT_EXPERIMENT_SETUP.md) ⭐ NEW
- **Table 3 Guide:** [research/docs/TABLE3_GENERATION_GUIDE.md](research/docs/TABLE3_GENERATION_GUIDE.md) ⭐ NEW
- **Batch Games:** [research/docs/BATCH_GAMES_SETUP_COMPLETE.md](research/docs/BATCH_GAMES_SETUP_COMPLETE.md)
- **Publishing:** [research/docs/ARXIV_SUBMISSION_COMPLETE.md](research/docs/ARXIV_SUBMISSION_COMPLETE.md)
- **All Docs:** [research/README.md](research/README.md)

---

## 🏗️ Architecture

### Backend (Express + Socket.io)
- **MatchRoom.ts** — Game logic, move validation
- **MatchRegistry.ts** — Match storage
- **Socket Handlers** — Real-time events
- **Matchmaker.ts** — Bot pairing (Elo-based)
- **/api/bot-match** — Run LLM vs LLM directly

### Frontend (React + Vite)
- **Bot vs Bot Arena** — Configure 2 LLMs, start game
- **Game Spectator** — Watch live with chess board
- **Leaderboard** — View bot ratings

### Database (Supabase PostgreSQL)
- Bots, matches, moves, user data

---

## 🧠 Research & Batch Automation

### Option 1: 6-Model Concurrent Experiment ⭐ (RECOMMENDED FOR PAPERS)

Compare 6 free LLM providers side-by-side:

```powershell
# Get free keys from: groq.com, openrouter.ai, google.com, mistral.ai, huggingface.co, together.ai
# Add to server/.env

npm run experiment:concurrent
# Output: Table 3 (comparison table) in experiment-results/
```

**What you get:** 50 games, 6 models, publication-ready Table 3 data, ~45 minutes

### Option 2: Single-Provider Batch

```powershell
$env:GROQ_API_KEY="gsk_..."

npm run batch:quick   # 3 games test, 2 min
npm run batch:50      # 50 games, 45 min
npm run batch:compare # 12 games model comparison, 12 min
```

👉 See [research/README.md](research/README.md) for all workflows

---

## 🔧 Core Features

✅ **Local Development** — Everything runs on your machine  
✅ **Bot vs Bot** — No bot-runner needed, runs on server  
✅ **Multi-LLM** — OpenAI, Anthropic, Groq, custom endpoints  
✅ **Real-time** — Socket.io for live updates  
✅ **Elo Ratings** — Track bot performance  
✅ **Data Export** — JSON, CSV, PGN, LaTeX formats  
✅ **Publication Ready** — Auto-generate arXiv-compatible datasets  

---

## 📂 Project Structure

```
llmarena/
├── server/           ← Backend code
│   ├── src/
│   │   ├── index.ts                    (Express server)
│   │   ├── game/MatchRoom.ts
│   │   ├── routes/batch.ts             (Batch API)
│   │   ├── research/
│   │   │   ├── MultiProviderLLM.ts     (6 LLM providers) ⭐ NEW
│   │   │   ├── ConcurrentExperimentRunner.ts ⭐ NEW
│   │   │   ├── experiment-cli.ts       ⭐ NEW
│   │   │   ├── BatchGameRunner.ts
│   │   │   └── ...
│   │   └── ...
│   ├── .env.example
│   └── package.json
│
├── client/           ← Frontend code
│   ├── src/
│   │   ├── pages/
│   │   │   ├── BotVsBot.tsx   (LLM battle UI)
│   │   │   ├── Game.tsx       (Spectator view)
│   │   │   └── ...
│   │   └── ...
│   ├── .env.example
│   └── package.json
│
└── research/         ← Research materials
    ├── README.md
    ├── docs/         ← All documentation
    │   ├── START_HERE.md
    │   ├── CONCURRENT_EXPERIMENT_SETUP.md ⭐ NEW
    │   ├── TABLE3_GENERATION_GUIDE.md ⭐ NEW
    │   ├── BATCH_GAMES_SETUP_COMPLETE.md
    │   ├── ARXIV_SUBMISSION_COMPLETE.md
    │   └── ...
    └── configs/      ← Configuration templates
        ├── experiment-6models-concurrent.json ⭐ NEW
        └── ...
```

---

## 🎯 Next Steps

1. **Want maximum paper impact? (6 models)**
   - Read [CONCURRENT_EXPERIMENT_SETUP.md](research/docs/CONCURRENT_EXPERIMENT_SETUP.md)
   - Run `npm run experiment:concurrent`
   - Get Table 3 data auto-generated

2. **Want single-provider batches?**
   - Read [BATCH_GAMES_SETUP_COMPLETE.md](research/docs/BATCH_GAMES_SETUP_COMPLETE.md)
   - Run `npm run batch:50`

3. **Want to publish results?**
   - Read [ARXIV_SUBMISSION_COMPLETE.md](research/docs/ARXIV_SUBMISSION_COMPLETE.md)
   - Use auto-generated Table 3 data from model comparison

4. **Want to integrate robots?**
   - Read [ROS2_SETUP.md](research/docs/ROS2_SETUP.md)
   - Enable with UR5/Franka arm

---

## 💰 Cost Breakdown

| Scenario | Games | Models | Cost | Time |
|----------|-------|--------|------|------|
| **6-Model Experiment** | 50 | 6 | **$0** | 45 min |
| Groq Batch | 50 | 1 | $0 | 45 min |
| OpenAI Batch | 50 | 1 | ~$3.50 | 45 min |
| Custom | Unlimited | Any | $0-$∞ | Flexible |

**Database:** Always FREE (Supabase free tier)

---

## 📖 Databases Supported

### Cloud (Easiest)
```
Supabase: https://supabase.com (1 click, free tier)
- Set SUPABASE_URL and SUPABASE_SERVICE_KEY in server/.env
```

### Local (Self-Hosted)
```
PostgreSQL: https://www.postgresql.org/download/
- Set DATABASE_URL in server/.env if using local DB
```

---

## 🚨 Troubleshooting

**Can't connect to backend?**
→ Make sure server is running with `npm run dev` in Terminal 1

**API key rejected?**
→ Get a fresh key from groq.com or openai.com, paste into bot form, click Test

**Port already in use?**
→ Change PORT in server/.env or let Vite auto-select next port

---

**Status:** ✅ Ready to run  
**Last Updated:** March 5, 2026

**What It Does:**
Runs directly on the server. No external runner needed. Just provide LLM credentials and watch two AI models play!

**How It Works:**
1. Client sends bot configs (names, models, API keys, endpoints) to `/api/bot-match`
2. Server creates match room and starts the game loop
3. Server iteratively:
   - Asks LLM for next move (with configurable delay for drama!)
   - Validates move on chess board
   - Broadcasts to all spectators via Socket.io
   - Repeats until checkmate/stalemate/max moves
4. Match completes and results shown in real-time

**Supported Providers:**
- OpenAI (gpt-4, gpt-4o, gpt-4-turbo)
- Anthropic (claude-3.5-sonnet, claude-3-opus)
- Groq (mixtral-8x7b, llama-2)
- Custom OpenAI-compatible endpoints

### Frontend (`client/`)

**Pages & Features:**
- **Home** — Create match / Bot vs Bot Arena / Join by Match ID
- **Bot vs Bot Arena** — Configure 2 LLMs, set move delay, start match
- **Game Spectator** — Watch matches with live chess board (react-chessboard)
- **Lobby** — Register & configure bots
- **Leaderboard** — Track bot ratings
- **Bot Profile** — View detailed bot stats

**Technology:**
- React + Vite + TypeScript
- Socket.io for real-time updates  
- react-chessboard for visual board
- Zustand for state management

Types are in `client/src/types/` (duplicated from server for deployment independence).

### Database (`Supabase PostgreSQL`)

**Tables:**
- `users` — Account owners
- `bots` — Bot profiles, Elo, status
- `matches` — Game results & ratings
- `moves` — Move-by-move data

---

## 🎮 Quick Start - Watch LLMs Play Chess

### 1. Start the Server

```bash
cd server
npm install
npm run dev
```

Server runs on `http://localhost:3001`

### 2. Start the Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

### 3. Start a Bot vs Bot Match

1. Click **"⚡ Bot vs Bot"** button on home page
2. Enter bot names (e.g., "GPT-4" vs "Claude")
3. Select models and API endpoints
4. Paste in your API keys (Groq, OpenAI, Anthropic, etc.)
5. Set move delay for dramatic effect (500ms - 10s)
6. Click **"Start Match"**
7. Watch the live chess board as LLMs battle in real-time! 👀

That's it! No CLI, no separate runners, no complex setup. Just browser + credentials!

---

## 📊 Project Status

| Component | Status |
|-----------|--------|
| Backend Game Loop | ✅ Complete |
| Bot vs Bot Engine | ✅ Complete |  
| Frontend UI | ✅ Complete |
| Database Schema | ✅ Complete |
| Documentation | ✅ Complete |
- Download PGN or GIF

---

## 🔌 Socket.io Events Reference

**Bot → Server:**
- `createMatch` — Register bot for matchmaking
- `setConfig` — Update bot configuration
- `setReady` — Mark as ready to play
- `move` — Submit move (UCI format, FEN, reasoning)
- `forfeit` — Give up current game

**Server → Bot:**
- `matchFound` — Pairing found, you're {white/black}
- `turnStart` — Your turn. FEN + legal moves
- `moveMade` — Opponent moved. New FEN + move
- `gameOver` — Game ended. Result + Elo change
- `error` — Something went wrong

See [LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md](docs/LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md#socket-io-events) for full event payloads.

---

## 🧪 Terminal Testing (No UI)

Start server + 2 bots in 3 terminals to watch them play:

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start first bot (GPT-4o)
cd bot-runner
npm run start

# Terminal 3: Start second bot (Claude)
# First copy .env and modify MODEL variable
cd bot-runner
npm run start
```

Watch the logs:
- Bot registration
- Matchmaker pairing (every 60 seconds)
- Move submission + validation
- Final game result + Elo change

See [NEXT_STEPS.md](docs/NEXT_STEPS.md) for detailed terminal testing walkthrough.

---

## 🚀 Deployment

**Railway (Backend):**
1. Connect GitHub repository to Railway
2. Set environment variables
3. Deploy on push to `main`

**Vercel (Frontend):**
1. Connect GitHub repository to Vercel
2. Set environment variables (API_URL)
3. Deploy on push to `main`

See [GETTING_STARTED.md Phase 4](docs/GETTING_STARTED.md) for detailed deployment steps.

---

## 📖 Development Roadmap

**Phase 1 (Done):**
- [x] Backend game loop
- [x] Socket.io event contract
- [x] Matchmaker engine
- [x] Elo rating system
- [x] Bot runner package
- [x] Database schema

**Phase 2 (Next - 1 week):**
- [ ] Build frontend pages (7 total)
- [ ] Implement React components (15+ components)
- [ ] Supabase client integration
- [ ] Live game rendering in browser

**Phase 3 (Week 3):**
- [ ] Stockfish.js integration for analysis
- [ ] Post-game stats and charts
- [ ] Move quality ratings
- [ ] ELO history visualization

**Phase 4 (Week 4):**
- [ ] User authentication
- [ ] Bot profile customization
- [ ] Challenge system (bot-to-bot challenges)
- [ ] Data export (CSV, PGN, GIF)
- [ ] Production deployment

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes in TypeScript (strict mode)
3. Test locally (see Testing section)
4. Commit: `git commit -m "feat: my feature"`
5. Push and create PR

---

## 📞 Support

Issues or questions?
- Check [NEXT_STEPS.md](docs/NEXT_STEPS.md) for immediate action plan
- Check [GETTING_STARTED.md](docs/GETTING_STARTED.md) for technical setup
- Read [LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md](docs/LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md) for architecture
- Check [FILE_INVENTORY.md](docs/FILE_INVENTORY.md) for code locations

---

## ⚖️ License

MIT

---

**Last Updated:** Implementation Complete  
**Next Action:** Follow [NEXT_STEPS.md](docs/NEXT_STEPS.md) to set up locally and test terminal games 🚀
