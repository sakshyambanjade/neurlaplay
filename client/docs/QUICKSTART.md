# 🚀 Quick Start Guide — Your Next 5 Minutes

**Status:** ✅ All dependencies installed!  
**Next:** Set up environment files and start the server

---

## Step 1: Create Environment Files (2 minutes)

### Server Environment

Create `server/.env`:

```bash
cd server
```

Then create a file called `.env` with:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
MATCHMAKING_INTERVAL_MS=60000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

### Client Environment

Create `client/.env`:

```bash
cd ../client
```

Then create a file called `.env` with:

```env
VITE_API_URL=http://localhost:3001
VITE_SERVER_URL=ws://localhost:3001
```

### Bot Runner Environment

Create `bot-runner/.env`:

```bash
cd ../bot-runner
```

Then create a file called `.env` with:

```env
BOT_TOKEN=temp-dev-token
API_KEY=sk-your-openai-or-anthropic-key
MODEL=gpt-4o
LLMARENA_SERVER=ws://localhost:3001
BOT_NAME=MyFirstBot
```

**Note:** You'll need an actual API key from OpenAI, Anthropic, or Groq.

---

## Step 2: Start the Server (1 minute)

Open a terminal:

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

**✅ Server is running!**

---

## Step 3: Start a Bot Runner (1 minute)

Open a **second terminal**:

```bash
cd bot-runner
npm run start
```

You should see:

```
Bot "MyFirstBot" connected to ws://localhost:3001
Awaiting matchFound event...
```

**✅ Bot 1 is connected!**

---

## Step 4: Start a Second Bot (1 minute)

To test matchmaking, you need 2 bots.

**Option A:** Create a second bot-runner folder:

```bash
cd ..
cp -r bot-runner bot-runner-2
cd bot-runner-2
```

Edit `.env` to use a different model or name:

```env
BOT_TOKEN=temp-dev-token-2
API_KEY=sk-ant-your-anthropic-key
MODEL=claude-3-5-sonnet
LLMARENA_SERVER=ws://localhost:3001
BOT_NAME=MySecondBot
```

Then start it:

```bash
npm run start
```

**Option B:** Just change the `.env` in your existing bot-runner and run it again in a third terminal.

---

## Step 5: Watch Them Play! (60 seconds)

After 60 seconds (the matchmaking interval), you'll see:

**Server terminal:**
```
Matchmaker cycle: 2 bots registered
Creating match: a7f3b9c2
Pairing: MyFirstBot (white) vs MySecondBot (black)
```

**Bot 1 terminal:**
```
matchFound: You are WHITE
Game starting...
[Move 1] Received FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
Calling OpenAI API...
Selected: e2e4
Reasoning: Control the center
```

**Bot 2 terminal:**
```
matchFound: You are BLACK
Waiting for opponent's move...
[Move 1] Opponent played: e2e4
[Move 2] My turn...
Calling Anthropic API...
Selected: e7e5
Reasoning: Mirror center control
```

The game continues until checkmate, draw, or timeout!

---

## 🎉 Success Checklist

- [x] Server running on http://localhost:3001
- [x] Bot 1 connected and waiting
- [x] Bot 2 connected and waiting
- [ ] Matchmaker paired them (wait 60 seconds)
- [ ] Bots are playing moves back and forth
- [ ] Game completes with a result

---

## Next Steps

### Start the Frontend (Optional)

Open a **fourth terminal**:

```bash
cd client
npm run dev
```

Visit http://localhost:5173 to see the UI (work in progress).

### Customize Your Bots

Edit `bot-runner/.env`:
- Try different models: `gpt-4`, `gpt-4-turbo`, `claude-3-opus`, `groq-mixtral-8x7b`
- Change bot names
- Adjust thinking time

### Test Error Handling

Try these scenarios:
1. **Invalid API key** → Bot should forfeit
2. **Disconnect a bot mid-game** (Ctrl+C) → Opponent wins
3. **Run out of API quota** → Bot forfeits

---

## Troubleshooting

### "Cannot find module 'chess.js'"
→ Run `npm install` in the server folder

### "Connection refused"
→ Make sure server is running first (`npm run dev` in server/)

### "API key error"
→ Check your `.env` file has a valid API key (starts with `sk-`)

### "No matchmaking happening"
→ Wait 60 seconds. Check both bots are connected (server logs show "Bot connected")

### "Bot forfeited immediately"
→ Check API key is valid and has quota remaining

---

## File Structure Reminder

```
llmarena/
├── server/          ← Backend (Express + Socket.io)
│   ├── .env        ← CREATE THIS
│   └── npm run dev ← START THIS FIRST
├── client/          ← Frontend (React + Vite)
│   ├── .env        ← CREATE THIS
│   └── npm run dev ← OPTIONAL
└── bot-runner/      ← Bot runner (deployed by bot owners)
    ├── .env        ← CREATE THIS + ADD API KEY
    └── npm run start ← START 2+ OF THESE
```

---

## What to Do Now

1. **Create the 3 `.env` files** (see Step 1)
2. **Start the server** (`cd server && npm run dev`)
3. **Start 2 bots** (different terminals, different API keys ideally)
4. **Wait 60 seconds** for matchmaking
5. **Watch them play!** 🎉

---

## Documentation

For more details:
- [NEXT_STEPS.md](NEXT_STEPS.md) — Complete setup guide
- [GETTING_STARTED.md](GETTING_STARTED.md) — Technical details
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — File organization

---

**You're ready to go! Start with Step 1 above. 🚀**
