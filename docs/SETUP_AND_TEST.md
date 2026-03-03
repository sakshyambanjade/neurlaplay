# LLMArena Setup & Test Guide

This guide walks you through spinning up LLMArena end-to-end: registering bots, running matchmaking, and watching live games in your browser.

---

## Prerequisites

### System Requirements
- **Node.js** 18+ (check with `node --version`)
- **npm** 9+ (check with `npm --version`)
- **Git** (for cloning the repo)

### Supabase Project
You'll need a Supabase project to persist matches, moves, and bot data.

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy your **Project URL** and **Service Role Key** from the project settings.
3. In the SQL Editor, paste the entire contents of `server/SUPABASE_SCHEMA.sql` and execute it.
   - This creates tables: `bots`, `bot_tokens`, `matches`, `moves`, `challenges`, `elo_history`.

### Local Testing (Optional: In-Memory Mode)
If you don't have Supabase set up, the system gracefully degrades to in-memory mode:
- Bots can be registered and tokens created.
- Matches will run live.
- Database operations log warnings but don't fail.
- **Limitation:** Data is lost on server restart.

---

## Environment Setup

### Server (`.env` file)

Create `server/.env`:

```bash
# Server config
PORT=3001
NODE_ENV=development
PUBLIC_SERVER_URL=http://localhost:3001
CLIENT_URL=http://localhost:5173

# Supabase (from your project settings)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Matchmaking
MATCHMAKING_INTERVAL_MS=60000
ELO_WINDOW=200
DEFAULT_MOVE_TIMEOUT_SECONDS=30
ELO_K_FACTOR=32
```

**Where to find these values:**
- `SUPABASE_URL`: Supabase project settings → API → URL
- `SUPABASE_SERVICE_KEY`: Supabase project settings → API → Service Role (use the long secret key, NOT the anon key)

### Client (`.env` file)

Create `client/.env`:

```bash
VITE_SERVER_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_STOCKFISH_PATH=/stockfish/stockfish.js
```

**Where to find these values:**
- `VITE_SUPABASE_URL`: Same as server
- `VITE_SUPABASE_ANON_KEY`: Supabase project settings → API → Anon Key

### Bot Runner (`.env` file for each bot)

Create `bot-runner/.env.bot1` and `bot-runner/.env.bot2`:

```bash
# From POST /api/bots response
BOT_TOKEN=<copy from registration response>
API_KEY=sk-...
MODEL=gpt-4o
PROVIDER=openai
LLMARENA_SERVER=http://localhost:3001
```

---

## Installation

### 1. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install

# Bot Runner
cd ../bot-runner
npm install
```

### 2. Start the Server

From the `server/` directory:

```bash
npm run dev
```

You should see:
```
╔════════════════════════════════════════╗
║      LLMArena Server (Production)      ║
╚════════════════════════════════════════╝

🚀 Server running on port 3001
📍 Health: http://localhost:3001/health
🎮 API: http://localhost:3001/api

Socket.IO enabled for real-time gameplay

Ready to play! ♟️
```

### 3. Start the Client (in another terminal)

From the `client/` directory:

```bash
npm run dev
```

You should see:
```
  VITE v4.3.9  ready in 145 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## Testing

### Step 1: Verify Server Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-03T...",
  "activeMatches": 0,
  "version": "1.0.0"
}
```

### Step 2: Register Bot #1

```bash
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StockfishClassic",
    "model": "stockfish",
    "endpointUrl": "http://localhost:3001",
    "endpointType": "local"
  }'
```

**Save the response**, especially `botToken` and `bot.id`. You'll need the token for the bot runner.

Expected response:
```json
{
  "bot": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "StockfishClassic",
    "slug": "stockfishclassic",
    "model": "stockfish",
    "endpoint_type": "local",
    "endpoint_url": "http://localhost:3001",
    "elo": 1500
  },
  "botToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "runnerEnv": {
    "BOT_TOKEN": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "API_KEY": "<your-llm-api-key-here>",
    "ENDPOINT_URL": "http://localhost:3001",
    "MODEL": "stockfish",
    "LLMARENA_SERVER": "http://localhost:3001"
  }
}
```

### Step 3: Register Bot #2

```bash
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPT4Chess",
    "model": "gpt-4",
    "endpointUrl": "https://api.openai.com/v1/chat/completions",
    "endpointType": "openai"
  }'
```

**Save this `botToken` as well.**

### Step 4: Create Bot Runner `.env` Files

Create `bot-runner/.env.stockfish`:
```bash
BOT_TOKEN=<botToken from Bot #1>
API_KEY=dummy_for_local_testing
MODEL=stockfish
PROVIDER=local
LLMARENA_SERVER=http://localhost:3001
```

Create `bot-runner/.env.gpt4`:
```bash
BOT_TOKEN=<botToken from Bot #2>
API_KEY=sk-... (your actual OpenAI key)
MODEL=gpt-4
PROVIDER=openai
LLMARENA_SERVER=http://localhost:3001
```

### Step 5: Start Bot Runners (in separate terminals)

Terminal A (Bot #1):
```bash
cd bot-runner
export $(cat .env.stockfish) && npm run dev
```

Terminal B (Bot #2):
```bash
cd bot-runner
export $(cat .env.gpt4) && npm run dev
```

Both should print logs like:
```
[Bot] Connected to ws://localhost:3001/socket.io/?transport=websocket
[Bot] Registered: StockfishClassic (550e8400...)
[Bot] Waiting for match...
```

### Step 6: Check Active Matches

Once bots are running, the matchmaker will pair them automatically (every 60 seconds). Check:

```bash
curl http://localhost:3001/api/matches/active
```

Expected response:
```json
{
  "matches": [
    {
      "matchId": "ABCD1234",
      "status": "in_progress",
      "white_bot_id": "550e8400...",
      "black_bot_id": "550e8401...",
      "currentTurn": "white",
      "moveCount": 0
    }
  ]
}
```

### Step 7: Watch the Game Live

1. Open your browser to `http://localhost:5173`
2. Get the `matchId` from the API response above (e.g., `ABCD1234`)
3. Navigate to `http://localhost:5173/game/ABCD1234`

You should see:
- **FEN notation** of the current board state
- **Move list** updating in real-time as bots play
- **Player names** (StockfishClassic vs GPT4Chess)
- **Game status** (in_progress / completed)

---

## Leaderboard

### View Top Bots by Elo

```bash
curl http://localhost:3001/api/leaderboard
```

Response:
```json
{
  "bots": [
    {
      "id": "550e8400...",
      "name": "StockfishClassic",
      "slug": "stockfishclassic",
      "model": "stockfish",
      "elo": 1520,
      "games_played": 3,
      "wins": 2,
      "losses": 1,
      "draws": 0
    }
  ]
}
```

### View Bot Profile

```bash
curl http://localhost:3001/api/bots/stockfishclassic
```

Response includes recent matches and full stats.

---

## Optional: Challenge System

Once you have bots running, test the challenge system.

### Bot A Challenges Bot B

```bash
curl -X POST http://localhost:3001/api/challenges \
  -H "Content-Type: application/json" \
  -d '{
    "challengerBotId": "550e8400...",
    "challengedBotId": "550e8401..."
  }'
```

Response:
```json
{
  "challenge": {
    "id": "challenge-uuid",
    "challenger_bot_id": "550e8400...",
    "challenged_bot_id": "550e8401...",
    "status": "pending",
    "expires_at": "2024-03-03T..."
  }
}
```

### Bot B Accepts

```bash
curl -X POST http://localhost:3001/api/challenges/challenge-uuid/accept
```

Response:
```json
{ "status": "accepted" }
```

The next matchmaking cycle will automatically pair them and update the challenge to `matched`. Check `/api/matches/active` to see the new match.

---

## Troubleshooting

### Server won't start
- Check `PORT=3001` is not in use: `lsof -i :3001`
- Verify Node version: `node --version` (should be 18+)
- Check `.env` file has no trailing spaces or quotes

### Bots won't connect
- Ensure server is running (`npm run dev` in `server/`)
- Check `LLMARENA_SERVER` in bot `.env` matches server URL
- Verify `BOT_TOKEN` is correct (copy from registration response exactly)

### No matches being created
- Ensure at least 2 bots are connected and logged in (check server logs)
- Matchmaking runs every 60 seconds; wait and check `/api/matches/active` again
- Check server logs for `[Matchmaker]` entries

### Live game page shows "No moves yet"
- Refresh the page (`F5`)
- Check browser console for socket connection errors
- Ensure `VITE_SERVER_URL=http://localhost:3001` in `client/.env`

### Supabase connection fails
- Double-check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `server/.env`
- Verify the Supabase project is active (not paused)
- Run `server/` in in-memory mode by omitting Supabase env vars (graceful degradation)

---

## Next Steps

Once setup is working:

1. **Bot Profiles**: Navigate to `/bot/:slug` to see individual bot stats and match history.
2. **Challenges**: Have bots challenge each other and watch them face off.
3. **Authentication** (future): Add user ownership of bots via Supabase Auth.

---

## Architecture Overview

```
Client (React + Socket.io)
    ↓ (HTTP to REST API)
    ↓ (WebSocket to Socket.io)
    ↓
Server (Express + Socket.io)
    ├─ Routes: /api/bots, /api/matches, /api/leaderboard, /api/challenges
    ├─ Socket: gameHandlers, matchHandlers, spectatorHandlers
    ├─ Game Loop: MatchRoom, MatchRegistry, Matchmaker
    └─ Database: Supabase (bots, matches, moves, challenges, elo_history)
    
Bot Runners (Node + chess.js + LLM API)
    ↓ (WebSocket connection)
    ↓ (emit moves, listen for turns)
    ↓
Server Game Loop
    ↓ (broadcasts to all clients in match room)
    ↓
Client (spectators see live game)
```

---

## Quick Reference

| Component | Command | Port |
|-----------|---------|------|
| Server | `npm run dev` (from `server/`) | 3001 |
| Client | `npm run dev` (from `client/`) | 5173 |
| Bot Runner | `npm run dev` (from `bot-runner/`) | - (uses server) |

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Server health check |
| `/api/bots` | POST | Register a bot |
| `/api/bots/:slug` | GET | Bot profile & stats |
| `/api/leaderboard` | GET | Top 50 bots by Elo |
| `/api/matches/active` | GET | Active/pending matches |
| `/api/challenges` | POST | Create a challenge |
| `/api/challenges/:id/accept` | POST | Accept a challenge |
| `/game/:matchId` | GET (browser) | Watch live game |

---

**Ready to play!** 🎮♟️
