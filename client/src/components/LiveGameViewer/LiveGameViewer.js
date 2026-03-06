import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import './LiveGameViewer.css';
export const LiveGameViewer = ({ matchId }) => {
    const [gameState, setGameState] = useState(null);
    const [selectedMoveIndex, setSelectedMoveIndex] = useState(-1);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [gameStartTime, setGameStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const handleGameState = useCallback((state) => {
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
    const handleMoveMade = useCallback((moveData) => {
        setGameState(prev => {
            if (!prev)
                return null;
            const newMove = {
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
    const handleGameOver = useCallback((data) => {
        setGameState(prev => {
            if (!prev)
                return null;
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
        }
        else {
            setConnectionStatus('disconnected');
        }
    }, [isConnected]);
    // Timer for elapsed time
    useEffect(() => {
        if (gameState?.status !== 'in_progress' || !gameStartTime)
            return;
        const interval = setInterval(() => {
            setElapsedTime(Date.now() - gameStartTime.getTime());
        }, 100);
        return () => clearInterval(interval);
    }, [gameState?.status, gameStartTime]);
    if (!gameState) {
        return (_jsxs("div", { className: "live-game-viewer", children: [_jsxs("div", { className: "connection-status", children: [_jsx("div", { className: `status-indicator ${connectionStatus}` }), _jsx("span", { children: connectionStatus === 'connecting' ? 'Connecting to game...' : connectionStatus })] }), _jsx("div", { className: "loading", children: "Waiting for game to connect..." })] }));
    }
    const selectedMove = selectedMoveIndex >= 0 && selectedMoveIndex < gameState.moves.length
        ? gameState.moves[selectedMoveIndex]
        : null;
    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };
    return (_jsxs("div", { className: "live-game-viewer", children: [_jsxs("div", { className: "live-header", children: [_jsxs("div", { className: "connection-status", children: [_jsx("div", { className: `status-indicator ${connectionStatus}` }), _jsxs("span", { children: [connectionStatus === 'connected' && gameState.status === 'in_progress' && '🔴 LIVE', connectionStatus === 'connected' && gameState.status === 'completed' && '✓ Game Ended', connectionStatus === 'disconnected' && '⚠️ Disconnected'] })] }), _jsxs("div", { className: "game-title", children: [_jsxs("h2", { children: [gameState.whiteBotName, " vs ", gameState.blackBotName] }), _jsxs("p", { className: "game-models", children: [gameState.whiteModel && `${gameState.whiteModel} vs ${gameState.blackModel}`, gameState.isNeuroMatch && ' (SNN+LLM)'] })] }), _jsxs("div", { className: "game-timer", children: ["\u23F1\uFE0F ", formatTime(elapsedTime)] })] }), gameState.status === 'completed' && (_jsxs("div", { className: "game-result", children: [_jsx("div", { className: `result-badge result-${gameState.winner === 'white' ? 'white' : gameState.winner === 'black' ? 'black' : 'draw'}`, children: gameState.result }), _jsx("div", { className: "termination", children: gameState.termination })] })), _jsxs("div", { className: "live-content", children: [_jsxs("div", { className: "moves-feed", children: [_jsxs("h3", { children: ["Move Feed (", gameState.moves.length, ")"] }), _jsxs("div", { className: "moves-scroll", children: [gameState.moves.length === 0 ? (_jsx("div", { className: "waiting-for-moves", children: "Waiting for first move..." })) : (gameState.moves.map((move, idx) => (_jsxs("div", { className: `move-item ${selectedMoveIndex === idx ? 'selected' : ''} ${move.isCheck ? 'check' : ''}`, onClick: () => setSelectedMoveIndex(idx), children: [_jsxs("span", { className: "move-num", children: [move.moveNumber, "."] }), _jsx("span", { className: "move-color", children: move.color === 'white' ? '⚪' : '⚫' }), _jsx("span", { className: "move-notation", children: move.san || move.move }), move.confidence !== undefined && (_jsxs("span", { className: "move-confidence", children: [(move.confidence * 100).toFixed(0), "%"] })), move.isCheck && _jsx("span", { className: "check-badge", children: "+" }), _jsxs("span", { className: "move-latency", children: [move.neuroLatencyMs?.toFixed(0), "ms"] })] }, idx)))), gameState.status === 'in_progress' && _jsx("div", { className: "pulse", children: "Waiting for next move..." })] })] }), _jsx("div", { className: "move-inspector", children: selectedMove ? (_jsxs("div", { className: "inspector-content", children: [_jsx("h3", { children: "Move Analysis" }), _jsxs("div", { className: "inspector-section", children: [_jsxs("div", { className: "move-info", children: [_jsxs("div", { className: "info-row", children: [_jsx("span", { className: "label", children: "Move:" }), _jsx("code", { children: selectedMove.san || selectedMove.move })] }), _jsxs("div", { className: "info-row", children: [_jsx("span", { className: "label", children: "Notation:" }), _jsx("code", { children: selectedMove.move })] }), _jsxs("div", { className: "info-row", children: [_jsx("span", { className: "label", children: "Player:" }), _jsx("span", { children: selectedMove.color === 'white' ? '⚪ White' : '⚫ Black' })] })] }), selectedMove.confidence !== undefined && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "confidence-section", children: [_jsx("div", { className: "label", children: "Confidence Score" }), _jsxs("div", { className: "confidence-bar", children: [_jsx("div", { className: "confidence-fill", style: { width: `${selectedMove.confidence * 100}%` } }), _jsxs("span", { className: "confidence-value", children: [(selectedMove.confidence * 100).toFixed(1), "%"] })] })] }), _jsxs("div", { className: "metrics-grid", children: [_jsxs("div", { className: "metric", children: [_jsx("span", { className: "metric-label", children: "Spike Efficiency" }), _jsx("span", { className: "metric-value", children: selectedMove.spikeEfficiency ? `${(selectedMove.spikeEfficiency * 100).toFixed(1)}%` : 'N/A' })] }), _jsxs("div", { className: "metric", children: [_jsx("span", { className: "metric-label", children: "Latency" }), _jsxs("span", { className: "metric-value", children: [selectedMove.neuroLatencyMs?.toFixed(0), "ms"] })] })] }), selectedMove.spikeVotes && (_jsxs("div", { className: "spike-votes", children: [_jsx("span", { className: "label", children: "Spike Votes" }), _jsx("div", { className: "votes", children: selectedMove.spikeVotes.map((vote, idx) => (_jsx("div", { className: "vote", style: { opacity: vote }, children: vote.toFixed(2) }, idx))) })] }))] })), selectedMove.reasoning && (_jsxs("div", { className: "reasoning-section", children: [_jsx("span", { className: "label", children: "Reasoning" }), _jsx("div", { className: "reasoning-text", children: selectedMove.reasoning })] })), _jsxs("div", { className: "fen-section", children: [_jsx("span", { className: "label", children: "Position (FEN)" }), _jsx("code", { className: "fen-code", children: selectedMove.fen })] })] })] })) : (_jsx("div", { className: "no-move-selected", children: gameState.moves.length === 0 ? 'Waiting for game to start...' : 'Select a move to view details' })) }), _jsxs("div", { className: "game-status", children: [_jsx("h3", { children: "Game Status" }), _jsxs("div", { className: "status-box", children: [_jsxs("div", { className: "status-item", children: [_jsx("span", { className: "status-label", children: "Match ID" }), _jsx("code", { children: gameState.matchId })] }), _jsxs("div", { className: "status-item", children: [_jsx("span", { className: "status-label", children: "Status" }), _jsx("span", { className: `status-value ${gameState.status}`, children: gameState.status === 'in_progress' ? '🔴 In Progress' : '✓ Completed' })] }), _jsxs("div", { className: "status-item", children: [_jsx("span", { className: "status-label", children: "Move Count" }), _jsx("span", { children: gameState.moves.length })] }), _jsxs("div", { className: "status-item", children: [_jsx("span", { className: "status-label", children: "Next Move" }), _jsx("span", { children: gameState.currentTurn === 'white' ? '⚪ White' : '⚫ Black' })] }), gameState.status === 'completed' && gameState.neuroMetrics && (_jsxs(_Fragment, { children: [_jsx("div", { className: "status-divider" }), _jsxs("div", { className: "metrics-summary", children: [_jsxs("div", { className: "metric-row", children: [_jsx("span", { children: "White - Avg Confidence:" }), _jsx("strong", { children: gameState.neuroMetrics.white?.averageConfidence
                                                                    ? (gameState.neuroMetrics.white.averageConfidence * 100).toFixed(1) + '%'
                                                                    : 'N/A' })] }), _jsxs("div", { className: "metric-row", children: [_jsx("span", { children: "Black - Avg Confidence:" }), _jsx("strong", { children: gameState.neuroMetrics.black?.averageConfidence
                                                                    ? (gameState.neuroMetrics.black.averageConfidence * 100).toFixed(1) + '%'
                                                                    : 'N/A' })] })] })] }))] })] })] })] }));
};
