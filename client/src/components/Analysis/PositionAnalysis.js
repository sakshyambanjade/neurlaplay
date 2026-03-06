import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useStockfish } from '../../hooks';
/**
 * PositionAnalysis - Analyze chess position using Stockfish
 *
 * Usage:
 * <PositionAnalysis fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" depth={18} />
 */
export function PositionAnalysis({ fen, depth = 18 }) {
    const { isReady, analyze } = useStockfish();
    const [evaluation, setEvaluation] = useState(null);
    const [bestMove, setBestMove] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const handleAnalyze = async () => {
        if (!isReady) {
            console.error('Stockfish not ready');
            return;
        }
        setAnalyzing(true);
        try {
            const result = await analyze(fen, depth);
            setEvaluation(result.evaluation);
            setBestMove(result.bestMove);
        }
        catch (error) {
            console.error('Analysis failed:', error);
        }
        finally {
            setAnalyzing(false);
        }
    };
    const formatEvaluation = (cp) => {
        if (Math.abs(cp) > 9000) {
            return cp > 0 ? '♔ Mate' : '♚ Mate';
        }
        const pawns = (cp / 100).toFixed(2);
        return pawns;
    };
    return (_jsxs("div", { className: "position-analysis", children: [_jsx("button", { onClick: handleAnalyze, disabled: !isReady || analyzing, children: analyzing ? 'Analyzing...' : 'Analyze Position' }), !isReady && _jsx("p", { children: "\u23F3 Loading Stockfish engine..." }), evaluation !== null && (_jsxs("div", { className: "analysis-result", children: [_jsxs("div", { children: [_jsx("strong", { children: "Evaluation:" }), " ", formatEvaluation(evaluation)] }), _jsxs("div", { children: [_jsx("strong", { children: "Best Move:" }), " ", bestMove || 'None'] })] }))] }));
}
export default PositionAnalysis;
