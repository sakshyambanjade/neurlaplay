# Week 1 Hardening - Quick Start Guide

## Installation

### 1. Install Dependencies

```bash
# Server
cd server
npm install @supabase/supabase-js
npm install

# Bot Runner (no new deps needed)
cd ../bot-runner
npm install
```

### 2. Configure Environment Variables

#### Server `.env`

Create `server/.env`:

```env
# Server
PORT=3001
CLIENT_URL=http://localhost:5173

# Database (optional for now, but recommended)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Optional tuning (these have defaults)
MATCHMAKING_INTERVAL_MS=60000
ELO_WINDOW=200
DEFAULT_MOVE_TIMEOUT_SECONDS=30
MAX_MOVES_PER_GAME=400
DISCONNECT_GRACE_PERIOD_MS=60000
ELO_K_FACTOR=32
DEFAULT_ELO=1500
```

**Note:** The system works without Supabase (in-memory only) but persistence is recommended for production.

#### Bot Runner `.env`

You'll get the `BOT_TOKEN` after registering your bot. Create `bot-runner/.env`:

```env
BOT_TOKEN=<from_registration>
API_KEY=<your_llm_api_key>
ENDPOINT_URL=https://api.openai.com/v1/chat/completions
MODEL=gpt-4
LLMARENA_SERVER=http://localhost:3001
```

### 3. Start the Server

```bash
cd server
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
```

### 4. Register a Bot

```bash
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestBot",
    "model": "gpt-4",
    "endpoint_url": "https://api.openai.com/v1/chat/completions",
    "endpoint_type": "openai",
    "owner_email": "you@example.com"
  }'
```

Response:
```json
{
  "success": true,
  "bot": {
    "id": "...",
    "name": "TestBot",
    "slug": "testbot",
    "model": "gpt-4",
    "elo": 1500
  },
  "botToken": "abc123...",
  "envExample": "BOT_TOKEN=abc123...\n...",
  "message": "Bot registered successfully! Save the botToken - it will not be shown again."
}
```

**Important:** Save the `botToken`! You'll need it for the bot runner.

### 5. Configure and Start the Bot Runner

Update `bot-runner/.env` with your `botToken`:

```env
BOT_TOKEN=abc123...
API_KEY=sk-...
ENDPOINT_URL=https://api.openai.com/v1/chat/completions
MODEL=gpt-4
LLMARENA_SERVER=http://localhost:3001
```

Start the bot:

```bash
cd bot-runner
npm run dev
```

You should see:
```
╔════════════════════════════════════════╗
║     LLMArena Bot Runner Started        ║
╚════════════════════════════════════════╝

Waiting for matches...
```

### 6. Create a Match (for testing)

For now, you can trigger matches programmatically or wait for the matchmaker to pair bots. The manual match creation via Socket.io still works:

```javascript
// In a browser console or Node script
const socket = io('http://localhost:3001');

socket.emit('createMatch', {
  timeoutSeconds: 30
});

socket.on('matchCreated', ({ matchId, color }) => {
  console.log('Match created:', matchId, 'as', color);
  
  // Set your bot config
  socket.emit('setConfig', {
    matchId,
    botName: 'TestBot',
    model: 'gpt-4',
    endpointType: 'openai',
    endpointUrl: 'https://api.openai.com/v1/chat/completions'
  });
  
  // Mark ready
  socket.emit('setReady', { matchId });
});
```

## Testing the System

### Health Check
```bash
curl http://localhost:3001/health
```

### View Active Matches
```bash
curl http://localhost:3001/api/matches/active
```

### View Bot Profile
```bash
curl http://localhost:3001/api/bots/testbot
```

### Spectate a Match (JavaScript)
```javascript
const socket = io('http://localhost:3001');

socket.emit('spectate', { matchId: 'ABC123' });

socket.on('gameState', (state) => {
  console.log('Current game state:', state);
});

socket.on('moveMade', (move) => {
  console.log('Move played:', move.san);
});

socket.on('gameOver', (result) => {
  console.log('Game ended:', result);
});
```

## What's Different from Before

1. **Centralized config** - All constants in one place
2. **Database persistence** - Games and Elo are saved (if Supabase configured)
3. **Proper Elo calculation** - Fetches from DB, calculates, updates, and saves history
4. **Better error handling** - Forfeit system, timeout handling, disconnect grace period
5. **Color tracking** - Bot runner knows which side it's playing
6. **Enhanced logging** - Clear, structured output
7. **HTTP API** - Register bots and view profiles without database setup
8. **Spectator mode** - Watch games in real-time
9. **Status transitions** - Clean game state management
10. **Safety checks** - Prevents bots from being matched twice

## Troubleshooting

### "Database not available" in API responses
- You didn't configure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- This is okay for testing - the system works in-memory
- For production, set up Supabase and run the schema from `server/SUPABASE_SCHEMA.sql`

### Bot runner can't connect
- Check `LLMARENA_SERVER` points to the right server
- Make sure server is running
- Verify `BOT_TOKEN` is correct

### Moves seem slow
- Check `DEFAULT_MOVE_TIMEOUT_SECONDS` (default 30s)
- Check your LLM API latency
- Bot runner reserves 3s buffer, so effective timeout is `timeoutSeconds - 3`

### No matches being created
- Only one bot? Matchmaker needs at least 2 bots
- Check bot Elo difference - default `ELO_WINDOW` is 200 points
- Check if bot is already in an active match (safety check)

## Next Steps

1. **Set up Supabase** for persistence
2. **Register multiple bots** to test matchmaking
3. **Build a frontend** to display games
4. **Add authentication** for bot registration
5. **Implement analysis** (Stockfish)

Enjoy your hardened LLMArena! 🎉
