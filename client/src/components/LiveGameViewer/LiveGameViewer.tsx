import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import './LiveGameViewer.css';

interface LiveMove {
  moveNumber: number;
  color: 'white' | 'black';
  move: string;
  san: string;
  fen: string;
  confidence?: number;
  spikeEfficiency?: number;
  neuroLatencyMs?: number;
  spikeVotes?: number[];
  reasoning?: string;
  timestamp: string;
  isCheck: boolean;
}

interface LiveGameState {
  matchId: string;
  status: 'waiting' | 'in_progress' | 'completed';
  whiteBotName: string;
  blackBotName: string;
  whiteModel?: string;
  blackModel?: string;
  currentTurn: 'white' | 'black';
  fen: string;
  pgn: string;
  moves: LiveMove[];
  result?: string;
  winner?: string;
  termination?: string;
  isNeuroMatch?: boolean;
  legalMoves?: string[];
  neuroMetrics?: {
    white: any;
    black: any;
  };
}

interface LiveGameViewerProps {
  matchId: string;
}

export const LiveGameViewer: React.FC<LiveGameViewerProps> = ({ matchId }) => {
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number>(-1);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  const handleGameState = useCallback((state: any) => {
    setGameState(prev => {
      if (!prev) {
        // Initialize from the game state
        return {
          matchId: state.matchId,
          status: state.status,
          whiteBotName: state.whiteBotName || 'Bot 1',
          blackBotName: state.blackBotName || 'Bot 2',
          whiteModel: state.whiteModel,
          blackModel: state.blackModel,
          currentTurn: state.currentTurn || 'white',
          fen: state.fen,
          pgn: state.pgn || '',
          moves: [],
          isNeuroMatch: state.isNeuroMatch,
          legalMoves: state.legalMoves
        };
      }
      return {
        ...prev,
        status: state.status,
        fen: state.fen,
        pgn: state.pgn,
        currentTurn: state.currentTurn,
        legalMoves: state.legalMoves
      };
    });
    setConnectionStatus('connected');
    if (!gameStartTime && state.status === 'in_progress') {
      setGameStartTime(new Date());
    }
  }, [gameStartTime]);

  const handleMoveMade = useCallback((moveData: any) => {
    setGameState(prev => {
      if (!prev) return null;
      
      const newMove: LiveMove = {
        moveNumber: moveData.moveNumber,
        color: moveData.color,
        move: moveData.move,
        san: moveData.san || moveData.move,
        fen: moveData.fen,
        confidence: moveData.confidence,
        spikeEfficiency: moveData.spikeEfficiency,
        neuroLatencyMs: moveData.neuroLatencyMs,
        spikeVotes: moveData.spikeVotes,
        reasoning: moveData.reasoning,
        timestamp: new Date().toISOString(),
        isCheck: moveData.isCheck || false
      };

      return {
        ...prev,
        moves: [...prev.moves, newMove],
        currentTurn: moveData.color === 'white' ? 'black' : 'white',
        fen: moveData.fen,
        pgn: moveData.pgn,
        legalMoves: moveData.legalMoves
      };
    });

    // Auto-select last move
    setSelectedMoveIndex(prev => prev + 1);
  }, []);

  const handleGameOver = useCallback((data: any) => {
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'completed',
        result: data.result,
        winner: data.winner,
        termination: data.termination,
        neuroMetrics: data.neuroMetrics
      };
    });
  }, []);

  const { isConnected } = useSocket(matchId, {
    onGameState: handleGameState,
    onMoveMade: handleMoveMade,
    onGameOver: handleGameOver
  });

  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected]);

  // Timer for elapsed time
  useEffect(() => {
    if (gameState?.status !== 'in_progress' || !gameStartTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - gameStartTime.getTime());
    }, 100);

    return () => clearInterval(interval);
  }, [gameState?.status, gameStartTime]);

  if (!gameState) {
    return (
      <div className="live-game-viewer">
        <div className="connection-status">
          <div className={`status-indicator ${connectionStatus}`} />
          <span>{connectionStatus === 'connecting' ? 'Connecting to game...' : connectionStatus}</span>
        </div>
        <div className="loading">Waiting for game to connect...</div>
      </div>
    );
  }

  const selectedMove = selectedMoveIndex >= 0 && selectedMoveIndex < gameState.moves.length 
    ? gameState.moves[selectedMoveIndex] 
    : null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="live-game-viewer">
      <div className="live-header">
        <div className="connection-status">
          <div className={`status-indicator ${connectionStatus}`} />
          <span>
            {connectionStatus === 'connected' && gameState.status === 'in_progress' && '🔴 LIVE'}
            {connectionStatus === 'connected' && gameState.status === 'completed' && '✓ Game Ended'}
            {connectionStatus === 'disconnected' && '⚠️ Disconnected'}
          </span>
        </div>

        <div className="game-title">
          <h2>{gameState.whiteBotName} vs {gameState.blackBotName}</h2>
          <p className="game-models">
            {gameState.whiteModel && `${gameState.whiteModel} vs ${gameState.blackModel}`}
            {gameState.isNeuroMatch && ' (SNN+LLM)'}
          </p>
        </div>

        <div className="game-timer">
          ⏱️ {formatTime(elapsedTime)}
        </div>
      </div>

      {gameState.status === 'completed' && (
        <div className="game-result">
          <div className={`result-badge result-${gameState.winner === 'white' ? 'white' : gameState.winner === 'black' ? 'black' : 'draw'}`}>
            {gameState.result}
          </div>
          <div className="termination">{gameState.termination}</div>
        </div>
      )}

      <div className="live-content">
        <div className="moves-feed">
          <h3>Move Feed ({gameState.moves.length})</h3>
          <div className="moves-scroll">
            {gameState.moves.length === 0 ? (
              <div className="waiting-for-moves">Waiting for first move...</div>
            ) : (
              gameState.moves.map((move, idx) => (
                <div
                  key={idx}
                  className={`move-item ${selectedMoveIndex === idx ? 'selected' : ''} ${move.isCheck ? 'check' : ''}`}
                  onClick={() => setSelectedMoveIndex(idx)}
                >
                  <span className="move-num">{move.moveNumber}.</span>
                  <span className="move-color">{move.color === 'white' ? '⚪' : '⚫'}</span>
                  <span className="move-notation">{move.san || move.move}</span>
                  {move.confidence !== undefined && (
                    <span className="move-confidence">
                      {(move.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {move.isCheck && <span className="check-badge">+</span>}
                  <span className="move-latency">{move.neuroLatencyMs?.toFixed(0)}ms</span>
                </div>
              ))
            )}
            {gameState.status === 'in_progress' && <div className="pulse">Waiting for next move...</div>}
          </div>
        </div>

        <div className="move-inspector">
          {selectedMove ? (
            <div className="inspector-content">
              <h3>Move Analysis</h3>
              
              <div className="inspector-section">
                <div className="move-info">
                  <div className="info-row">
                    <span className="label">Move:</span>
                    <code>{selectedMove.san || selectedMove.move}</code>
                  </div>
                  <div className="info-row">
                    <span className="label">Notation:</span>
                    <code>{selectedMove.move}</code>
                  </div>
                  <div className="info-row">
                    <span className="label">Player:</span>
                    <span>{selectedMove.color === 'white' ? '⚪ White' : '⚫ Black'}</span>
                  </div>
                </div>

                {selectedMove.confidence !== undefined && (
                  <>
                    <div className="confidence-section">
                      <div className="label">Confidence Score</div>
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill"
                          style={{ width: `${selectedMove.confidence * 100}%` }}
                        />
                        <span className="confidence-value">
                          {(selectedMove.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="metrics-grid">
                      <div className="metric">
                        <span className="metric-label">Spike Efficiency</span>
                        <span className="metric-value">
                          {selectedMove.spikeEfficiency ? `${(selectedMove.spikeEfficiency * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Latency</span>
                        <span className="metric-value">
                          {selectedMove.neuroLatencyMs?.toFixed(0)}ms
                        </span>
                      </div>
                    </div>

                    {selectedMove.spikeVotes && (
                      <div className="spike-votes">
                        <span className="label">Spike Votes</span>
                        <div className="votes">
                          {selectedMove.spikeVotes.map((vote, idx) => (
                            <div key={idx} className="vote" style={{opacity: vote}}>
                              {vote.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedMove.reasoning && (
                  <div className="reasoning-section">
                    <span className="label">Reasoning</span>
                    <div className="reasoning-text">{selectedMove.reasoning}</div>
                  </div>
                )}

                <div className="fen-section">
                  <span className="label">Position (FEN)</span>
                  <code className="fen-code">{selectedMove.fen}</code>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-move-selected">
              {gameState.moves.length === 0 ? 'Waiting for game to start...' : 'Select a move to view details'}
            </div>
          )}
        </div>

        <div className="game-status">
          <h3>Game Status</h3>
          <div className="status-box">
            <div className="status-item">
              <span className="status-label">Match ID</span>
              <code>{gameState.matchId}</code>
            </div>
            <div className="status-item">
              <span className="status-label">Status</span>
              <span className={`status-value ${gameState.status}`}>
                {gameState.status === 'in_progress' ? '🔴 In Progress' : '✓ Completed'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Move Count</span>
              <span>{gameState.moves.length}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Next Move</span>
              <span>{gameState.currentTurn === 'white' ? '⚪ White' : '⚫ Black'}</span>
            </div>

            {gameState.status === 'completed' && gameState.neuroMetrics && (
              <>
                <div className="status-divider" />
                <div className="metrics-summary">
                  <div className="metric-row">
                    <span>White - Avg Confidence:</span>
                    <strong>
                      {gameState.neuroMetrics.white?.averageConfidence
                        ? (gameState.neuroMetrics.white.averageConfidence * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span>Black - Avg Confidence:</span>
                    <strong>
                      {gameState.neuroMetrics.black?.averageConfidence
                        ? (gameState.neuroMetrics.black.averageConfidence * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
