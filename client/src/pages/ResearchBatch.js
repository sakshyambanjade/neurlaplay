import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
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
    const [results, setResults] = useState({
        whiteWins: 0,
        blackWins: 0,
        draws: 0,
        whiteCpl: 0,
        blackCpl: 0
    });
    const [currentGame, setCurrentGame] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [socket, setSocket] = useState(null);
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
            }
            else if (game.result === 'black') {
                setResults(r => ({ ...r, blackWins: r.blackWins + 1 }));
            }
            else if (game.result === 'draw') {
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
        if (!socket)
            return;
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
        }
        catch (error) {
            console.error('Error starting batch:', error);
            setIsRunning(false);
        }
    };
    const exportLatex = async () => {
        try {
            const response = await fetch('/api/research/export/latex', {
                method: 'GET'
            });
            if (!response.ok)
                throw new Error('Export failed');
            const latex = await response.text();
            const blob = new Blob([latex], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'table3.tex';
            a.click();
            window.URL.revokeObjectURL(url);
        }
        catch (error) {
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
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-gray-50 p-6 md:p-12", children: _jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs("div", { className: "mb-10 text-center", children: [_jsx("h1", { className: "text-5xl md:text-6xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-blue-600 to-purple-600", children: "\uD83D\uDCCA Batch Research Runner" }), _jsx("p", { className: "text-xl text-gray-700 font-semibold", children: "Run 50+ automated games and export peer-reviewed results" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Perfect for comparing two LLM models in-depth" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-lg p-8 mb-8 border-t-4 border-green-600", children: [_jsx("h2", { className: "text-3xl font-bold mb-8 text-gray-900", children: "\u2699\uFE0F Configuration" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide", children: "White Model" }), _jsx("select", { value: whiteModel, onChange: (e) => setWhiteModel(e.target.value), disabled: isRunning, className: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none disabled:bg-gray-100 hover:border-gray-400 transition", children: MODELS.map(model => (_jsx("option", { value: model, children: model }, model))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide", children: "Black Model" }), _jsx("select", { value: blackModel, onChange: (e) => setBlackModel(e.target.value), disabled: isRunning, className: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none disabled:bg-gray-100 hover:border-gray-400 transition", children: MODELS.map(model => (_jsx("option", { value: model, children: model }, model))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide", children: "Number of Games" }), _jsx("input", { type: "number", min: "1", max: "500", value: numGames, onChange: (e) => setNumGames(parseInt(e.target.value) || 50), disabled: isRunning, className: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none disabled:bg-gray-100 hover:border-gray-400 transition" })] }), _jsx("div", { className: "flex items-end", children: _jsx("button", { onClick: startBatch, disabled: isRunning, className: "w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100 text-lg shadow-lg", children: isRunning ? '⏳ Running Batch...' : '▶️ Start Batch' }) })] })] }), progress.status === 'running' && (_jsxs("div", { className: "bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg shadow-lg p-6 mb-8", children: [_jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("p", { className: "text-lg font-bold text-gray-900", children: "\u2699\uFE0F Batch Running" }), _jsxs("p", { className: "text-lg font-bold text-green-600", children: [progress.current, "/", progress.total, " (", progressPercent, "%)"] })] }), _jsx("div", { className: "w-full bg-gray-300 rounded-full h-5 overflow-hidden shadow-md", children: _jsx("div", { className: "bg-gradient-to-r from-green-500 to-blue-500 h-5 rounded-full transition-all duration-300 flex items-center justify-center", style: { width: `${progressPercent}%` }, children: progressPercent > 10 && (_jsxs("span", { className: "text-white text-xs font-bold", children: [progressPercent, "%"] })) }) })] }), currentGame && (_jsxs("div", { className: "mt-6 p-5 bg-white rounded-lg border-l-4 border-green-600 shadow", children: [_jsx("p", { className: "text-sm text-gray-900 mb-2 font-bold text-gray-700", children: "\uD83D\uDCCD Current Game State" }), _jsx("p", { className: "font-mono text-xs text-gray-700 break-all bg-gray-50 p-3 rounded border border-gray-200", children: currentGame.fen }), currentGame.moves.length > 0 && (_jsxs("p", { className: "text-sm text-gray-900 mt-3 font-semibold", children: [_jsxs("span", { className: "text-green-700", children: ["Moves (", currentGame.moves.length, "):"] }), " ", _jsx("span", { className: "font-mono text-xs text-gray-700", children: currentGame.moves.join(' ') })] }))] }))] })), (results.whiteWins + results.blackWins + results.draws) > 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-lg p-8 mb-8 border-t-4 border-blue-600", children: [_jsx("h2", { className: "text-3xl font-bold mb-8 text-gray-900", children: "\uD83D\uDCC8 Results Summary" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gradient-to-r from-blue-100 to-purple-100 border-b-2 border-blue-400", children: [_jsx("th", { className: "px-6 py-4 text-left text-sm font-black text-gray-900 uppercase", children: "Model" }), _jsx("th", { className: "px-6 py-4 text-center text-sm font-black text-gray-900 uppercase", children: "Wins" }), _jsx("th", { className: "px-6 py-4 text-center text-sm font-black text-gray-900 uppercase", children: "Draws" }), _jsx("th", { className: "px-6 py-4 text-center text-sm font-black text-gray-900 uppercase", children: "Losses" }), _jsx("th", { className: "px-6 py-4 text-center text-sm font-black text-gray-900 uppercase", children: "Win %" }), _jsx("th", { className: "px-6 py-4 text-center text-sm font-black text-gray-900 uppercase", children: "Avg CPL" })] }) }), _jsxs("tbody", { children: [_jsxs("tr", { className: "border-b-2 border-gray-200 hover:bg-green-50 transition", children: [_jsx("td", { className: "px-6 py-4 text-sm font-bold text-gray-900", children: whiteModel }), _jsx("td", { className: "px-6 py-4 text-center text-sm font-bold text-green-600", children: results.whiteWins }), _jsx("td", { className: "px-6 py-4 text-center text-sm text-gray-700", children: results.draws }), _jsx("td", { className: "px-6 py-4 text-center text-sm text-red-600 font-bold", children: results.blackWins }), _jsxs("td", { className: "px-6 py-4 text-center text-sm font-bold text-gray-900", children: [whiteWinRate, "%"] }), _jsx("td", { className: "px-6 py-4 text-center text-sm text-gray-700", children: results.whiteCpl > 0 ? results.whiteCpl.toFixed(1) : '—' })] }), _jsxs("tr", { className: "hover:bg-blue-50 transition", children: [_jsx("td", { className: "px-6 py-4 text-sm font-bold text-gray-900", children: blackModel }), _jsx("td", { className: "px-6 py-4 text-center text-sm font-bold text-green-600", children: results.blackWins }), _jsx("td", { className: "px-6 py-4 text-center text-sm text-gray-700", children: results.draws }), _jsx("td", { className: "px-6 py-4 text-center text-sm text-red-600 font-bold", children: results.whiteWins }), _jsxs("td", { className: "px-6 py-4 text-center text-sm font-bold text-gray-900", children: [blackWinRate, "%"] }), _jsx("td", { className: "px-6 py-4 text-center text-sm text-gray-700", children: results.blackCpl > 0 ? results.blackCpl.toFixed(1) : '—' })] })] })] }) })] })), _jsxs("div", { className: "bg-white rounded-lg shadow-lg p-8 border-t-4 border-purple-600", children: [_jsx("h2", { className: "text-3xl font-bold mb-8 text-gray-900", children: "\uD83D\uDCE5 Export Results" }), _jsx("p", { className: "text-gray-700 mb-6 font-medium", children: "Download results in academic-ready formats for publication and analysis." }), _jsxs("div", { className: "flex gap-4 flex-col sm:flex-row", children: [_jsx("button", { onClick: exportLatex, disabled: (results.whiteWins + results.blackWins + results.draws) === 0, className: "flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100 text-lg shadow-lg", children: "\uD83D\uDCCA Export LaTeX Table" }), _jsx("button", { onClick: downloadAllData, disabled: (results.whiteWins + results.blackWins + results.draws) === 0, className: "flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 disabled:scale-100 text-lg shadow-lg", children: "\uD83D\uDCCB Download PGN & CSV" })] }), _jsxs("p", { className: "text-gray-600 text-sm mt-4 font-medium", children: ["\uD83D\uDCA1 ", _jsx("span", { className: "text-purple-700 font-semibold", children: "LaTeX:" }), " Ready for publication in research papers \u2022 ", _jsx("span", { className: "text-blue-700 font-semibold", children: "PGN:" }), " Chess move notation \u2022 ", _jsx("span", { className: "text-blue-700 font-semibold", children: "CSV:" }), " Spreadsheet analysis"] })] })] }) }));
};
export default ResearchBatch;
