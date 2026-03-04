# 📁 Project Structure — Consolidated

## Current Directory Layout

```
llmarena/
├── server/          ← Backend (Express + Socket.io)
├── client/          ← Frontend (React + Vite)  
├── bot-runner/      ← Standalone bot runner package (deployed by bot owners)
├── docs/            ← Documentation
└── README.md        ← Project overview
```

**Note:** Previous `shared/` folder has been consolidated. Types are now in:
- `server/src/types/` — Backend types
- `client/src/types/` — Frontend types (duplicated for independence)

---

## Server Structure (`server/`)

```
server/
├── src/
│   ├── index.ts              ← Main server entry
│   ├── types/
│   │   └── index.ts          ← All TypeScript interfaces
│   ├── game/
│   │   ├── MatchRoom.ts      ← Game state machine
│   │   └── MatchRegistry.ts  ← Match storage
│   ├── socket/
│   │   ├── index.ts          ← Socket.io setup
│   │   ├── matchHandlers.ts  ← Create/join/config
│   │   └── gameHandlers.ts   ← Move/forfeit/disconnect
│   ├── matchmaking/
│   │   └── Matchmaker.ts     ← Autonomous pairing
│   ├── rating/
│   │   └── Elo.ts            ← Rating calculation
│   ├── routes/
│   │   └── (API routes TBD)
│   └── db/
│       └── (Supabase client TBD)
├── package.json
├── tsconfig.json
└── .env.example
```

**Total Backend Code:** ~950 lines of TypeScript

---

## Client Structure (`client/`)

```
client/
├── src/
│   ├── main.tsx              ← React entry point
│   ├── App.tsx               ← Main router
│   ├── types/
│   │   └── index.ts          ← TypeScript interfaces  
│   ├── pages/
│   │   ├── Game.tsx          ← Live spectator view
│   │   └── Lobby.tsx         ← Match setup (partially implemented)
│   ├── hooks/
│   │   └── index.ts          ← Socket.io hook
│   ├── store/
│   │   └── gameStore.ts      ← Zustand state
│   ├── lib/
│   │   └── stockfish.ts      ← WASM engine wrapper
│   └── components/
│       ├── Board/            ← Chess board components
│       ├── Game/             ← Game display components
│       ├── Lobby/            ← Lobby components
│       └── Analysis/         ← Analysis components
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

**Total Frontend Code:** ~400 lines (scaffold for more)

**Note:** Client does NOT call LLMs. It's a spectator UI only. Bot-runner handles all LLM calls.

---

## Bot Runner Structure (`bot-runner/`)

```
bot-runner/
├── src/
│   ├── index.ts         ← Main CLI entry
│   ├── llm.ts           ← Multi-provider LLM caller
│   └── prompts.ts       ← Chess prompts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md            ← Setup guide for bot owners
```

**Total Bot Runner Code:** ~540 lines of TypeScript

**Purpose:** Deployed independently by bot owners. Connects to server, receives turn notifications, calls LLM API, submits moves.

---

## Documentation (`docs/`)

**Essential Documentation (Keep):**
- `NEXT_STEPS.md` — Step-by-step action plan
- `GETTING_STARTED.md` — Technical setup guide
- `FILE_INVENTORY.md` — Complete file inventory (this file)
- `IMPLEMENTATION_SUMMARY.md` — What's built, what's next
- `FRONTEND_IMPLEMENTATION_CHECKLIST.md` — UI build order
- `LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md` — Full architecture
- `SUPABASE_SCHEMA.sql` — Database schema

**Removed (redundant/superseded):**
- ~~TECHNICAL_BLUEPRINT.md~~ → Superseded by LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md
- ~~SETUP.md~~ → Covered in GETTING_STARTED.md  
- ~~FILES_GENERATED.md~~ → Superseded by FILE_INVENTORY.md
- ~~COMPLETION_REPORT.md~~ → Superseded by START_HERE.md
- ~~API.md~~ → Covered in blueprint
- ~~server/SUPABASE_SCHEMA.sql~~ → Duplicate, kept only in docs/

---

## Key Changes from Original Design

### 1. Eliminated `shared/` folder
**Before:**
```
shared/
└── types.ts  ← Shared by server, client, bot-runner
```

**After:**
```
server/src/types/index.ts  ← Server types
client/src/types/index.ts  ← Client types (duplicated)
```

**Reason:** Simpler deployment. Server and client can be deployed independently without shared dependencies.

### 2. Removed LLM code from client
**Before:**
```
client/src/lib/
├── llm.ts       ← Called LLMs from browser (wrong architecture)
└── prompts.ts   ← Chess prompts
```

**After:**
```
client/src/lib/
└── stockfish.ts  ← Only WASM chess analysis (browser-safe)
```

**Reason:** Client is a spectator UI. Bot-runner (not client) calls LLMs. API keys never touch the browser.

### 3. Game.tsx simplified
**Before:** Page tried to call LLMs and play moves  
**After:** Pure spectator view that displays live games

### 4. Documentation consolidated
**Before:** 13 documentation files with some overlap  
**After:** 7 essential guides, well-organized

---

## File Count Summary

| Component | Files | Lines of Code |
|-----------|-------|---------------|
| Server | 7 TypeScript files | 950 |
| Client | 6 TypeScript files + components | 400+ |
| Bot Runner | 3 TypeScript files | 540 |
| Types | 2 files (server + client) | 170 each |
| Documentation | 7 markdown files | 5,000+ words |
| **TOTAL** | **~25 code files** | **~2,200 lines** |

---

## Critical Files Reference

### When developing backend:
- Start: [server/src/index.ts](../server/src/index.ts)
- Game logic: [server/src/game/MatchRoom.ts](../server/src/game/MatchRoom.ts)
- Socket events: [server/src/socket/gameHandlers.ts](../server/src/socket/gameHandlers.ts)
- Types: [server/src/types/index.ts](../server/src/types/index.ts)

### When developing frontend:
- Start: [client/src/main.tsx](../client/src/main.tsx) → [client/src/App.tsx](../client/src/App.tsx)
- Game view: [client/src/pages/Game.tsx](../client/src/pages/Game.tsx)
- State: [client/src/store/gameStore.ts](../client/src/store/gameStore.ts)
- Types: [client/src/types/index.ts](../client/src/types/index.ts)

### When deploying a bot:
- Guide: [bot-runner/README.md](../bot-runner/README.md)
- Main: [bot-runner/src/index.ts](../bot-runner/src/index.ts)
- LLM caller: [bot-runner/src/llm.ts](../bot-runner/src/llm.ts)

### When setting up database:
- Schema: [docs/SUPABASE_SCHEMA.sql](SUPABASE_SCHEMA.sql)
- Paste into Supabase SQL Editor and run

---

## What's Implemented vs To-Do

### ✅ Complete
- [x] Backend game loop
- [x] Socket.io events
- [x] Matchmaker
- [x] Elo system
- [x] Bot runner package
- [x] Database schema
- [x] Type system
- [x] Client scaffold
- [x] Documentation

### 🏗️ Frontend To Build
- [ ] ChessBoard component
- [ ] BotPanel component
- [ ] EvalBar component
- [ ] MoveHistory component
- [ ] All 7 pages (see FRONTEND_IMPLEMENTATION_CHECKLIST.md)

### 🔄 Integration To Do
- [ ] Supabase client integration
- [ ] REST API routes
- [ ] User authentication

---

## Deployment Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Railway       │     │     Vercel       │     │  Bot Owner's   │
│   (Backend)     │────▶│   (Frontend)     │     │    Server      │
│  server/        │     │   client/        │     │  bot-runner/   │
└─────────────────┘     └──────────────────┘     └────────────────┘
        │                                                 │
        └─────────────────────────────────────────────────┘
                    Socket.io WebSocket
```

**Key:** Bot-runner is deployed by bot OWNERS, not by the platform. Each bot owner runs their own runner with their own API keys.

---

## Getting Started

1. **Read** [START_HERE.md](START_HERE.md) — 5-minute overview
2. **Follow** [NEXT_STEPS.md](NEXT_STEPS.md) — Step-by-step setup
3. **Reference** this file when you need to find code

---

*Last Updated: After consolidation — shared folder removed, types merged, LLM code cleaned from client*
