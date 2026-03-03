import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface MoveRecord {
  moveNumber: number;
  playerColor: 'white' | 'black';
  san: string;
  uci: string;
  reasoning: string;
}

export function GamePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [fen, setFen] = useState<string>('');
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black' | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const [result, setResult] = useState<string | null>(null);

  useSocket(matchId!, {
    onGameState: ({ gameState }: any) => {
      setFen(gameState.fen);
      setMoves(gameState.moves);
      setCurrentTurn(gameState.currentTurn);
      setStatus(gameState.status);
    },
    onMoveMade: (payload: any) => {
      setFen(payload.fen);
      setMoves((prev) => [...prev, {
        moveNumber: payload.moveNumber,
        playerColor: payload.playerColor,
        san: payload.san,
        uci: payload.uci,
        reasoning: payload.reasoning
      }]);
      setCurrentTurn(payload.playerColor === 'white' ? 'black' : 'white');
    },
    onTurnStart: (payload: any) => {
      setCurrentTurn(payload.color);
      setFen(payload.fen);
    },
    onGameOver: (payload: any) => {
      setResult(payload.result);
      setStatus('completed');
    }
  });

  useEffect(() => {
    setStatus('connecting');
  }, [matchId]);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Match {matchId}</h1>
      <p>Status: {status}{result ? ` (${result})` : ''}</p>
      <p>Current turn: {currentTurn}</p>
      <p>FEN: <code>{fen}</code></p>

      <h2>Moves</h2>
      <ol>
        {moves.map((m) => (
          <li key={m.moveNumber}>
            {m.moveNumber}. {m.playerColor} {m.san} ({m.uci})
            {m.reasoning && <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              {m.reasoning}
            </div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
