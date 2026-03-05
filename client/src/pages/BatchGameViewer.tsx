import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';

interface MoveRecord {
  moveNumber: number;
  color: 'white' | 'black';
  move: string;
  fen: string;
  confidence: number;
  spikeEfficiency: number;
  latencyMs: number;
  reasoning: string;
  timestamp: string;
}

interface GameRecord {
  matchId: string;
  timestamp: string;
  whiteBotName: string;
  whiteModel: string;
  blackBotName: string;
blackModel: string;     
  result: 'white' | 'black' | 'draw';
  pgn: string;
  fen: string;
  moves: MoveRecord[];
  totalMoves: number;
  gameStatus: string;
  duration_ms: number;
}

/**
 * BatchGameViewer - View completed batch games with chessboard
 */
export function BatchGameViewer() {
  const { matchId } = useParams<{ matchId: string }>();
  const [game, setGame] = useState<GameRecord | null>(null);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [boardPosition, setBoardPosition] = useState('start');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    const fetchGame = async () => {
      if (!matchId) return;

      try {
        const response = await fetch(`/api/games/${matchId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Game not found');
          } else {
            throw new Error('Failed to fetch game');
          }
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        setGame(data.game);

        // Fetch moves
        const movesResponse = await fetch(`/api/games/${matchId}/moves`);
        if (movesResponse.ok) {
          const movesData = await movesResponse.json();
          setMoves(movesData.moves);
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchGame();
  }, [matchId]);

  // Auto-play moves
  useEffect(() => {
    if (!autoPlay || currentMoveIndex >= moves.length - 1) {
      setAutoPlay(false);
      return;
    }

    const timer = setTimeout(() => {
      nextMove();
    }, 1500);

    return () => clearTimeout(timer);
  }, [autoPlay, currentMoveIndex, moves.length]);

  // Update board position when move index changes
  useEffect(() => {
    if (currentMoveIndex < 0) {
      setBoardPosition('start');
      return;
    }

    if (currentMoveIndex >= moves.length) {
      return;
    }

    const move = moves[currentMoveIndex];
    if (move && move.fen) {
      setBoardPosition(move.fen);
    }
  }, [currentMoveIndex, moves]);

  const nextMove = () => {
    if (currentMoveIndex < moves.length - 1) {
      setCurrentMoveIndex(currentMoveIndex + 1);
    }
  };

  const prevMove = () => {
    if (currentMoveIndex >= 0) {
      setCurrentMoveIndex(currentMoveIndex - 1);
    }
  };

  const jumpToStart = () => {
    setCurrentMoveIndex(-1);
    setAutoPlay(false);
  };

  const jumpToEnd = () => {
    setCurrentMoveIndex(moves.length - 1);
    setAutoPlay(false);
  };

  const toggleAutoPlay = () => {
    setAutoPlay(!autoPlay);
  };

  if (!matchId) {
    return <div style={{ padding: '2rem' }}>No match ID provided</div>;
  }

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading game...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#ef4444' }}>Error: {error}</div>;
  }

  if (!game) {
    return <div style={{ padding: '2rem' }}>Game not found</div>;
  }

  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/batch-research" style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← Back to Batch Research
        </Link>
      </div>

      <h1 style={{ marginBottom: '0.5rem' }}>{game.whiteBotName} vs {game.blackBotName}</h1>
      <div style={{ color: '#666', marginBottom: '2rem', display: 'flex', gap: '2rem' }}>
        <span>Result: {game.result === 'white' ? '1-0' : game.result === 'black' ? '0-1' : '½-½'}</span>
        <span>Moves: {game.totalMoves}</span>
        <span>Duration: {(game.duration_ms / 1000).toFixed(1)}s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 600px', gap: '2rem' }}>
        {/* Moves List */}
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Move History</h2>
          <div style={{ 
            background: 'white', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px',
            maxHeight: '600px',
            overflowY: 'auto',
            padding: '1rem'
          }}>
            {moves.map((move, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentMoveIndex(idx)}
                style={{
                  padding: '0.75rem',
                  background: currentMoveIndex === idx ? '#dbeafe' : 'transparent',
                  borderLeft: `3px solid ${currentMoveIndex === idx ? '#3b82f6' : 'transparent'}`,
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '50px 60px 120px 1fr',
                  gap: '1rem',
                  alignItems: 'center',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = currentMoveIndex === idx ? '#dbeafe' : 'transparent'}
              >
                <span style={{ fontWeight: '600' }}>{move.moveNumber}.</span>
                <span>{move.color === 'white' ? '⚪' : '⚫'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{move.move}</span>
                <span style={{ color: '#666', fontSize: '0.875rem' }}>
                  Confidence: {(move.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          {currentMove && (
            <div style={{ 
              marginTop: '1rem',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Move Details</h3>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                <div><strong>Move:</strong> {currentMove.move}</div>
                <div><strong>Confidence:</strong> {(currentMove.confidence * 100).toFixed(1)}%</div>
                <div><strong>SNN Efficiency:</strong> {(currentMove.spikeEfficiency * 100).toFixed(1)}%</div>
                <div><strong>Time:</strong> {currentMove.latencyMs}ms</div>
                {currentMove.reasoning && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>Reasoning:</strong>
                    <div style={{ 
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      background: '#f9fafb',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      color: '#666'
                    }}>
                      {currentMove.reasoning}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chessboard */}
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{game.whiteBotName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>{game.whiteModel}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '600' }}>{game.blackBotName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>{game.blackModel}</div>
                </div>
              </div>
            </div>

            <Chessboard 
              position={boardPosition}
              boardWidth={600}
              arePiecesDraggable={false}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)'
              }}
            />

            {/* Controls */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={jumpToStart}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ⏮ Start
              </button>
              <button
                onClick={prevMove}
                disabled={currentMoveIndex < 0}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: currentMoveIndex < 0 ? 'not-allowed' : 'pointer',
                  opacity: currentMoveIndex < 0 ? 0.5 : 1
                }}
              >
                ◀ Prev
              </button>
              <button
                onClick={toggleAutoPlay}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: autoPlay ? '#ef4444' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {autoPlay ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={nextMove}
                disabled={currentMoveIndex >= moves.length - 1}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: currentMoveIndex >= moves.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentMoveIndex >= moves.length - 1 ? 0.5 : 1
                }}
              >
                Next ▶
              </button>
              <button
                onClick={jumpToEnd}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                End ⏭
              </button>
            </div>

            <div style={{ 
              textAlign: 'center', 
              marginTop: '1rem',
              fontSize: '0.9rem',
              color: '#666'
            }}>
              Move {currentMoveIndex + 1} of {moves.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BatchGameViewer;
