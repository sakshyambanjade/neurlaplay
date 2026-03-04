import 'dotenv/config';
import { io, Socket } from 'socket.io-client';
import { callLLMForMove, LLMConfig } from './llm';
import { detectEndpointType } from './endpoint';

type BotColor = 'white' | 'black';

interface BotRuntime {
  color: BotColor;
  name: string;
  config: LLMConfig;
  socket: Socket;
  playerSessionId: string | null;
}

interface TurnStartEvent {
  color: BotColor;
  fen: string;
  legalMoves: string[];
  pgn: string;
  timeoutSeconds: number;
}

interface MatchCreatedEvent {
  matchId: string;
  playerSessionId: string;
  color: BotColor;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envWithFallback(primary: string, fallback: string): string {
  const primaryValue = process.env[primary];
  if (primaryValue && primaryValue.trim()) return primaryValue;

  const fallbackValue = process.env[fallback];
  if (fallbackValue && fallbackValue.trim()) return fallbackValue;

  throw new Error(`Missing required environment variable: ${primary} (or fallback ${fallback})`);
}

function buildBotConfig(prefix: 'WHITE' | 'BLACK', fallbackName: string): Omit<BotRuntime, 'socket' | 'playerSessionId' | 'color'> {
  const endpointUrl = envWithFallback(`${prefix}_ENDPOINT_URL`, 'ENDPOINT_URL');

  return {
    name: process.env[`${prefix}_BOT_NAME`] || fallbackName,
    config: {
      apiKey: envWithFallback(`${prefix}_API_KEY`, 'API_KEY'),
      endpointUrl,
      model: envWithFallback(`${prefix}_MODEL`, 'MODEL'),
      endpointType: detectEndpointType(endpointUrl)
    }
  };
}

function connectSocket(serverUrl: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Timed out connecting to server'));
    }, 15000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function onceMatchCreated(socket: Socket): Promise<MatchCreatedEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for matchCreated event'));
    }, 15000);

    const onMatchCreated = (data: MatchCreatedEvent) => {
      cleanup();
      resolve(data);
    };

    const onError = (error: { code?: string; message?: string }) => {
      cleanup();
      reject(new Error(error?.message || error?.code || 'Unknown socket error'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('matchCreated', onMatchCreated);
      socket.off('error', onError);
    };

    socket.on('matchCreated', onMatchCreated);
    socket.on('error', onError);
  });
}

function sendConfig(bot: BotRuntime, matchId: string) {
  bot.socket.emit('setConfig', {
    matchId,
    playerSessionId: bot.playerSessionId,
    botName: bot.name,
    model: bot.config.model,
    endpointType: bot.config.endpointType,
    endpointUrl: bot.config.endpointUrl,
    apiKey: '__local_runner__'
  });
}

function sendReady(bot: BotRuntime, matchId: string) {
  bot.socket.emit('setReady', {
    matchId,
    playerSessionId: bot.playerSessionId
  });
}

async function runSpectatableMatch() {
  const serverUrl = process.env.LLMARENA_SERVER || 'http://localhost:3001';
  const clientUrl = process.env.LLMARENA_CLIENT || 'http://localhost:5173';

  const whiteBase = buildBotConfig('WHITE', 'WhiteBot');
  const blackBase = buildBotConfig('BLACK', 'BlackBot');

  const whiteSocket = await connectSocket(serverUrl);
  const blackSocket = await connectSocket(serverUrl);

  const white: BotRuntime = {
    color: 'white',
    socket: whiteSocket,
    playerSessionId: null,
    ...whiteBase
  };

  const black: BotRuntime = {
    color: 'black',
    socket: blackSocket,
    playerSessionId: null,
    ...blackBase
  };

  white.socket.on('error', (err) => console.error('[White socket error]', err));
  black.socket.on('error', (err) => console.error('[Black socket error]', err));

  const timeoutSeconds = Math.max(5, Math.floor(Number(process.env.MOVE_TIMEOUT_MS || 45000) / 1000));

  white.socket.emit('createMatch', {
    timeoutSeconds,
    isPublic: true,
    researchMode: false
  });

  const whiteCreated = await onceMatchCreated(white.socket);
  const matchId = whiteCreated.matchId;
  white.playerSessionId = whiteCreated.playerSessionId;

  black.socket.emit('joinMatch', { matchId });
  const blackCreated = await onceMatchCreated(black.socket);
  black.playerSessionId = blackCreated.playerSessionId;

  sendConfig(white, matchId);
  sendConfig(black, matchId);

  white.socket.emit('spectate', { matchId });
  black.socket.emit('spectate', { matchId });

  sendReady(white, matchId);
  sendReady(black, matchId);

  const watchUrl = `${clientUrl.replace(/\/$/, '')}/game/${matchId}`;

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      Spectatable LLM vs LLM Match Started       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Match ID: ${matchId}`);
  console.log(`White: ${white.name} (${white.config.model})`);
  console.log(`Black: ${black.name} (${black.config.model})`);
  console.log(`Spectate URL: ${watchUrl}`);
  console.log('');

  const botsByColor: Record<BotColor, BotRuntime> = {
    white,
    black
  };

  const processedTurnKeys = new Set<string>();
  let gameEnded = false;

  const onTurnStart = async (turn: TurnStartEvent) => {
    if (gameEnded) return;

    const key = `${turn.color}|${turn.fen}|${turn.pgn}`;
    if (processedTurnKeys.has(key)) return;
    processedTurnKeys.add(key);

    const activeBot = botsByColor[turn.color];
    const moveStart = Date.now();

    try {
      const response = await callLLMForMove({
        fen: turn.fen,
        legalMoves: turn.legalMoves,
        pgn: turn.pgn,
        color: turn.color,
        config: activeBot.config,
        timeoutMs: Math.max(1000, turn.timeoutSeconds * 1000 - 2000)
      });

      const elapsed = Date.now() - moveStart;

      activeBot.socket.emit('move', {
        matchId,
        uci: response.move,
        reasoning: response.reasoning,
        timeTakenMs: elapsed
      });

      console.log(`${turn.color.toUpperCase()} played ${response.move} in ${elapsed}ms`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${turn.color.toUpperCase()} failed to produce move: ${message}`);

      activeBot.socket.emit('forfeit', {
        matchId,
        reason: 'api_error'
      });
    }
  };

  const onMoveMade = (move: { playerColor: BotColor; san: string; uci: string }) => {
    console.log(`→ ${move.playerColor.toUpperCase()} ${move.san} (${move.uci})`);
  };

  const onGameOver = (data: { result: string; winner?: BotColor; termination: string; totalMoves: number }) => {
    if (gameEnded) return;
    gameEnded = true;

    console.log('');
    console.log('🏁 Game Over');
    console.log(`Result: ${data.result}`);
    console.log(`Reason: ${data.termination}`);
    if (data.winner) {
      console.log(`Winner: ${data.winner.toUpperCase()}`);
    }
    console.log(`Total moves: ${data.totalMoves}`);

    white.socket.disconnect();
    black.socket.disconnect();
  };

  const listeners: Array<[Socket, string, (...args: any[]) => void]> = [
    [white.socket, 'turnStart', onTurnStart],
    [black.socket, 'turnStart', onTurnStart],
    [white.socket, 'moveMade', onMoveMade],
    [white.socket, 'gameOver', onGameOver],
    [black.socket, 'gameOver', onGameOver]
  ];

  for (const [socket, event, handler] of listeners) {
    socket.on(event, handler);
  }

  process.on('SIGINT', () => {
    if (!gameEnded) {
      console.log('\nStopping match runner...');
    }

    for (const [socket, event, handler] of listeners) {
      socket.off(event, handler);
    }

    white.socket.disconnect();
    black.socket.disconnect();
    process.exit(0);
  });
}

runSpectatableMatch().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Failed to start spectatable match: ${message}`);
  process.exit(1);
});
