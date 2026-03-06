import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import ResearchBatch from './pages/ResearchBatch';
import TournamentMode from './pages/TournamentMode';
import './index.css';
/**
 * Main App Component - Research Chess with Batch & Tournament Modes
 */
export function App() {
    const [mode, setMode] = useState('tournament');
    return (_jsxs("div", { children: [_jsx("nav", { className: "bg-gray-900 text-white sticky top-0 z-50", children: _jsxs("div", { className: "max-w-6xl mx-auto px-8 py-4 flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\u265F\uFE0F Chess Research Lab" }), _jsxs("div", { className: "flex gap-4", children: [_jsx("button", { onClick: () => setMode('tournament'), className: `px-4 py-2 rounded font-semibold transition ${mode === 'tournament'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`, children: "\uD83C\uDFC6 Tournament" }), _jsx("button", { onClick: () => setMode('batch'), className: `px-4 py-2 rounded font-semibold transition ${mode === 'batch'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`, children: "\u2699\uFE0F Batch" })] })] }) }), mode === 'batch' && _jsx(ResearchBatch, {}), mode === 'tournament' && _jsx(TournamentMode, {})] }));
}
export default App;
