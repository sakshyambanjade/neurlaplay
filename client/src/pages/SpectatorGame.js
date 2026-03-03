import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Spectator game viewer
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
export function SpectatorGame() {
    const { matchId } = useParams();
    const [gameState, setGameState] = useState(null);
    const [moves, setMoves] = useState([]);
    const [gameOver, setGameOver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isConnected } = useSocket(matchId || '', {
        onGameState: (state) => {
            setGameState(state);
            setMoves(state.moves || []);
            setLoading(false);
        },
        onMoveMade: (move) => {
            setMoves((prev) => [...prev, move]);
            setGameState((prev) => {
                if (!prev)
                    return prev;
                return { ...prev, moveCount: prev.moveCount + 1 };
            });
        },
        onGameOver: (result) => {
            setGameOver(result);
            setGameState((prev) => {
                if (!prev)
                    return prev;
                return { ...prev, status: 'completed' };
            });
        },
        onError: (err) => {
            setError(err.message);
            setLoading(false);
        }
    });
    if (!matchId) {
        return _jsx("div", { className: "error", children: "No match ID provided" });
    }
    if (loading) {
        return _jsx("div", { className: "loading", children: "Connecting to match..." });
    }
    if (error) {
        return _jsxs("div", { className: "error", children: ["Error: ", error] });
    }
    if (!gameState) {
        return _jsx("div", { className: "error", children: "Match not found" });
    }
    return (_jsxs("div", { className: "spectator-game", children: [_jsxs("header", { className: "game-header", children: [_jsxs("h1", { children: ["Match ", matchId] }), _jsxs("div", { className: "status", children: [_jsx("span", { className: `connection ${isConnected ? 'connected' : 'disconnected'}`, children: isConnected ? '🟢 Connected' : '🔴 Disconnected' }), _jsx("span", { className: "status-badge", children: gameState.status })] })] }), _jsxs("div", { className: "game-container", children: [_jsxs("div", { className: "game-info", children: [_jsxs("div", { className: "players", children: [_jsxs("div", { className: "player white", children: [_jsx("h3", { children: gameState.whiteBotName || 'White' }), _jsx("p", { className: "model", children: gameState.whiteModel || 'Unknown' })] }), _jsx("div", { className: "versus", children: "VS" }), _jsxs("div", { className: "player black", children: [_jsx("h3", { children: gameState.blackBotName || 'Black' }), _jsx("p", { className: "model", children: gameState.blackModel || 'Unknown' })] })] }), _jsxs("div", { className: "game-stats", children: [_jsxs("div", { className: "stat", children: [_jsx("strong", { children: "Moves:" }), " ", gameState.moveCount] }), _jsxs("div", { className: "stat", children: [_jsx("strong", { children: "Turn:" }), " ", gameState.currentTurn.toUpperCase()] }), gameState.startedAt && (_jsxs("div", { className: "stat", children: [_jsx("strong", { children: "Started:" }), " ", new Date(gameState.startedAt).toLocaleTimeString()] }))] })] }), _jsxs("div", { className: "game-board", children: [_jsx("div", { className: "fen-display", children: _jsx("code", { children: gameState.fen }) }), _jsx("div", { className: "pgn-display", children: _jsx("p", { children: gameState.pgn || 'No moves yet' }) }), gameOver && (_jsxs("div", { className: "game-over-alert", children: [_jsx("h3", { children: "Game Over" }), _jsxs("p", { children: [_jsx("strong", { children: "Result:" }), " ", gameOver.result] }), _jsxs("p", { children: [_jsx("strong", { children: "Reason:" }), " ", gameOver.termination] }), gameOver.winner && (_jsxs("p", { children: [_jsx("strong", { children: "Winner:" }), " ", gameOver.winner.toUpperCase()] })), gameOver.eloChanges && (_jsxs("div", { className: "elo-changes", children: [_jsxs("p", { children: ["White: ", gameOver.eloChanges.white > 0 ? '+' : '', gameOver.eloChanges.white] }), _jsxs("p", { children: ["Black: ", gameOver.eloChanges.black > 0 ? '+' : '', gameOver.eloChanges.black] })] }))] }))] }), _jsxs("div", { className: "move-list", children: [_jsx("h3", { children: "Moves" }), _jsx("div", { className: "moves", children: moves.length === 0 ? (_jsx("p", { className: "no-moves", children: "Waiting for first move..." })) : (moves.map((move, idx) => (_jsxs("div", { className: `move ${move.playerColor}`, children: [_jsx("span", { className: "move-number", children: move.moveNumber }), _jsx("span", { className: "san", children: move.san }), move.reasoning && (_jsx("div", { className: "reasoning", children: _jsx("small", { children: move.reasoning }) }))] }, idx)))) })] })] }), _jsx("style", { children: `
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
      ` })] }));
}
export default SpectatorGame;
