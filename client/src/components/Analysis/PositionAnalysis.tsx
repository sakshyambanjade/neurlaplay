import { useState } from 'react';
import { useStockfish } from '../../hooks';

interface PositionAnalysisProps {
  fen: string;
  depth?: number;
}

/**
 * PositionAnalysis - Analyze chess position using Stockfish
 * 
 * Usage:
 * <PositionAnalysis fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" depth={18} />
 */
export function PositionAnalysis({ fen, depth = 18 }: PositionAnalysisProps) {
  const { isReady, analyze } = useStockfish();
  const [evaluation, setEvaluation] = useState<number | null>(null);
  const [bestMove, setBestMove] = useState<string>('');
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
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatEvaluation = (cp: number) => {
    if (Math.abs(cp) > 9000) {
      return cp > 0 ? '♔ Mate' : '♚ Mate';
    }
    const pawns = (cp / 100).toFixed(2);
    return pawns;
  };

  return (
    <div className="position-analysis">
      <button onClick={handleAnalyze} disabled={!isReady || analyzing}>
        {analyzing ? 'Analyzing...' : 'Analyze Position'}
      </button>

      {!isReady && <p>⏳ Loading Stockfish engine...</p>}

      {evaluation !== null && (
        <div className="analysis-result">
          <div>
            <strong>Evaluation:</strong> {formatEvaluation(evaluation)}
          </div>
          <div>
            <strong>Best Move:</strong> {bestMove || 'None'}
          </div>
        </div>
      )}
    </div>
  );
}

export default PositionAnalysis;
