/**
 * Spectator game viewer
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket, GameState, Move, GameOverEvent } from '../hooks/useSocket';

export function SpectatorGame() {
  const { matchId } = useParams<{ matchId: string }>();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [gameOver, setGameOver] = useState<GameOverEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useSocket(matchId || '', {
    onGameState: (state) => {
      setGameState(state);
      setMoves(state.moves || []);
      setLoading(false);
    },
    onMoveMade: (move) => {
      setMoves((prev) => [...prev, move]);
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, moveCount: prev.moveCount + 1 };
      });
    },
    onGameOver: (result) => {
      setGameOver(result);
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, status: 'completed' };
      });
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    }
  });

  if (!matchId) {
    return <div className="error">No match ID provided</div>;
  }

  if (loading) {
    return <div className="loading">Connecting to match...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!gameState) {
    return <div className="error">Match not found</div>;
  }

  return (
    <div className="spectator-game">
      <header className="game-header">
        <h1>Match {matchId}</h1>
        <div className="status">
          <span className={`connection ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="status-badge">{gameState.status}</span>
        </div>
      </header>

      <div className="game-container">
        {/* Left: Game info */}
        <div className="game-info">
          <div className="players">
            <div className="player white">
              <h3>{gameState.whiteBotName || 'White'}</h3>
              <p className="model">{gameState.whiteModel || 'Unknown'}</p>
            </div>
            <div className="versus">VS</div>
            <div className="player black">
              <h3>{gameState.blackBotName || 'Black'}</h3>
              <p className="model">{gameState.blackModel || 'Unknown'}</p>
            </div>
          </div>

          <div className="game-stats">
            <div className="stat">
              <strong>Moves:</strong> {gameState.moveCount}
            </div>
            <div className="stat">
              <strong>Turn:</strong> {gameState.currentTurn.toUpperCase()}
            </div>
            {gameState.startedAt && (
              <div className="stat">
                <strong>Started:</strong> {new Date(gameState.startedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Center: Board and move list */}
        <div className="game-board">
          <div className="fen-display">
            <code>{gameState.fen}</code>
          </div>

          <div className="pgn-display">
            <p>{gameState.pgn || 'No moves yet'}</p>
          </div>

          {gameOver && (
            <div className="game-over-alert">
              <h3>Game Over</h3>
              <p>
                <strong>Result:</strong> {gameOver.result}
              </p>
              <p>
                <strong>Reason:</strong> {gameOver.termination}
              </p>
              {gameOver.winner && (
                <p>
                  <strong>Winner:</strong> {gameOver.winner.toUpperCase()}
                </p>
              )}
              {gameOver.eloChanges && (
                <div className="elo-changes">
                  <p>White: {gameOver.eloChanges.white > 0 ? '+' : ''}{gameOver.eloChanges.white}</p>
                  <p>Black: {gameOver.eloChanges.black > 0 ? '+' : ''}{gameOver.eloChanges.black}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Move list and reasoning */}
        <div className="move-list">
          <h3>Moves</h3>
          <div className="moves">
            {moves.length === 0 ? (
              <p className="no-moves">Waiting for first move...</p>
            ) : (
              moves.map((move, idx) => (
                <div key={idx} className={`move ${move.playerColor}`}>
                  <span className="move-number">{move.moveNumber}</span>
                  <span className="san">{move.san}</span>
                  {move.reasoning && (
                    <div className="reasoning">
                      <small>{move.reasoning}</small>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .spectator-game {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 10px;
        }

        .game-header h1 {
          margin: 0;
          font-size: 24px;
        }

        .status {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .connection {
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .connection.connected {
          background: #d4edda;
          color: #155724;
        }

        .connection.disconnected {
          background: #f8d7da;
          color: #721c24;
        }

        .status-badge {
          padding: 5px 10px;
          background: #007bff;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .game-container {
          display: grid;
          grid-template-columns: 200px 1fr 250px;
          gap: 20px;
        }

        .game-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }

        .players {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }

        .player {
          padding: 10px;
          background: white;
          border-radius: 4px;
          text-align: center;
        }

        .player h3 {
          margin: 0 0 5px 0;
          font-size: 14px;
        }

        .player.white {
          border-left: 4px solid #000;
        }

        .player.black {
          border-left: 4px solid #333;
        }

        .model {
          margin: 0;
          font-size: 11px;
          color: #666;
        }

        .versus {
          text-align: center;
          font-weight: bold;
          color: #666;
        }

        .game-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat {
          font-size: 12px;
          padding: 5px;
          background: white;
          border-radius: 4px;
        }

        .game-board {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .fen-display {
          margin-bottom: 15px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
        }

        .pgn-display {
          margin-bottom: 15px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          line-height: 1.5;
          min-height: 60px;
        }

        .pgn-display p {
          margin: 0;
          word-break: break-all;
        }

        .game-over-alert {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 15px;
          border-radius: 4px;
          margin-top: 15px;
        }

        .game-over-alert h3 {
          margin: 0 0 10px 0;
        }

        .game-over-alert p {
          margin: 5px 0;
        }

        .elo-changes {
          font-weight: bold;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #a86d5e;
        }

        .move-list {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }

        .move-list h3 {
          margin: 0 0 15px 0;
          font-size: 14px;
        }

        .moves {
          max-height: 500px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .move {
          padding: 10px;
          background: white;
          border-left: 3px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        }

        .move.white {
          border-left-color: #000;
        }

        .move.black {
          border-left-color: #333;
        }

        .move-number {
          font-weight: bold;
          margin-right: 8px;
          color: #666;
        }

        .san {
          font-family: monospace;
          font-weight: bold;
        }

        .reasoning {
          margin-top: 5px;
          color: #666;
          font-style: italic;
        }

        .no-moves {
          color: #999;
          text-align: center;
          padding: 20px;
        }

        .loading,
        .error {
          padding: 20px;
          text-align: center;
          font-size: 16px;
        }

        .error {
          color: #721c24;
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
        }

        @media (max-width: 1024px) {
          .game-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default SpectatorGame;
