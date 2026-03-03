import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
export function GamePage() {
    const { matchId } = useParams();
    const [fen, setFen] = useState('');
    const [moves, setMoves] = useState([]);
    const [currentTurn, setCurrentTurn] = useState(null);
    const [status, setStatus] = useState('loading');
    const [result, setResult] = useState(null);
    useSocket(matchId, {
        onGameState: ({ gameState }) => {
            setFen(gameState.fen);
            setMoves(gameState.moves);
            setCurrentTurn(gameState.currentTurn);
            setStatus(gameState.status);
        },
        onMoveMade: (payload) => {
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
        onTurnStart: (payload) => {
            setCurrentTurn(payload.color);
            setFen(payload.fen);
        },
        onGameOver: (payload) => {
            setResult(payload.result);
            setStatus('completed');
        }
    });
    useEffect(() => {
        setStatus('connecting');
    }, [matchId]);
    return (_jsxs("div", { style: { padding: '1rem' }, children: [_jsxs("h1", { children: ["Match ", matchId] }), _jsxs("p", { children: ["Status: ", status, result ? ` (${result})` : ''] }), _jsxs("p", { children: ["Current turn: ", currentTurn] }), _jsxs("p", { children: ["FEN: ", _jsx("code", { children: fen })] }), _jsx("h2", { children: "Moves" }), _jsx("ol", { children: moves.map((m) => (_jsxs("li", { children: [m.moveNumber, ". ", m.playerColor, " ", m.san, " (", m.uci, ")", m.reasoning && _jsx("div", { style: { fontSize: '0.85rem', opacity: 0.7 }, children: m.reasoning })] }, m.moveNumber))) })] }));
}
