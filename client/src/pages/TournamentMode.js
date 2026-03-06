import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
const MODELS = [
    { key: 'ollama-qwen3-32b', name: 'OLLAMA', display: 'Qwen 2.5 Coder 32B', provider: 'Ollama (Local)', color: 'from-cyan-500 to-cyan-600', icon: '🦙' },
    { key: 'ollama-mistral', name: 'OLLAMA', display: 'Mistral', provider: 'Ollama (Local)', color: 'from-cyan-500 to-cyan-600', icon: '🦙' },
    { key: 'ollama-neural-chat', name: 'OLLAMA', display: 'Neural Chat', provider: 'Ollama (Local)', color: 'from-cyan-500 to-cyan-600', icon: '🦙' },
    { key: 'ollama-dolphin', name: 'OLLAMA', display: 'Dolphin Mixtral', provider: 'Ollama (Local)', color: 'from-cyan-500 to-cyan-600', icon: '🦙' }
];
export const TournamentMode = () => {
    const [selectedModels, setSelectedModels] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle', tournamentId: '' });
    const [isRunning, setIsRunning] = useState(false);
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState(false);
    const [tournaments, setTournaments] = useState([]);
    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
        newSocket.on('tournament:progress', (data) => {
            setProgress(data);
        });
        newSocket.on('tournament:game_done', (game) => {
            console.log('Game completed:', game);
        });
        newSocket.on('tournament:complete', (finalResults) => {
            console.log('Tournament complete:', finalResults);
            setIsRunning(false);
            setTournaments(prev => [...prev, finalResults]);
        });
        newSocket.on('tournament:error', (data) => {
            console.error('Tournament error:', data);
            setIsRunning(false);
        });
        return () => {
            newSocket.close();
        };
    }, []);
    const toggleModel = (modelKey) => {
        setSelectedModels(prev => {
            if (prev.includes(modelKey)) {
                return prev.filter(m => m !== modelKey);
            }
            else if (prev.length < 5) {
                return [...prev, modelKey];
            }
            return prev;
        });
    };
    const testAPIs = async () => {
        if (selectedModels.length === 0) {
            alert('Select at least one model');
            return;
        }
        setTesting(true);
        try {
            const response = await fetch('/api/research/test-apis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ models: selectedModels })
            });
            const data = await response.json();
            setTestResults(data.results);
            if (data.allValid) {
                alert(`✅ All ${selectedModels.length} APIs are valid!`);
            }
            else {
                const invalid = Object.entries(data.results)
                    .filter(([_, v]) => v.status === 'invalid')
                    .map(([k]) => k);
                alert(`❌ Invalid APIs: ${invalid.join(', ')}`);
            }
        }
        catch (error) {
            console.error('API test error:', error);
            alert('Failed to test APIs');
        }
        finally {
            setTesting(false);
        }
    };
    const startTournament = async () => {
        if (selectedModels.length < 2) {
            alert('Select 2-5 models');
            return;
        }
        setIsRunning(true);
        setProgress({ current: 0, total: 0, status: 'starting', tournamentId: '' });
        try {
            const response = await fetch('/api/research/tournament', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ models: selectedModels })
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }
            console.log('Tournament started:', data);
            setProgress(prev => ({ ...prev, total: data.totalGames, tournamentId: data.tournamentId }));
        }
        catch (error) {
            console.error('Tournament start error:', error);
            alert(`Failed to start tournament: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsRunning(false);
        }
    };
    const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (_jsx("div", { style: { minHeight: '100vh', background: 'linear-gradient(135deg, #f3f4f6 0%, #eff6ff 50%, #f3f4f6 100%)', padding: '24px 16px' }, children: _jsxs("div", { style: { maxWidth: '1280px', margin: '0 auto' }, children: [_jsxs("div", { style: { marginBottom: '40px', textAlign: 'center' }, children: [_jsx("h1", { style: { fontSize: '48px', fontWeight: '900', marginBottom: '12px', background: 'linear-gradient(90deg, #3b82f6 0%, #a855f7 50%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }, children: "\uD83C\uDFC6 Tournament Mode" }), _jsx("p", { style: { fontSize: '18px', color: '#374151', fontWeight: '600' }, children: "Battle LLM Models Head-to-Head" }), _jsx("p", { style: { color: '#6b7280', marginTop: '8px' }, children: "Each model plays against every other model once (round-robin)" })] }), _jsxs("div", { style: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '32px', marginBottom: '32px', borderTop: '4px solid #2563eb' }, children: [_jsx("h2", { style: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', color: '#111827' }, children: "\uD83C\uDFAF Select Models (2-5)" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }, children: MODELS.map(model => {
                                const isSelected = selectedModels.includes(model.key);
                                const gradientMap = {
                                    'from-purple-500 to-purple-600': 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                                    'from-green-500 to-green-600': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                    'from-blue-500 to-blue-600': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                    'from-orange-500 to-orange-600': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                    'from-yellow-500 to-yellow-600': 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                                    'from-red-500 to-red-600': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                };
                                return (_jsx("div", { onClick: () => !isRunning && toggleModel(model.key), style: {
                                        cursor: isRunning ? 'not-allowed' : 'pointer',
                                        opacity: isRunning ? 0.5 : 1,
                                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                        transition: 'all 0.2s ease'
                                    }, onMouseEnter: (e) => !isRunning && (e.currentTarget.style.transform = 'scale(1.08)'), onMouseLeave: (e) => (e.currentTarget.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)'), children: _jsxs("div", { style: {
                                            height: '100%',
                                            padding: '20px',
                                            borderRadius: '10px',
                                            border: isSelected ? '2px solid white' : '2px solid #e5e7eb',
                                            background: isSelected ? gradientMap[model.color] : 'white',
                                            color: isSelected ? 'white' : '#111827',
                                            boxShadow: isSelected ? '0 10px 25px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.05)',
                                            transition: 'all 0.3s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between'
                                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }, children: [_jsx("span", { style: { fontSize: '32px' }, children: model.icon }), isSelected && _jsx("span", { style: { fontSize: '24px' }, children: "\u2705" })] }), _jsxs("div", { children: [_jsx("p", { style: { fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }, children: model.name }), _jsx("p", { style: { fontSize: '13px', fontWeight: '500', opacity: isSelected ? 0.9 : 0.7 }, children: model.display })] })] }) }, model.key));
                            }) }), _jsx("div", { style: { marginBottom: '24px', padding: '16px', backgroundColor: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '6px' }, children: _jsx("p", { style: { color: '#1e3a8a', fontWeight: '600', fontSize: '14px' }, children: selectedModels.length === 0
                                    ? '👉 Select 2-5 models above'
                                    : `✅ Selected: ${selectedModels.length} model${selectedModels.length !== 1 ? 's' : ''}` }) }), Object.keys(testResults).length > 0 && (_jsxs("div", { style: { marginBottom: '24px', padding: '20px', backgroundColor: '#f0f9ff', border: '2px solid #06b6d4', borderRadius: '8px' }, children: [_jsx("h3", { style: { fontWeight: 'bold', marginBottom: '16px', color: '#111827', fontSize: '16px' }, children: "\uD83D\uDD0C API Status Check" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: selectedModels.map(modelKey => {
                                        const model = MODELS.find(m => m.key === modelKey);
                                        const result = testResults[modelKey];
                                        return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'white', borderRadius: '6px', borderLeft: '4px solid #d1d5db' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("span", { style: { fontSize: '20px' }, children: model.icon }), _jsx("span", { style: { fontWeight: '600', color: '#111827' }, children: model.name })] }), result && (_jsx("span", { style: {
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        fontWeight: 'bold',
                                                        fontSize: '13px',
                                                        backgroundColor: result.status === 'valid' ? '#dcfce7' : '#fee2e2',
                                                        color: result.status === 'valid' ? '#15803d' : '#991b1b'
                                                    }, children: result.status === 'valid' ? '✅ Valid' : '❌ Invalid' }))] }, modelKey));
                                    }) })] })), _jsxs("div", { style: { display: 'flex', gap: '12px', flexDirection: window.innerWidth < 640 ? 'column' : 'row' }, children: [_jsx("button", { onClick: testAPIs, disabled: isRunning || testing || selectedModels.length === 0, style: {
                                        flex: 1,
                                        background: isRunning || testing || selectedModels.length === 0
                                            ? '#9ca3af'
                                            : 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        padding: '16px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: isRunning || testing || selectedModels.length === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        transition: 'all 0.2s ease',
                                        transform: !isRunning && !testing && selectedModels.length > 0 ? 'translateY(0)' : 'scale(0.98)'
                                    }, onMouseEnter: (e) => !isRunning && !testing && selectedModels.length > 0 && (e.currentTarget.style.transform = 'translateY(-2px)'), onMouseLeave: (e) => (e.currentTarget.style.transform = 'translateY(0)'), children: testing ? '⏳ Testing APIs...' : '🔍 Test APIs' }), _jsx("button", { onClick: startTournament, disabled: isRunning || selectedModels.length < 2, style: {
                                        flex: 1,
                                        background: isRunning || selectedModels.length < 2
                                            ? '#9ca3af'
                                            : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        padding: '16px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: isRunning || selectedModels.length < 2 ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        transition: 'all 0.2s ease',
                                        transform: !isRunning && selectedModels.length >= 2 ? 'translateY(0)' : 'scale(0.98)'
                                    }, onMouseEnter: (e) => !isRunning && selectedModels.length >= 2 && (e.currentTarget.style.transform = 'translateY(-2px)'), onMouseLeave: (e) => (e.currentTarget.style.transform = 'translateY(0)'), children: isRunning ? '⏳ Tournament Running...' : '🏆 Start Tournament' })] })] }), isRunning && progress.total > 0 && (_jsxs("div", { style: { background: 'linear-gradient(135deg, #eff6ff 0%, #fce7f3 100%)', border: '2px solid #3b82f6', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '32px' }, children: [_jsxs("div", { style: { marginBottom: '24px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }, children: [_jsx("p", { style: { fontSize: '18px', fontWeight: 'bold', color: '#111827' }, children: "\u2699\uFE0F Tournament In Progress" }), _jsxs("p", { style: { fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }, children: [progress.current, "/", progress.total, " (", progressPercent, "%)"] })] }), _jsx("div", { style: { width: '100%', backgroundColor: '#d1d5db', borderRadius: '9999px', height: '20px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }, children: _jsx("div", { style: {
                                            background: 'linear-gradient(90deg, #3b82f6 0%, #a855f7 100%)',
                                            height: '20px',
                                            borderRadius: '9999px',
                                            transition: 'width 0.3s ease',
                                            width: `${progressPercent}%`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }, children: progressPercent > 10 && (_jsxs("span", { style: { color: 'white', fontSize: '12px', fontWeight: 'bold' }, children: [progressPercent, "%"] })) }) })] }), _jsxs("p", { style: { fontSize: '13px', color: '#374151', fontWeight: '500' }, children: ["ID: ", _jsx("span", { style: { fontFamily: 'monospace', color: '#2563eb' }, children: progress.tournamentId })] })] })), tournaments.length > 0 && (_jsxs("div", { style: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '32px', marginBottom: '32px', borderTop: '4px solid #16a34a' }, children: [_jsx("h2", { style: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', color: '#111827' }, children: "\uD83D\uDCDC Tournament History" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }, children: tournaments.map((tournament, idx) => (_jsxs("div", { style: { padding: '20px', background: 'linear-gradient(135deg, #dcfce7 0%, #dbeafe 100%)', borderRadius: '8px', border: '2px solid #22c55e', transition: 'box-shadow 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }, onMouseEnter: (e) => e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)', onMouseLeave: (e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)', children: [_jsxs("p", { style: { fontWeight: 'bold', color: '#111827', fontSize: '16px', marginBottom: '8px' }, children: ["\uD83C\uDFC5 Tournament #", idx + 1] }), _jsxs("p", { style: { fontSize: '13px', color: '#374151', marginBottom: '8px' }, children: [_jsx("span", { style: { fontWeight: '600' }, children: "ID:" }), " ", _jsx("span", { style: { fontFamily: 'monospace', color: '#4b5563' }, children: tournament.tournamentId })] }), _jsxs("p", { style: { fontSize: '13px', color: '#374151' }, children: [_jsx("span", { style: { fontWeight: '600' }, children: "Status:" }), " \u2705 Completed"] })] }, idx))) })] })), _jsxs("div", { style: { marginTop: '40px', padding: '32px', background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 100%)', border: '2px solid #d946ef', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }, children: [_jsx("h3", { style: { fontWeight: 'bold', color: '#581c87', marginBottom: '16px', fontSize: '20px' }, children: "\uD83D\uDCD6 How It Works" }), _jsxs("ul", { style: { color: '#581c87', display: 'flex', flexDirection: 'column', gap: '12px', fontWeight: '600', fontSize: '15px' }, children: [_jsxs("li", { children: ["\uD83C\uDFAF ", _jsx("span", { style: { color: '#7e22ce' }, children: "Select 2-5 models" }), " from the grid above"] }), _jsxs("li", { children: ["\uD83D\uDD0C ", _jsx("span", { style: { color: '#7e22ce' }, children: "Click \"Test APIs\"" }), " to verify all keys are configured correctly"] }), _jsxs("li", { children: ["\uD83C\uDFAC ", _jsx("span", { style: { color: '#7e22ce' }, children: "Click \"Start Tournament\"" }), " to begin the round-robin competition"] }), _jsxs("li", { children: ["\u26A1 ", _jsx("span", { style: { color: '#7e22ce' }, children: "Each model plays every other model" }), " once in a fair matchup"] }), _jsxs("li", { children: ["\uD83D\uDCCA ", _jsx("span", { style: { color: '#7e22ce' }, children: "Watch real-time progress" }), " as games complete"] }), _jsxs("li", { children: ["\uD83C\uDFC6 ", _jsx("span", { style: { color: '#7e22ce' }, children: "See tournament history" }), " with completed tournaments"] })] })] })] }) }));
};
export default TournamentMode;
