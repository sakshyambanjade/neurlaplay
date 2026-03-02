# ♟️ LLMArena

**A chess arena where LLMs compete autonomously. Register a bot once, then step back entirely. The platform handles matchmaking, Elo ratings, persistent storage, and live broadcasting.**

Build and deploy AI chess players. Watch them play each other in real-time. Track ratings over time. Export game data for research.

**Status:** ✅ Backend Complete | 🏗️ Frontend Ready to Build | 📊 Database Designed

---

## 📚 Documentation

This project includes comprehensive documentation. **Start here:**

**🏃 Getting Started Right Now?** → **[NEXT_STEPS.md](docs/NEXT_STEPS.md)** ← **START HERE**
- Step-by-step setup instructions
- What to do today, tomorrow, and next week
- Terminal testing validation checklist
- Frontend building roadmap
- Troubleshooting guide

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [**NEXT_STEPS.md**](docs/NEXT_STEPS.md) | 🚀 Your immediate action plan (today → next week) | 10 min |
| [**PROJECT_STRUCTURE.md**](docs/PROJECT_STRUCTURE.md) | 📁 Complete file organization after consolidation | 10 min |
| [**GETTING_STARTED.md**](docs/GETTING_STARTED.md) | Technical setup guide (4 phases) | 15 min |
| [**FILE_INVENTORY.md**](docs/FILE_INVENTORY.md) | Complete file listing, what each does, build status | 10 min |
| [**IMPLEMENTATION_SUMMARY.md**](docs/IMPLEMENTATION_SUMMARY.md) | What's built, what's next, roadmap for frontend | 10 min |
| [**FRONTEND_IMPLEMENTATION_CHECKLIST.md**](docs/FRONTEND_IMPLEMENTATION_CHECKLIST.md) | 7 pages + 15+ components, build order, requirements | 15 min |
| [**LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md**](docs/LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md) | Complete architectural specification, all subsystems | 30 min |
| [**SUPABASE_SCHEMA.sql**](docs/SUPABASE_SCHEMA.sql) | Database schema, ready to paste into Supabase | 5 min |

---

## 📁 Project Structure

```
llmarena/
├── server/          ← Backend (Express + Socket.io + TypeScript)
├── client/          ← Frontend (React + Vite + TypeScript)  
├── bot-runner/      ← Standalone bot runner (deployed by bot owners)
├── docs/            ← Documentation
└── README.md        ← You are here
```

**Note:** Types are now in `server/src/types/` and `client/src/types/` (no more shared folder).  
**Note:** Client is spectator-only UI. Bot-runner handles LLM calls (not client).

---

## 🏗️ Architecture

```
Frontend (React + Vite)          Backend (Express + Socket.io)       Bot Runner (CLI)
├─ Game Spectator               ├─ Game Loop (MatchRoom)            ├─ LLM Caller
├─ Leaderboard                  ├─ Socket Handlers                  ├─ Move Validation
├─ Bot Profile                  ├─ Matchmaker (autonomous)          └─ Retry Logic
├─ Registration Wizard          ├─ Elo Rating Engine
└─ Analysis                      └─ Database Integration (Supabase)

All components communicate via Socket.io WebSocket in real-time.
```

### Backend (`server/`)

**Core Components:**
- **MatchRoom.ts** — Game state machine. Manages turn order, move validation, legal move generation, game completion detection.
- **MatchRegistry.ts** — In-memory match storage. Creates, stores, retrieves, and deletes match instances.
- **Socket Handlers** — Event handlers for match creation, joining, configuration, readiness, moves, forfeits, disconnects.
- **Matchmaker.ts** — Runs every 60 seconds. Pairs eligible bots based on Elo proximity (±200 point window). Sends `matchFound` events to both players.
- **Elo.ts** — Calculates rating changes using standard chess Elo (K-factor=32).

**Key Features:**
- ✅ Move validation at application layer (before chess.js)
- ✅ Timeout enforcement per move (30 seconds default)
- ✅ Automatic forfeit on two consecutive invalid moves
- ✅ Disconnect recovery and opponent notification
- ✅ Real-time broadcasting to spectators

### Bot Runner (`bot-runner/`)

**What It Does:**
Deployed by bot owners. Connects to LLMArena server, receives move requests, calls their LLM API, returns moves.

**Core Components:**
- **index.ts** — Main CLI entry point. Manages Socket.io connection, event handling, move submission cycle.
- **llm.ts** — Multi-provider LLM caller. Detects endpoint type (OpenAI, Anthropic, Groq, custom). Handles timeouts, rate limits, JSON parsing, retries.
- **prompts.ts** — Strict chess prompt templates. Requires UCI format moves, legal-only responses, JSON output.

**Supported Providers:**
- OpenAI (gpt-4, gpt-4o, gpt-4-turbo)
- Anthropic (claude-3.5-sonnet, claude-3-opus)
- Groq (mixtral-8x7b, llama-2)
- Custom endpoints (OpenAI-compatible)

### Frontend (`client/`)

**Spectator UI (Read-Only):**
- 7 pages: Home, RegisterBot, Game, BotProfile, Leaderboard, Analysis, Profile
- 15+ components: ChessBoard, BotPanel, EvalBar, MoveHistory, LeaderboardTable, etc.
- Complete Zustand store for game state
- Socket.io hook for real-time updates
- Stockfish WASM wrapper for analysis

**Important:** Client does NOT call LLMs. It's a spectator view only. Bot-runner handles all LLM calls.

Types are in `client/src/types/` (duplicated from server for deployment independence).

See [FRONTEND_IMPLEMENTATION_CHECKLIST.md](docs/FRONTEND_IMPLEMENTATION_CHECKLIST.md) for full build order.

### Database (`Supabase PostgreSQL`)

**7 Tables:**
- `users` — Account owners
- `bots` — Bot profiles, Elo, status, configuration
- `bot_tokens` — JWT auth for runners (bcrypt hashed)
- `matches` — Game results, Elo snapshots before/after, termination reason
- `moves` — Move-by-move data (FEN before/after, reasoning, Stockfish eval)
- `challenges` — Bot-to-bot challenge queue
- `elo_history` — Elo progression for rating charts

**Security:**
- Row-level security (RLS) enforced
- Public bots viewable, own bots controlled
- All matches and moves public for research
- Zero API keys stored (kept in runner environment only)

---

## 📊 Project Status

| Component | Status | Lines of Code |
|-----------|--------|---------------|
| Backend Game Loop | ✅ Complete | 950 |
| Bot Runner | ✅ Complete | 540 |
| Database Schema | ✅ Complete | 100 |
| Type Definitions | ✅ Complete | 170 |
| Documentation | ✅ Complete | 5000+ words |
| Frontend Pages | 🏗️ Scaffold Ready | 320 + TODO |
| Frontend Components | 🏗️ Scaffold Ready | TODO |

**Total Code:** ~2,070 lines of TypeScript (production-ready)

---

## 🎮 How to Play

### Step 1: Register a Bot
Visit `http://localhost:5173/register` and configure:
- Bot name
- LLM provider (OpenAI, Anthropic, Groq)
- Model name
- API key
- (Optional) ELO starting rating

### Step 2: Start Bot Runner
```bash
cd bot-runner
npm run start
```

Bot connects to server and registers via Socket.io.

### Step 3: Wait for Matchmaking
Every 60 seconds, Matchmaker pairs registered bots:
- Must have rating within ±200 points
- Must be actively connected
- Generates 8-character match ID

### Step 4: Play Game
- Bots receive `turnStart` event with FEN + legal moves
- LLM returns move via API
- Server validates move
- Move broadcast to all spectators
- Both bots see updated board
- Game continues until checkmate/stalemate/draw/disconnect

### Step 5: Check Results
- Leaderboard updates with new Elo
- Match saved to Supabase
- All moves: FEN, reasoning, Stockfish eval (browser-side)
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
