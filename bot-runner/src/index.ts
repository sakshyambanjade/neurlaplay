/**
 * LLMArena Bot Runner
 * 
 * This is what bot owners run on their own machine.
 * It holds the API key, connects to LLMArena via Socket.io,
 * receives turn signals, calls the LLM, and sends moves back.
 */

import { io, Socket } from 'socket.io-client';
import { callLLMForMove } from './llm';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const API_KEY = process.env.API_KEY!;
const ENDPOINT_URL = process.env.ENDPOINT_URL!;
const MODEL = process.env.MODEL!;
const SERVER_URL = process.env.LLMARENA_SERVER || 'https://llmarena.app';
const BOT_NAME = process.env.BOT_NAME || 'AnonymousBot';

if (!BOT_TOKEN || !API_KEY || !ENDPOINT_URL || !MODEL) {
  console.error('❌ Missing environment variables. Set:');
  console.error('   BOT_TOKEN (from bot registration)');
  console.error('   API_KEY (your LLM API key)');
  console.error('   ENDPOINT_URL (your LLM endpoint)');
  console.error('   MODEL (your LLM model name)');
  process.exit(1);
}

let socket: Socket;
let currentMatchId: string | null = null;
let currentColor: 'white' | 'black' | null = null;

// Track match info for proper Elo logging
const matchInfo: Record<string, { color: 'white' | 'black' }> = {};

function connect() {
  socket = io(SERVER_URL, {
    auth: { token: BOT_TOKEN },
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionDelayMax: 30000
  });

  socket.on('connect', () => {
    console.log('✅ Connected to LLMArena');
    console.log(`   Server: ${SERVER_URL}`);
    console.log(`   Bot: ${BOT_NAME}`);
    console.log(`   Model: ${MODEL}`);
    console.log(`   Endpoint: ${ENDPOINT_URL}`);
    console.log(' ');

    // Register bot with matchmaker pool
    const botId = `bot-${Date.now()}`;
    socket.emit('registerBot', {
      botId,
      botName: BOT_NAME,
      elo: 1500
    });
  });

  socket.on('authenticated', ({ botId, botName }: { botId: string; botName: string }) => {
    console.log(`🤖 Authenticated as: ${botName} (${botId})`);
  });

  socket.on('matchFound', handleMatchFound);
  socket.on('turnStart', handleTurnStart);
  socket.on('gameOver', handleGameOver);
  socket.on('moveMade', handleMoveMade);
  socket.on('forfeit', handleForfeit);
  socket.on('error', handleError);
  socket.on('disconnect', () => {
    console.log('⚠️  Disconnected from LLMArena — reconnecting...');
  });
}

async function handleMatchFound({
  matchId,
  color,
  opponentName,
  opponentElo,
  timeoutSeconds
}: {
  matchId: string;
  color: 'white' | 'black';
  opponentName: string;
  opponentElo: number;
  timeoutSeconds: number;
}) {
  currentMatchId = matchId;
  currentColor = color;
  
  // Store match info for Elo logging
  matchInfo[matchId] = { color };
  
  console.log(`⚔️  Match found!`);
  console.log(`   Match ID: ${matchId}`);
  console.log(`   Playing as: ${color.toUpperCase()}`);
  console.log(`   vs. ${opponentName} (${opponentElo})`);
  console.log(`   Time per move: ${timeoutSeconds}s`);
}

async function handleTurnStart({
  matchId,
  color,
  fen,
  legalMoves,
  pgn,
  timeoutSeconds
}: {
  matchId: string;
  color: 'white' | 'black';
  fen: string;
  legalMoves: string[];
  pgn: string;
  timeoutSeconds: number;
}) {
  if (matchId !== currentMatchId) return;

  console.log(`\n🎯 My turn (${color.toUpperCase()})`);
  console.log(`   FEN: ${fen}`);
  console.log(`   Legal moves: ${legalMoves.length}`);
  console.log(`   Timeout: ${timeoutSeconds}s`);
  
  const start = Date.now();

  try {
    console.log(`   🤔 Thinking...`);

    const result = await callLLMForMove({
      fen,
      legalMoves,
      pgn,
      color,
      config: {
        apiKey: API_KEY,
        endpointUrl: ENDPOINT_URL,
        model: MODEL,
        endpointType: detectEndpointType(ENDPOINT_URL)
      },
      timeoutMs: (timeoutSeconds - 3) * 1000 // 3s buffer
    });

    const timeTaken = Date.now() - start;
    console.log(`   ✓ Played: ${result.move}`);
    console.log(`   💭 Reasoning: ${result.reasoning.substring(0, 150)}${result.reasoning.length > 150 ? '...' : ''}`);
    console.log(`   ⏱️  Time: ${(timeTaken / 1000).toFixed(2)}s`);

    socket.emit('move', {
      matchId,
      uci: result.move,
      reasoning: result.reasoning,
      timeTakenMs: timeTaken
    });
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);

    let reason = 'api_error';
    if (err.message.includes('TIMEOUT')) reason = 'timeout';
    else if (err.message.includes('QUOTA')) reason = 'api_quota';
    else if (err.message.includes('UNAUTHORIZED')) reason = 'api_unauthorized';
    else if (err.message.includes('INVALID')) reason = 'invalid_move';

    socket.emit('forfeit', { matchId, reason });
  }
}

function handleMoveMade({
  moveNumber,
  playerColor,
  uci,
  san,
  reasoning
}: {
  moveNumber: number;
  playerColor: 'white' | 'black';
  uci: string;
  san: string;
  reasoning: string;
}) {
  console.log(`   → ${playerColor === 'white' ? 'White' : 'Black'} played: ${san} (${uci})`);
  if (reasoning) {
    console.log(`     "${reasoning}"`);
  }
}

function handleGameOver({
  result,
  winner,
  termination,
  totalMoves,
  eloChanges
}: {
  result: '1-0' | '0-1' | '1/2-1/2';
  winner?: 'white' | 'black';
  termination: string;
  totalMoves: number;
  eloChanges?: { white: number; black: number };
}) {
  console.log(`\n🏁 Game Over (${totalMoves} moves)`);
  console.log(`   Result: ${result}`);
  console.log(`   Reason: ${termination}`);
  if (winner) {
    console.log(`   Winner: ${winner.toUpperCase()}`);
  }
  
  // Show Elo change with correct color
  if (eloChanges && currentMatchId && matchInfo[currentMatchId]) {
    const myColor = matchInfo[currentMatchId].color;
    const myChange = eloChanges[myColor];
    console.log(`   Elo change (${myColor}): ${myChange > 0 ? '+' : ''}${myChange}`);
    
    // Clean up match info
    delete matchInfo[currentMatchId];
  }

  currentMatchId = null;
  currentColor = null;
}

function handleForfeit({
  loserColor,
  reason,
  message
}: {
  loserColor: 'white' | 'black';
  reason: string;
  message?: string;
}) {
  console.log(`\n⚠️  Forfeit: ${loserColor} (${reason})`);
  if (message) {
    console.log(`   ${message}`);
  }
}

function handleError({ code, message }: { code: string; message: string }) {
  console.error(`❌ Server error: ${code} - ${message}`);
}

fuif (url.includes('together.ai') || url.includes('together.xyz')) return 'openai'; // OpenAI-compatible
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'custom'; // Local models
  return 'custom';
}

// Start the runner
connect();

console.log('╔════════════════════════════════════════╗');
console.log('║     LLMArena Bot Runner Started        ║');
console.log('╚════════════════════════════════════════╝'
console.log('🚀 LLMArena Bot Runner Started');
console.log(`   Server: ${SERVER_URL}`);
console.log(`   Model: ${MODEL}`);
console.log(`   Endpoint: ${ENDPOINT_URL}`);
console.log('');
console.log('Waiting for matches...\n');
