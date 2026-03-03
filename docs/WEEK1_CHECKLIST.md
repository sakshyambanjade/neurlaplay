# Week 1 Implementation Checklist

Use this checklist to verify all hardening changes are working correctly.

## ✅ Pre-Flight Checks

- [ ] Installed `@supabase/supabase-js` in server: `cd server && npm install @supabase/supabase-js`
- [ ] Created `server/.env` with at minimum `PORT` and `CLIENT_URL`
- [ ] (Optional) Configured `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` for persistence
- [ ] Server starts without errors: `cd server && npm run dev`
- [ ] No TypeScript compilation errors

## ✅ Configuration Module

- [ ] `server/src/config.ts` exists
- [ ] All environment variables have sensible defaults
- [ ] Server uses config values (not hardcoded)

## ✅ MatchRoom Hardening

- [ ] `start()` method exists and sets status to 'in_progress'
- [ ] `complete()` method exists and cleans up
- [ ] `hasReachedMoveCap` getter exists and uses `config.MAX_MOVES_PER_GAME`
- [ ] Constructor uses `config.DEFAULT_MOVE_TIMEOUT_SECONDS`

## ✅ MatchRegistry Improvements

- [ ] `createReady()` factory method exists
- [ ] `isBotInActiveMatch()` helper exists
- [ ] `getMatchesForBot()` helper exists

## ✅ Matchmaker Tightening

- [ ] Uses `config.MATCHMAKING_INTERVAL_MS`
- [ ] Uses `config.ELO_WINDOW`
- [ ] Checks `registry.isBotInActiveMatch()` before pairing
- [ ] Logs when no opponent found
- [ ] Uses `registry.createReady()` to create matches

## ✅ Database Layer

- [ ] `server/src/db/client.ts` exists with Supabase client
- [ ] `server/src/db/matches.ts` exists with all helpers
- [ ] `server/src/db/moves.ts` exists with save/get functions
- [ ] `server/src/db/index.ts` exports all DB functions
- [ ] All DB functions check `isDatabaseAvailable()` first
- [ ] All DB functions have try/catch and error logging

## ✅ Game Handlers

- [ ] Imports DB functions and Elo calculator
- [ ] Move validation calls `handleForfeit()` on invalid move
- [ ] Uses `saveMove()` to persist moves
- [ ] Uses `room.hasReachedMoveCap` for move limit
- [ ] `handleForfeit()` function exists and calls `handleGameEnd()`
- [ ] `handleGameEnd()` fetches bot Elo from DB
- [ ] `handleGameEnd()` calculates new ratings
- [ ] `handleGameEnd()` updates both bots' Elo
- [ ] `handleGameEnd()` calls `finalizeMatch()`
- [ ] `handleGameEnd()` emits `eloChanges` in gameOver event
- [ ] Timeout uses `config.DISCONNECT_GRACE_PERIOD_MS`

## ✅ Bot Runner Improvements

- [ ] Tracks `currentColor` per match
- [ ] Uses `matchInfo` map to store match data
- [ ] Displays correct Elo change based on actual color
- [ ] Enhanced logging shows FEN, legal moves, timeout
- [ ] Time displayed in seconds (not ms)
- [ ] Reasoning truncated to 150 chars in console
- [ ] `detectEndpointType()` handles together.ai and localhost
- [ ] Connection shows server, model, endpoint

## ✅ LLM Parsing

- [ ] Max text length cutoff (5000 chars)
- [ ] Tries `explanation` field in addition to `reasoning`
- [ ] Max reasoning increased to 500 chars
- [ ] Error messages include response preview
- [ ] Graceful fallback for missing reasoning

## ✅ HTTP API Routes

### Bots Route (`/api/bots`)
- [ ] `server/src/routes/bots.ts` exists
- [ ] POST `/api/bots` creates bot and returns token
- [ ] POST generates secure token with crypto
- [ ] POST creates bot_tokens record
- [ ] POST returns `.envExample` string
- [ ] GET `/api/bots/:slug` returns bot profile
- [ ] GET includes stats (W/L/D, win rate)
- [ ] GET includes recent matches

### Matches Route (`/api/matches`)
- [ ] `server/src/routes/matches.ts` exists
- [ ] GET `/api/matches/active` lists in-memory matches
- [ ] GET `/api/matches/:matchId` checks registry first
- [ ] GET falls back to database for completed matches

## ✅ Spectator Support

- [ ] `server/src/socket/spectatorHandlers.ts` exists
- [ ] `spectate` event joins match room
- [ ] `spectate` emits full `gameState`
- [ ] `unspectate` event leaves room
- [ ] Spectator handlers registered in `socket/index.ts`

## ✅ Server Integration

- [ ] `server/src/index.ts` imports routes
- [ ] Uses `app.use('/api/bots', botsRouter)`
- [ ] Uses `app.use('/api/matches', matchesRouter)`
- [ ] Health endpoint includes version
- [ ] Uses centralized config throughout

## ✅ Types & Exports

- [ ] `PlayerConfig` has `botId` field
- [ ] `GameOverEvent` has `eloChanges` field
- [ ] Elo module uses `config.ELO_K_FACTOR`

## 🧪 Runtime Tests

### Test 1: Health Check
```bash
curl http://localhost:3001/health
```
- [ ] Returns 200 OK
- [ ] Includes `status: 'ok'`
- [ ] Includes `activeMatches` count
- [ ] Includes `version` field

### Test 2: Bot Registration
```bash
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{"name":"TestBot","model":"gpt-4"}'
```
- [ ] Returns 200 OK (or 503 if no DB)
- [ ] Returns `botToken` (if DB available)
- [ ] Returns `envExample`
- [ ] Token is 64 hex characters

### Test 3: Active Matches
```bash
curl http://localhost:3001/api/matches/active
```
- [ ] Returns 200 OK
- [ ] Returns `{ matches: [] }` (empty if no active games)

### Test 4: Bot Runner Connection
- [ ] Bot runner connects successfully
- [ ] Shows connection info on connect
- [ ] Shows authentication confirmation

### Test 5: Match Creation & Play
- [ ] Create match via Socket.io works
- [ ] Both bots receive `matchFound`
- [ ] Bots can play moves
- [ ] Moves are broadcasted
- [ ] Invalid moves trigger forfeit
- [ ] Game ends properly
- [ ] `gameOver` includes `eloChanges` (if bots have IDs)

### Test 6: Spectator
- [ ] Can join match with `spectate` event
- [ ] Receives `gameState` on join
- [ ] Receives `moveMade` during game
- [ ] Receives `gameOver` at end

### Test 7: Database Persistence (if configured)
- [ ] Matches appear in `matches` table
- [ ] Moves appear in `moves` table
- [ ] Bot Elo is updated in `bots` table
- [ ] Elo history is recorded in `elo_history` table

## 📊 Expected Console Output

### Server Start
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

### Bot Runner Start
```
╔════════════════════════════════════════╗
║     LLMArena Bot Runner Started        ║
╚════════════════════════════════════════╝

Waiting for matches...
```

### Match Found
```
⚔️  Match found!
   Match ID: ABC123
   Playing as: WHITE
   vs. OpponentBot (1500)
   Time per move: 30s
```

### Turn Start
```
🎯 My turn (WHITE)
   FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
   Legal moves: 20
   Timeout: 30s
   🤔 Thinking...
   ✓ Played: e2e4
   💭 Reasoning: Control the center and open lines for development...
   ⏱️  Time: 2.45s
```

### Game Over
```
🏁 Game Over (42 moves)
   Result: 1-0
   Reason: checkmate
   Winner: WHITE
   Elo change (white): +16
```

## 🚨 Common Issues

| Issue | Check | Fix |
|-------|-------|-----|
| "Database not available" | Supabase config | Either configure Supabase or ignore (works in-memory) |
| Bot can't connect | Server URL | Check `LLMARENA_SERVER` in bot .env |
| No matches created | Bot count | Need at least 2 bots for matchmaking |
| Elo not updating | DB config | Check Supabase connection and bot IDs |
| TypeScript errors | Dependencies | Run `npm install` in server and bot-runner |
| Import errors for DB | Missing export | Check `server/src/db/index.ts` exports all |

## ✨ All Green?

If all checks pass, your LLMArena is production-ready! 🎉

You now have:
- ✅ Hardened game loop with proper state transitions
- ✅ Database persistence for matches, moves, and Elo
- ✅ Robust error handling and forfeit system
- ✅ Enhanced bot runner with color tracking
- ✅ HTTP API for bot registration and profiles
- ✅ Spectator mode for live games
- ✅ Centralized configuration
- ✅ Better logging and debugging

Next: Build the frontend, add authentication, implement analysis! 🚀
