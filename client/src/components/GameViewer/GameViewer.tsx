import React, { useState, useEffect } from 'react';
import './GameViewer.css';

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

interface GameViewerProps {
  matchId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const GameViewer: React.FC<GameViewerProps> = ({ 
  matchId = '', 
  autoRefresh = true, 
  refreshInterval = 2000 
}) => {
  const [game, setGame] = useState<GameRecord | null>(null);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number>(-1);

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
          return;
        }
        const data = await response.json();
        setGame(data.game);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchMoves = async () => {
      if (!matchId) return;

      try {
        const response = await fetch(`/api/games/${matchId}/moves`);
        if (!response.ok) return;
        const data = await response.json();
        setMoves(data.moves);
      } catch (err) {
        console.error('Error fetching moves:', err);
      }
    };

    fetchGame();
    fetchMoves();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMoves();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [matchId, autoRefresh, refreshInterval]);

  if (loading) return <div className="game-viewer loading">Loading game...</div>;
  if (error) return <div className="game-viewer error">{error}</div>;
  if (!game) return <div className="game-viewer">No game data</div>;

  const selectedMove = selectedMoveIndex >= 0 ? moves[selectedMoveIndex] : null;
  const getResultDisplayText = () => {
    if (game.result === 'draw') return '½-½';
    if (game.result === 'white') return '1-0';
    return '0-1';
  };

  return (
    <div className="game-viewer">
      <div className="game-header">
        <h2>Game: {game.whiteBotName} vs {game.blackBotName}</h2>
        <div className="game-info">
          <p><strong>Result:</strong> {getResultDisplayText()} ({game.gameStatus})</p>
          <p><strong>Total Moves:</strong> {game.totalMoves}</p>
          <p><strong>Duration:</strong> {(game.duration_ms / 1000).toFixed(1)}s</p>
          <p><strong>Timestamp:</strong> {new Date(game.timestamp).toLocaleString()}</p>
        </div>
      </div>

      <div className="game-content">
        <div className="moves-panel">
          <h3>Move Log</h3>
          <div className="moves-list">
            {moves.map((move, idx) => (
              <div
                key={idx}
                className={`move ${selectedMoveIndex === idx ? 'selected' : ''}`}
                onClick={() => setSelectedMoveIndex(idx)}
              >
                <span className="move-num">{move.moveNumber}.</span>
                <span className="move-color" style={{color: move.color === 'white' ? '#f0f0f0' : '#333'}}>
                  {move.color === 'white' ? '⚪' : '⚫'}
                </span>
                <span className="move-notation">{move.move}</span>
                <span className="move-confidence">
                  {(move.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="move-details-panel">
          {selectedMove ? (
            <div className="move-details">
              <h3>Move Details</h3>
              <div className="detail-row">
                <span className="label">Move:</span>
                <span className="value">{selectedMove.move}</span>
              </div>
              <div className="detail-row">
                <span className="label">Confidence:</span>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{ width: `${selectedMove.confidence * 100}%` }}
                  />
                  <span className="confidence-text">
                    {(selectedMove.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <span className="label">Spike Efficiency:</span>
                <span className="value">{(selectedMove.spikeEfficiency * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-row">
                <span className="label">Latency:</span>
                <span className="value">{selectedMove.latencyMs.toFixed(1)}ms</span>
              </div>
              <div className="detail-row full-width">
                <span className="label">Reasoning:</span>
                <div className="reasoning-box">{selectedMove.reasoning}</div>
              </div>
              <div className="detail-row full-width">
                <span className="label">FEN:</span>
                <div className="fen-box">{selectedMove.fen}</div>
              </div>
              <div className="detail-row">
                <span className="label">Timestamp:</span>
                <span className="value">{new Date(selectedMove.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <div className="no-selection">Select a move to view details</div>
          )}
        </div>

        <div className="download-panel">
          <h3>Download Game</h3>
          <div className="button-group">
            <button 
              className="btn btn-download"
              onClick={() => window.location.href = `/api/games/${game.matchId}/pgn`}
            >
              Download PGN
            </button>
            <button 
              className="btn btn-download"
              onClick={() => window.location.href = `/api/games/${game.matchId}/json`}
            >
              Download JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
