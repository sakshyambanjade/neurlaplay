import 'dotenv/config';
import { Chess } from 'chess.js';
import { callLLMForMove, LLMConfig } from './llm';
import { detectEndpointType } from './endpoint';

type BotColor = 'white' | 'black';

interface LocalBotConfig {
  name: string;
  llm: LLMConfig;
}

interface LocalResult {
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  termination: string;
  winner?: BotColor;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function envWithFallback(primary: string, fallback: string): string {
  const primaryValue = process.env[primary];
  if (primaryValue && primaryValue.trim()) return primaryValue;

  const fallbackValue = process.env[fallback];
  if (fallbackValue && fallbackValue.trim()) return fallbackValue;

  console.error(`❌ Missing required environment variable: ${primary} (or fallback ${fallback})`);
  process.exit(1);
}

function buildBotConfig(prefix: 'WHITE' | 'BLACK', fallbackName: string): LocalBotConfig {
  const endpointUrl = envWithFallback(`${prefix}_ENDPOINT_URL`, 'ENDPOINT_URL');

  return {
    name: process.env[`${prefix}_BOT_NAME`] || fallbackName,
    llm: {
      apiKey: envWithFallback(`${prefix}_API_KEY`, 'API_KEY'),
      endpointUrl,
      model: envWithFallback(`${prefix}_MODEL`, 'MODEL'),
      endpointType: detectEndpointType(endpointUrl)
    }
  };
}

function legalMovesUci(chess: Chess): string[] {
  return chess.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion || ''}`);
}

function applyUciMove(chess: Chess, uci: string): boolean {
  try {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
    return !!chess.move({ from, to, promotion });
  } catch {
    return false;
  }
}

function summarizeResult(chess: Chess, moveCapReached: boolean): LocalResult {
  if (moveCapReached) {
    return { result: '1/2-1/2', termination: 'move_cap' };
  }

  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'black' : 'white';
    return {
      result: winner === 'white' ? '1-0' : '0-1',
      termination: 'checkmate',
      winner
    };
  }

  if (chess.isStalemate()) return { result: '1/2-1/2', termination: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', termination: 'threefold_repetition' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', termination: 'insufficient_material' };
  if (chess.isDraw()) return { result: '1/2-1/2', termination: 'draw' };

  return { result: '*', termination: 'in_progress' };
}

async function runLocalMatch() {
  const white = buildBotConfig('WHITE', 'WhiteBot');
  const black = buildBotConfig('BLACK', 'BlackBot');

  const timeoutMs = Number(process.env.MOVE_TIMEOUT_MS || 45000);
  const maxPlies = Number(process.env.MAX_PLIES || 300);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    console.error('❌ MOVE_TIMEOUT_MS must be a number >= 1000');
    process.exit(1);
  }

  if (!Number.isFinite(maxPlies) || maxPlies < 2) {
    console.error('❌ MAX_PLIES must be a number >= 2');
    process.exit(1);
  }

  const chess = new Chess();
  let ply = 0;

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║           Local LLM vs LLM Chess Match          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`White: ${white.name} (${white.llm.model})`);
  console.log(`Black: ${black.name} (${black.llm.model})`);
  console.log(`Timeout per move: ${timeoutMs}ms`);
  console.log(`Max plies: ${maxPlies}`);
  console.log('');

  while (!chess.isGameOver() && ply < maxPlies) {
    const turn: BotColor = chess.turn() === 'w' ? 'white' : 'black';
    const active = turn === 'white' ? white : black;
    const legalMoves = legalMovesUci(chess);
    const fen = chess.fen();
    const pgn = chess.pgn();

    console.log(`Ply ${ply + 1} - ${active.name} (${turn.toUpperCase()})`);

    const startedAt = Date.now();
    const response = await callLLMForMove({
      fen,
      legalMoves,
      pgn,
      color: turn,
      config: active.llm,
      timeoutMs
    });

    const ok = applyUciMove(chess, response.move);
    const elapsedMs = Date.now() - startedAt;

    if (!ok) {
      const winner: BotColor = turn === 'white' ? 'black' : 'white';
      const result = winner === 'white' ? '1-0' : '0-1';

      console.log(`❌ Illegal move by ${active.name}: ${response.move}`);
      console.log(`Result: ${result} (illegal_move)`);
      console.log(`Winner: ${winner.toUpperCase()}`);
      console.log('');
      console.log('Final PGN:');
      console.log(chess.pgn() || '(empty)');
      return;
    }

    const history = chess.history({ verbose: true });
    const lastMove = history[history.length - 1];

    console.log(`  Move: ${lastMove?.san || response.move} (${response.move})`);
    console.log(`  Time: ${elapsedMs}ms`);
    console.log(`  Reason: ${response.reasoning.substring(0, 160)}${response.reasoning.length > 160 ? '...' : ''}`);
    console.log('');

    ply += 1;
  }

  const summary = summarizeResult(chess, ply >= maxPlies);

  console.log('🏁 Match complete');
  console.log(`Result: ${summary.result}`);
  console.log(`Termination: ${summary.termination}`);
  if (summary.winner) {
    console.log(`Winner: ${summary.winner.toUpperCase()}`);
  }
  console.log('');
  console.log('Final PGN:');
  console.log(chess.pgn() || '(empty)');
}

runLocalMatch().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Local match failed: ${message}`);
  process.exit(1);
});
