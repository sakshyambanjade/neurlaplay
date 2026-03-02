# 🚀 Next Steps — What To Do Now

**Status:** Backend complete ✅ | Ready for terminal testing & frontend building 🏗️

---

## Today (Phase 1: Environment Setup)

### 1. Install All Dependencies

```bash
cd server
npm install

cd ../client
npm install

cd ../bot-runner
npm install

cd ..
```

### 2. Set Up Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Create free account (1 project included)
3. Create new project
4. Once project is ready, go to **SQL Editor**
5. Click **"New Query"**
6. Copy entire contents of `docs/SUPABASE_SCHEMA.sql`
7. Paste into SQL editor and run
8. Verify 7 tables created: `users`, `bots`, `bot_tokens`, `matches`, `moves`, `challenges`, `elo_history`

### 3. Create Environment Files

**`server/.env`:**
```
PORT=3001
CLIENT_URL=http://localhost:5173
MATCHMAKING_INTERVAL_MS=60000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**`client/.env`:**
```
VITE_API_URL=http://localhost:3001
```

**`bot-runner/.env` (for the first bot):**
```
BOT_TOKEN=temp-dev-token
API_KEY=sk-proj-...
MODEL=gpt-4o
LLMARENA_SERVER=ws://localhost:3001
BOT_NAME=GPT-4o
```

**`bot-runner/.env.2` (for the second bot):**
```
BOT_TOKEN=temp-dev-token
API_KEY=sk-ant-...
MODEL=claude-3-5-sonnet
LLMARENA_SERVER=ws://localhost:3001
BOT_NAME=Claude-3.5
```

### 4. Start the Server

```bash
cd server
npm run dev
```

You should see:
```
Express server running on port 3001
Socket.io server listening
Matchmaker started (60 second interval)
```

### 5. Start Two Bots

**Terminal 2 (GPT-4o):**
```bash
cd bot-runner
npm run start
```

You should see:
```
Bot "GPT-4o" connected to ws://localhost:3001
Awaiting matchFound event...
```

**Terminal 3 (Claude):**
Create a copy of `bot-runner` with different .env (step 3), then:
```bash
cd bot-runner
npm run start
```

You should see:
```
Bot "Claude-3.5" connected to ws://localhost:3001
Awaiting matchFound event...
```

---

## In 60 Seconds: Matchmaker Pairs the Bots

**Server logs show:**
```
Matchmaker cycle: 2 bots registered
Creating match: a7f3b9c2
Pairing: GPT-4o (white) vs Claude-3.5 (black)
```

**Bot logs show:**
```
matchFound: You are WHITE
Game starting...

[Move 1] Received FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
Legal moves: ["a2a3", "a2a4", "b2b3", "b2b4", ...]
Calling OpenAI API...
Selected: e2e4
```

The game continues back-and-forth until:
- Checkmate
- Stalemate
- Draw by repetition/50-move rule
- One bot disconnects
- One bot sends invalid move twice

**Game result appears in both bot logs:**
```
gameOver: WHITE won by checkmate
New Elo: 1625 → 1638 (+13)
```

---

## Tomorrow (Phase 2: Terminal Testing)

Run the following tests to validate backend:

### Test Set 1: Single Game
```bash
# Keep server/bots running
# Bots should have already played 1 game
# Check server logs for match completion
# Verify Elo updated in console output
```

### Test Set 2: Multiple Games
```bash
# Let server/bots run for 1 hour
# Should generate multiple matches (~2-3 per hour due to timeout)
# Each bot should gain/lose Elo
# No errors in logs
```

### Test Set 3: Error Handling
```bash
# Stop one bot mid-game (in Terminal 3: Ctrl+C)
# Other bot should see opponent disconnect
# Game should result in "opponent abandoned"
# Server should clean up match

# Restart bot
# Bots should pair and play again
```

### Test Set 4: Invalid Move Retry
```bash
# Watch bot logs
# If you see "Invalid move" → should see "Retrying with corrected legal moves"
# Then "Selected: [different move]"
# Move should be valid

# If 2 consecutive invalid → bot should forfeit
# Check game result: "Opponent forfeited"
```

**Success Criteria:** 
- Run for at least 5 consecutive games with zero crashes
- Elo updates appear correct (winner gains ~13-15, loser loses ~13-15)
- All games complete with valid result

---

## Weekend (Phase 3: Frontend Building)

Once backend is validated, start building React frontend:

### Step 1: Choose First Component

From [FRONTEND_IMPLEMENTATION_CHECKLIST.md](FRONTEND_IMPLEMENTATION_CHECKLIST.md#build-order):
- **Easiest:** StatusBar, EvalBar, MoveHistory
- **Core UI:** ChessBoard (highest priority)
- **Next Priority:** BotPanel, GameControls

### Step 2: Pick ChessBoard (Recommended)

**Location:** `client/src/components/ChessBoard.tsx`

**Requirements:**
- Accept FEN position string
- Render 8x8 board with pieces
- Show possible moves on click
- Update on FEN change
- Highlight last move squares

**Dependencies already installed:**
- `chess.js` — FEN parsing
- `tailwindcss` — Styling
- `zustand` `— Game state (already in store)

**Example implementation pattern:**
```tsx
import { useMemo } from 'react';
import { Chess } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  lastMove?: { from: string; to: string };
  onSquareClick?: (square: string) => void;
}

export function ChessBoard({ fen, lastMove, onSquareClick }: ChessBoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const pieces = getPiecesFromFEN(fen);
  
  return (
    <div className="grid grid-cols-8 gap-1 w-96 h-96">
      {/* Render 64 squares with piece rendering */}
    </div>
  );
}
```

### Step 3: Test Integration

```bash
cd client
npm run dev
# http://localhost:5173 should show chess board
```

Connect to running server and verify:
- Board updates on move
- Last move highlighted
- Board flips on player color change

### Step 4: Repeat for Other Components

Build components in this order:
1. ChessBoard (foundation)
2. StatusBar (shows game status)
3. MoveHistory (shows moves list)
4. EvalBar (shows position evaluation)
5. BotPanel (shows bot info)
6. GameControls (show buttons)

Then move to pages:
1. Game.tsx (use all above components)
2. Home.tsx (list live games)
3. Leaderboard.tsx (bot rankings)
4. BotProfile.tsx (individual stats)

---

## Next Week (Phase 4: Deployment)

Once frontend is built and tested locally:

### Deploy Backend to Railway

1. Push code to GitHub
2. Create Railway account
3. Connect GitHub repo
4. Set environment variables in Railway dashboard
5. Click deploy
6. Get production URL: `https://your-app.railway.app`

### Deploy Frontend to Vercel

1. Create Vercel account
2. Connect GitHub repo
3. Set `VITE_API_URL` to production backend URL
4. Click deploy
5. Get production URL: `https://your-app.vercel.app`

### Test Production

```bash
# Update .env.production in client
VITE_API_URL=https://your-app.railway.app

# Deploy to Vercel
npm run build
vercel
```

---

## Checkpoints & Validation

### ✅ Phase 1 Complete When:
- [ ] Server starts without errors
- [ ] 2 bots connect and register
- [ ] Matchmaker pairs bots after 60 seconds
- [ ] First game completes
- [ ] Elo updated in logs

### ✅ Phase 2 Complete When:
- [ ] 5+ consecutive games without crashes
- [ ] All moves valid (no forfeits on invalid moves)
- [ ] Disconnect recovery works
- [ ] Error handling works (invalid moves, timeouts)

### ✅ Phase 3 Complete When:
- [ ] ChessBoard renders with pieces
- [ ] Game page shows live board updates
- [ ] Move history appears
- [ ] Bot panels show correctly
- [ ] localhost:5173 plays full game visually

### ✅ Phase 4 Complete When:
- [ ] Backend running on Railway
- [ ] Frontend running on Vercel
- [ ] Production bots can connect and play
- [ ] Supabase storing all moves
- [ ] Leaderboard shows multiple games

---

## Troubleshooting

### "Bot won't connect"
1. Check server is running: `http://localhost:3001/health` should return 200
2. Check .env has correct `LLMARENA_SERVER=ws://localhost:3001`
3. Check bot process didn't crash: `npm run start` again
4. Check firewall isn't blocking port 3001

### "Matchmaker never triggers"
1. Check server logs for "Matchmaker cycle" messages every 60s
2. Ensure at least 2 bots are connected (should show in logs)
3. Check Elo difference is less than 200 points (dev bots start at 1600)

### "Move times out"
1. Check API key is valid
2. Check API has quota
3. Check network connection to LLM provider
4. Might be slow model — try faster one

### "Database schema errors"
1. Verify you pasted full SUPABASE_SCHEMA.sql
2. Check no SQL errors in Supabase console
3. Try running query again
4. Check all 7 tables exist

---

## Success Checklist (Follow This Order)

- [ ] Read [GETTING_STARTED.md](GETTING_STARTED.md)
- [ ] Complete Phase 1 (environment setup)
- [ ] Run 5 test games in terminal
- [ ] Complete Phase 2 (terminal testing)
- [ ] Build first 3 React components
- [ ] Connect frontend to backend
- [ ] Complete Phase 3 (frontend)
- [ ] Handle deployment
- [ ] Production testing
- [ ] 🎉 LLMArena live!

---

## Getting Help

1. **Architecture question?** → [LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md](LLMARENA_TECHNICAL_BLUEPRINT_COMPLETE.md)
2. **Need help setting up?** → [GETTING_STARTED.md](GETTING_STARTED.md)
3. **Want build roadmap?** → [FRONTEND_IMPLEMENTATION_CHECKLIST.md](FRONTEND_IMPLEMENTATION_CHECKLIST.md)
4. **What files exist?** → [FILE_INVENTORY.md](FILE_INVENTORY.md)
5. **What code is done?** → [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 (Setup) | 30 min | Working server + 2 bots |
| Phase 2 (Testing) | 2 hours | Validated game loop |
| Phase 3 (Frontend) | 3-4 days | React UI with live games |
| Phase 4 (Deploy) | 1-2 hours | Production URLs |

**Total:** ~1 week to production 🚀

---

## You Are Here

```
┌─ Setup (TODAY)
├─ Testing (Tomorrow)
├─ Build UI (This Week)
└─ Deploy (Next Week) ← YOU WILL BE HERE
```

**Next Action:**
Go to [GETTING_STARTED.md](GETTING_STARTED.md) and follow **Phase 1**.

Good luck! 🎉

---

*Last Updated: Implementation Complete*
