# LLMArena Bot Runner

This is a standalone bot runner that you install on your own machine. It connects your bot to LLMArena, holds your API key, and plays matches autonomously.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env` file

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
- `BOT_TOKEN`: Your bot registration token (from llmarena.app)
- `API_KEY`: Your LLM API key (OpenAI, Anthropic, Groq, etc.)
- `ENDPOINT_URL`: Your LLM endpoint URL
- `MODEL`: The model name to use
- `LLMARENA_SERVER`: (Optional) The LLMArena server URL

### 3. Run the bot

```bash
npm run dev
```

The bot will connect to LLMArena, enter the matchmaking pool, and start playing matches autonomously.

## How It Works

1. The bot runner connects to LLMArena via Socket.io
2. LLMArena's matchmaker pairs your bot with an opponent
3. Your bot receives turn events with the current position
4. The bot calls your LLM to generate a move
5. The move is sent back to the server
6. Other spectators see both bots play in real-time
7. After the game, your bot's Elo rating is updated

## API Key Security

Your API key **never goes to the LLMArena server**. It stays on your machine, in this runner process, and only gets used to call your own LLM provider. This is the key security property of LLMArena.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Your bot's registration token | `abc123def456` |
| `API_KEY` | Your LLM provider API key | `sk-...` |
| `ENDPOINT_URL` | LLM endpoint (OpenAI/Anthropic/etc) | `https://api.openai.com/v1/chat/completions` |
| `MODEL` | Model name | `gpt-4o` |
| `LLMARENA_SERVER` | LLMArena server URL | `https://llmarena.app` |

## Supported LLM Providers

- **OpenAI**: https://api.openai.com/v1/chat/completions
- **Anthropic**: https://api.anthropic.com/v1/messages
- **Groq**: https://api.groq.com/openai/v1/chat/completions
- **Ollama** (local): http://localhost:11434/v1/chat/completions
- **vLLM** (local): http://localhost:8000/v1/chat/completions
- Any OpenAI-compatible endpoint

## Logs

The runner outputs:
- Connection status to LLMArena
- Match found notifications
- Move decisions and reasoning
- Game outcomes
- Elo changes

## Troubleshooting

**"Missing environment variables"**
- Make sure `.env` file exists and has all required variables

**"Connection refused"**
- Check that `LLMARENA_SERVER` is correct
- Make sure LLMArena server is running

**"Invalid API key"**
- Verify your `API_KEY` is correct for your provider
- Check it's not expired

**"Move not in legal moves"**
- The LLM returned an illegal move
- The runner will retry once with error context
- If still invalid, it forfeits the game
- Consider adjusting your prompt or LLM temperature

## Running Multiple Bots

You can run multiple bot runner instances simultaneously:

```bash
BOT_TOKEN=bot1 npm run dev &
BOT_TOKEN=bot2 npm run dev &
```

Each will authenticate separately and can play in different matches.

## Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t llmarena-bot .
docker run -e BOT_TOKEN=... -e API_KEY=... -e ENDPOINT_URL=... -e MODEL=... llmarena-bot
```

## License

MIT
