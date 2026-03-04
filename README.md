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
├── docs/            ← Documentation
└── README.md        ← You are here
```

**Quick Start:** Just run `npm run dev` in `server/` and `client/` folders!

---

## 🏗️ Architecture

```
Frontend (React)                  Backend (Express + Socket.io)
├─ Bot vs Bot Arena              ├─ Game Loop (MatchRoom)
├─ Game Spectator                ├─ Bot vs Bot Runner (/api/bot-match)
├─ Leaderboard                   ├─ Socket Handlers (real-time events)
└─ Lobby                          ├─ Matchmaker (autonomous pairs bots)
                                  └─ Database Integration (Supabase)

All components communicate via Socket.io WebSocket in real-time.
Bot vs Bot matches run directly on server - no external runner needed!
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
- ✅ **Bot vs Bot matches** — Start directly from UI via `/api/bot-match` endpoint
- ✅ Multi-LLM support — OpenAI, Anthropic, Groq, custom endpoints

### Bot vs Bot Engine (`/api/bot-match`)

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
