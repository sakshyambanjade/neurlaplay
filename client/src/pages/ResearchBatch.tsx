import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface GameResult {
  whiteWins: number;
  blackWins: number;
  draws: number;
  whiteCpl: number;
  blackCpl: number;
}

interface CurrentGame {
  fen: string;
  moves: string[];
  result: 'pending' | 'white' | 'black' | 'draw';
}

const MODELS = [
  'ollama-qwen3-32b',
  'ollama-mistral',
  'ollama-neural-chat',
  'ollama-dolphin'
];

export const ResearchBatch = () => {
  const [whiteModel, setWhiteModel] = useState('groq-llama3.1-405b');
  const [blackModel, setBlackModel] = useState('openrouter-deepseek');
  const [numGames, setNumGames] = useState(50);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
  const [results, setResults] = useState<GameResult>({
    whiteWins: 0,
    blackWins: 0,
    draws: 0,
    whiteCpl: 0,
    blackCpl: 0
  });
  const [currentGame, setCurrentGame] = useState<CurrentGame | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('batch:progress', (data) => {
      setProgress(data);
    });

    newSocket.on('batch:game_done', (game) => {
      setCurrentGame(game);
      if (game.result === 'white') {
        setResults(r => ({ ...r, whiteWins: r.whiteWins + 1 }));
      } else if (game.result === 'black') {
        setResults(r => ({ ...r, blackWins: r.blackWins + 1 }));
      } else if (game.result === 'draw') {
        setResults(r => ({ ...r, draws: r.draws + 1 }));
      }
    });

    newSocket.on('batch:complete', (finalResults) => {
      setResults(finalResults);
      setIsRunning(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const startBatch = async () => {
    if (!socket) return;

    setIsRunning(true);
    setProgress({ current: 0, total: numGames, status: 'running' });
    setResults({
      whiteWins: 0,
      blackWins: 0,
      draws: 0,
      whiteCpl: 0,
      blackCpl: 0
    });

    try {
      const response = await fetch('/api/research/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whiteModel,
          blackModel,
          games: numGames,
          balanced: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start batch');
      }

      const data = await response.json();
      console.log('Batch started:', data);
    } catch (error) {
      console.error('Error starting batch:', error);
      setIsRunning(false);
    }
  };

  const exportLatex = async () => {
    try {
      const response = await fetch('/api/research/export/latex', {
        method: 'GET'
      });

      if (!response.ok) throw new Error('Export failed');

      const latex = await response.text();
      const blob = new Blob([latex], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'table3.tex';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting LaTeX:', error);
    }
  };

  const downloadAllData = () => {
    window.location.href = '/api/research/export/all';
  };

  const whiteWinRate = results.whiteWins + results.blackWins > 0
    ? Math.round((results.whiteWins / (results.whiteWins + results.blackWins)) * 100)
    : 0;

  const blackWinRate = results.whiteWins + results.blackWins > 0
    ? Math.round((results.blackWins / (results.whiteWins + results.blackWins)) * 100)
    : 0;

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-blue-600 to-purple-600">
            📊 Batch Research Runner
          </h1>
          <p className="text-xl text-gray-700 font-semibold">Run 50+ automated games and export peer-reviewed results</p>
          <p className="text-gray-600 mt-2">Perfect for comparing two LLM models in-depth</p>
        </div>

        {/* CONFIG SECTION */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-t-4 border-green-600">
          <h2 className="text-3xl font-bold mb-8 text-gray-900">⚙️ Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">White Model</label>
              <select
                value={whiteModel}
                onChange={(e) => setWhiteModel(e.target.value)}
                disabled={isRunning}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none disabled:bg-gray-100 hover:border-gray-400 transition"
              >
                {MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Black Model</label>
              <select
                value={blackModel}
                onChange={(e) => setBlackModel(e.target.value)}
                disabled={isRunning}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none disabled:bg-gray-100 hover:border-gray-400 transition"
              >
                {MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Number of Games</label>
              <input
                type="number"
                min="1"
                max="500"
                value={numGames}
                onChange={(e) => setNumGames(parseInt(e.target.value) || 50)}
                disabled={isRunning}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none disabled:bg-gray-100 hover:border-gray-400 transition"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={startBatch}
                disabled={isRunning}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100 text-lg shadow-lg"
              >
                {isRunning ? '⏳ Running Batch...' : '▶️ Start Batch'}
              </button>
            </div>
          </div>
        </div>

        {/* PROGRESS SECTION */}
        {progress.status === 'running' && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg shadow-lg p-6 mb-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-lg font-bold text-gray-900">⚙️ Batch Running</p>
                <p className="text-lg font-bold text-green-600">{progress.current}/{progress.total} ({progressPercent}%)</p>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-5 overflow-hidden shadow-md">
                <div
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-5 rounded-full transition-all duration-300 flex items-center justify-center"
                  style={{ width: `${progressPercent}%` }}
                >
                  {progressPercent > 10 && (
                    <span className="text-white text-xs font-bold">{progressPercent}%</span>
                  )}
                </div>
              </div>
            </div>

            {currentGame && (
              <div className="mt-6 p-5 bg-white rounded-lg border-l-4 border-green-600 shadow">
                <p className="text-sm text-gray-900 mb-2 font-bold text-gray-700">📍 Current Game State</p>
                <p className="font-mono text-xs text-gray-700 break-all bg-gray-50 p-3 rounded border border-gray-200">{currentGame.fen}</p>
                {currentGame.moves.length > 0 && (
                  <p className="text-sm text-gray-900 mt-3 font-semibold"><span className="text-green-700">Moves ({currentGame.moves.length}):</span> <span className="font-mono text-xs text-gray-700">{currentGame.moves.join(' ')}</span></p>
                )}
              </div>
            )}
          </div>
        )}

        {/* RESULTS TABLE */}
        {(results.whiteWins + results.blackWins + results.draws) > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-t-4 border-blue-600">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">📈 Results Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-purple-100 border-b-2 border-blue-400">
                    <th className="px-6 py-4 text-left text-sm font-black text-gray-900 uppercase">Model</th>
                    <th className="px-6 py-4 text-center text-sm font-black text-gray-900 uppercase">Wins</th>
                    <th className="px-6 py-4 text-center text-sm font-black text-gray-900 uppercase">Draws</th>
                    <th className="px-6 py-4 text-center text-sm font-black text-gray-900 uppercase">Losses</th>
                    <th className="px-6 py-4 text-center text-sm font-black text-gray-900 uppercase">Win %</th>
                    <th className="px-6 py-4 text-center text-sm font-black text-gray-900 uppercase">Avg CPL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b-2 border-gray-200 hover:bg-green-50 transition">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{whiteModel}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-green-600">{results.whiteWins}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">{results.draws}</td>
                    <td className="px-6 py-4 text-center text-sm text-red-600 font-bold">{results.blackWins}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-gray-900">{whiteWinRate}%</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {results.whiteCpl > 0 ? results.whiteCpl.toFixed(1) : '—'}
                    </td>
                  </tr>
                  <tr className="hover:bg-blue-50 transition">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{blackModel}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-green-600">{results.blackWins}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">{results.draws}</td>
                    <td className="px-6 py-4 text-center text-sm text-red-600 font-bold">{results.whiteWins}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-gray-900">{blackWinRate}%</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {results.blackCpl > 0 ? results.blackCpl.toFixed(1) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXPORT SECTION */}
        <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-purple-600">
          <h2 className="text-3xl font-bold mb-8 text-gray-900">📥 Export Results</h2>
          <p className="text-gray-700 mb-6 font-medium">Download results in academic-ready formats for publication and analysis.</p>
          <div className="flex gap-4 flex-col sm:flex-row">
            <button
              onClick={exportLatex}
              disabled={(results.whiteWins + results.blackWins + results.draws) === 0}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100 text-lg shadow-lg"
            >
              📊 Export LaTeX Table
            </button>
            <button
              onClick={downloadAllData}
              disabled={(results.whiteWins + results.blackWins + results.draws) === 0}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100 text-lg shadow-lg"
            >
              📋 Download PGN & CSV
            </button>
          </div>
          <p className="text-gray-600 text-sm mt-4 font-medium">💡 <span className="text-purple-700 font-semibold">LaTeX:</span> Ready for publication in research papers • <span className="text-blue-700 font-semibold">PGN:</span> Chess move notation • <span className="text-blue-700 font-semibold">CSV:</span> Spreadsheet analysis</p>
        </div>
      </div>
    </div>
  );
};

export default ResearchBatch;
