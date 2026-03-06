import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import './GameViewer.css';
export const GameViewer = ({ matchId = '', autoRefresh = true, refreshInterval = 2000 }) => {
    const [game, setGame] = useState(null);
    const [moves, setMoves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMoveIndex, setSelectedMoveIndex] = useState(-1);
    useEffect(() => {
        const fetchGame = async () => {
            if (!matchId)
                return;
            try {
                const response = await fetch(`/api/games/${matchId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        setError('Game not found');
                    }
                    else {
                        throw new Error('Failed to fetch game');
                    }
                    return;
                }
                const data = await response.json();
                setGame(data.game);
                setError(null);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        const fetchMoves = async () => {
            if (!matchId)
                return;
            try {
                const response = await fetch(`/api/games/${matchId}/moves`);
                if (!response.ok)
                    return;
                const data = await response.json();
                setMoves(data.moves);
            }
            catch (err) {
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
    if (loading)
        return _jsx("div", { className: "game-viewer loading", children: "Loading game..." });
    if (error)
        return _jsx("div", { className: "game-viewer error", children: error });
    if (!game)
        return _jsx("div", { className: "game-viewer", children: "No game data" });
    const selectedMove = selectedMoveIndex >= 0 ? moves[selectedMoveIndex] : null;
    const getResultDisplayText = () => {
        if (game.result === 'draw')
            return '½-½';
        if (game.result === 'white')
            return '1-0';
        return '0-1';
    };
    return (_jsxs("div", { className: "game-viewer", children: [_jsxs("div", { className: "game-header", children: [_jsxs("h2", { children: ["Game: ", game.whiteBotName, " vs ", game.blackBotName] }), _jsxs("div", { className: "game-info", children: [_jsxs("p", { children: [_jsx("strong", { children: "Result:" }), " ", getResultDisplayText(), " (", game.gameStatus, ")"] }), _jsxs("p", { children: [_jsx("strong", { children: "Total Moves:" }), " ", game.totalMoves] }), _jsxs("p", { children: [_jsx("strong", { children: "Duration:" }), " ", (game.duration_ms / 1000).toFixed(1), "s"] }), _jsxs("p", { children: [_jsx("strong", { children: "Timestamp:" }), " ", new Date(game.timestamp).toLocaleString()] })] })] }), _jsxs("div", { className: "game-content", children: [_jsxs("div", { className: "moves-panel", children: [_jsx("h3", { children: "Move Log" }), _jsx("div", { className: "moves-list", children: moves.map((move, idx) => (_jsxs("div", { className: `move ${selectedMoveIndex === idx ? 'selected' : ''}`, onClick: () => setSelectedMoveIndex(idx), children: [_jsxs("span", { className: "move-num", children: [move.moveNumber, "."] }), _jsx("span", { className: "move-color", style: { color: move.color === 'white' ? '#f0f0f0' : '#333' }, children: move.color === 'white' ? '⚪' : '⚫' }), _jsx("span", { className: "move-notation", children: move.move }), _jsxs("span", { className: "move-confidence", children: [(move.confidence * 100).toFixed(0), "%"] })] }, idx))) })] }), _jsx("div", { className: "move-details-panel", children: selectedMove ? (_jsxs("div", { className: "move-details", children: [_jsx("h3", { children: "Move Details" }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Move:" }), _jsx("span", { className: "value", children: selectedMove.move })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Confidence:" }), _jsxs("div", { className: "confidence-bar", children: [_jsx("div", { className: "confidence-fill", style: { width: `${selectedMove.confidence * 100}%` } }), _jsxs("span", { className: "confidence-text", children: [(selectedMove.confidence * 100).toFixed(1), "%"] })] })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Spike Efficiency:" }), _jsxs("span", { className: "value", children: [(selectedMove.spikeEfficiency * 100).toFixed(1), "%"] })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Latency:" }), _jsxs("span", { className: "value", children: [selectedMove.latencyMs.toFixed(1), "ms"] })] }), _jsxs("div", { className: "detail-row full-width", children: [_jsx("span", { className: "label", children: "Reasoning:" }), _jsx("div", { className: "reasoning-box", children: selectedMove.reasoning })] }), _jsxs("div", { className: "detail-row full-width", children: [_jsx("span", { className: "label", children: "FEN:" }), _jsx("div", { className: "fen-box", children: selectedMove.fen })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Timestamp:" }), _jsx("span", { className: "value", children: new Date(selectedMove.timestamp).toLocaleTimeString() })] })] })) : (_jsx("div", { className: "no-selection", children: "Select a move to view details" })) }), _jsxs("div", { className: "download-panel", children: [_jsx("h3", { children: "Download Game" }), _jsxs("div", { className: "button-group", children: [_jsx("button", { className: "btn btn-download", onClick: () => window.location.href = `/api/games/${game.matchId}/pgn`, children: "Download PGN" }), _jsx("button", { className: "btn btn-download", onClick: () => window.location.href = `/api/games/${game.matchId}/json`, children: "Download JSON" })] })] })] })] }));
};
