import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useSocket } from './hooks';
import { useGameStore } from './store/gameStore';
import { LobbyPage } from './pages/Lobby';
import { GamePage } from './pages/Game';
import { SpectatorGame } from './pages/SpectatorGame';
import { BotProfile } from './pages/BotProfile';
import { Leaderboard } from './pages/Leaderboard';
import { Home as HomeIcon } from 'lucide-react';
/**
 * Home Page Component
 */
function HomePage() {
    const socket = useSocket();
    const setMatchId = useGameStore((s) => s.setMatchId);
    const setUserColor = useGameStore((s) => s.setUserColor);
    const navigate = useNavigate();
    const [activeMatches, setActiveMatches] = React.useState([]);
    const [loadingMatches, setLoadingMatches] = React.useState(false);
    const handleCreateMatch = () => {
        socket?.emit('createMatch', {
            timeoutSeconds: 30,
            isPublic: true,
            researchMode: false
        });
    };
    // Fetch active matches
    React.useEffect(() => {
        const fetchActiveMatches = async () => {
            try {
                setLoadingMatches(true);
                const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
                const response = await fetch(`${serverUrl}/api/matches/active`);
                if (response.ok) {
                    const data = await response.json();
                    setActiveMatches(Array.isArray(data.matches) ? data.matches.slice(0, 5) : []);
                }
            }
            catch (err) {
                console.error('Error fetching active matches:', err);
            }
            finally {
                setLoadingMatches(false);
            }
        };
        fetchActiveMatches();
        const interval = setInterval(fetchActiveMatches, 10000);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => {
        if (!socket)
            return;
        socket.on('matchCreated', (data) => {
            setMatchId(data.matchId);
            setUserColor(data.color);
            navigate('/lobby');
        });
        return () => {
            socket.off('matchCreated');
        };
    }, [socket, setMatchId, setUserColor, navigate]);
    return (_jsxs(_Fragment, { children: [_jsx("section", { className: "py-5", style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }, children: _jsxs("div", { className: "container-lg text-center position-relative", style: { zIndex: 1 }, children: [_jsx("div", { className: "mb-4 d-inline-block", children: _jsx("span", { className: "badge", style: { padding: '0.75rem 1rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '0.95rem' }, children: "\uD83D\uDE80 AI Chess Battles in Real-Time" }) }), _jsxs("h1", { style: { fontSize: 'clamp(3rem, 10vw, 5.5rem)', fontWeight: '900', color: '#fff', marginBottom: '1.5rem', lineHeight: '1.2' }, children: ["Battle of the ", _jsx("span", { style: { background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }, children: "Bots" })] }), _jsx("p", { style: { fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: '#d1d5db', marginBottom: '3rem', maxWidth: '700px', margin: '0 auto 3rem auto', lineHeight: '1.6' }, children: "Watch AI models powered by GPT-4, Claude, Mixtral, and more compete in real-time chess matches" }), _jsxs("div", { className: "d-flex flex-column flex-sm-row gap-3 justify-content-center mb-5", children: [_jsx("button", { onClick: handleCreateMatch, className: "btn btn-lg fw-bold", style: { padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', background: 'linear-gradient(to right, #9333ea, #a855f7)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }, onMouseEnter: (e) => (e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.5)', e.currentTarget.style.transform = 'scale(1.05)'), onMouseLeave: (e) => (e.currentTarget.style.boxShadow = 'none', e.currentTarget.style.transform = 'scale(1)'), children: "Create Match" }), _jsx(Link, { to: "/leaderboard", className: "btn btn-lg fw-bold", style: { padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'), children: "View Leaderboard" })] }), _jsxs("div", { className: "row mt-5", children: [_jsxs("div", { className: "col-md-4 mb-4", children: [_jsx("div", { style: { fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 'bold', background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }, children: "1000+" }), _jsx("p", { className: "text-muted mt-2", style: { fontSize: '1.1rem' }, children: "Games" })] }), _jsxs("div", { className: "col-md-4 mb-4", children: [_jsx("div", { style: { fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 'bold', background: 'linear-gradient(to right, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }, children: "15+" }), _jsx("p", { className: "text-muted mt-2", style: { fontSize: '1.1rem' }, children: "Models" })] }), _jsxs("div", { className: "col-md-4 mb-4", children: [_jsx("div", { style: { fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 'bold', background: 'linear-gradient(to right, #4ade80, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }, children: "24/7" }), _jsx("p", { className: "text-muted mt-2", style: { fontSize: '1.1rem' }, children: "Live" })] })] })] }) }), _jsx("section", { className: "py-5", style: { backgroundColor: 'rgba(15, 23, 42, 0.8)', borderTop: '1px solid rgba(168, 85, 247, 0.2)' }, children: _jsxs("div", { className: "container-lg", children: [_jsxs("div", { className: "text-center mb-5", children: [_jsx("h2", { style: { fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '0.5rem' }, children: "\u26A1 Watch Live" }), _jsx("p", { style: { fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db', marginBottom: '2rem' }, children: loadingMatches ? 'Loading active matches...' : activeMatches.length > 0 ? `${activeMatches.length} matches in progress` : 'No active matches at the moment' })] }), activeMatches.length > 0 ? (_jsx("div", { className: "row g-3", children: activeMatches.map((match, idx) => (_jsx("div", { className: "col-md-6 col-lg-4", children: _jsxs(Link, { to: `/game/${match.matchId}`, style: {
                                        display: 'block',
                                        padding: '1.5rem',
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                                        border: '1px solid rgba(168, 85, 247, 0.4)',
                                        borderRadius: '1rem',
                                        textDecoration: 'none',
                                        color: 'white',
                                        transition: 'all 0.3s',
                                        cursor: 'pointer'
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.8)';
                                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(168, 85, 247, 0.3)';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }, children: [_jsx("div", { style: { fontSize: '1.25rem', fontWeight: 'bold' }, children: match.whiteBotName }), _jsx("div", { style: { color: '#999', fontSize: '0.85rem' }, children: "vs" }), _jsx("div", { style: { fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'right' }, children: match.blackBotName })] }), _jsxs("div", { style: { fontSize: '0.85rem', color: '#d1d5db', textAlign: 'center', marginBottom: '0.5rem' }, children: ["Move ", match.moveCount || '?'] }), _jsx("div", { style: {
                                                display: 'inline-block',
                                                padding: '0.5rem 1rem',
                                                background: 'rgba(168, 85, 247, 0.5)',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.85rem',
                                                fontWeight: '500',
                                                width: '100%',
                                                textAlign: 'center'
                                            }, children: "Watch Live \u2192" })] }) }, idx))) })) : (_jsxs("div", { style: {
                                padding: '3rem 2rem',
                                textAlign: 'center',
                                color: '#999',
                                borderRadius: '1rem',
                                border: '1px dashed rgba(168, 85, 247, 0.3)',
                                background: 'rgba(15, 23, 42, 0.5)'
                            }, children: [_jsx("p", { style: { fontSize: '1.1rem', marginBottom: '1rem' }, children: "\uD83C\uDFC1 No matches currently active" }), _jsx("p", { style: { marginBottom: '1.5rem' }, children: "Create a new match to get started!" }), _jsx("button", { onClick: handleCreateMatch, style: {
                                        padding: '0.75rem 2rem',
                                        background: 'linear-gradient(to right, #9333ea, #a855f7)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '1rem',
                                        transition: 'all 0.2s'
                                    }, onMouseEnter: (e) => (e.currentTarget.style.transform = 'scale(1.05)', e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.5)'), onMouseLeave: (e) => (e.currentTarget.style.transform = 'scale(1)', e.currentTarget.style.boxShadow = 'none'), children: "Create Match" })] }))] }) }), _jsx("section", { className: "py-5", style: { backgroundColor: 'rgba(15, 23, 42, 0.5)', backgroundImage: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 1))' }, children: _jsxs("div", { className: "container-lg", children: [_jsxs("div", { className: "text-center mb-5", children: [_jsx("h2", { style: { fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '1.5rem' }, children: "Powerful Features" }), _jsx("p", { style: { fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db' }, children: "Everything you need to compete with AI models" })] }), _jsx("div", { className: "row g-4", children: [
                                { icon: '🤖', title: 'Multi-Model Support', desc: 'Use GPT-4, Claude, Mixtral, and other LLMs' },
                                { icon: '⚡', title: 'Real-Time Gameplay', desc: 'Watch moves happen as AI models think and respond' },
                                { icon: '🏆', title: 'Elo Ratings', desc: 'Track and compare AI model performance' },
                                { icon: '🔧', title: 'Easy Setup', desc: 'Simple configuration with API validation' },
                                { icon: '🎮', title: 'Public & Private', desc: 'Create matches for yourself or share with others' },
                                { icon: '📊', title: 'Analytics', desc: 'Detailed stats, move history, and analysis' },
                            ].map((feature, i) => (_jsx("div", { className: "col-md-6 col-lg-4", children: _jsx("div", { className: "card h-100", style: {
                                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                        border: '1px solid rgba(71, 85, 105, 0.5)',
                                        borderRadius: '1rem',
                                        transition: 'all 0.3s',
                                        cursor: 'pointer'
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(168, 85, 247, 0.2)';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }, children: _jsxs("div", { className: "card-body", children: [_jsx("div", { style: { fontSize: '3.5rem', marginBottom: '1.5rem' }, children: feature.icon }), _jsx("h5", { className: "card-title fw-bold", style: { fontSize: '1.5rem', color: '#fff' }, children: feature.title }), _jsx("p", { className: "card-text text-muted", style: { fontSize: '1.05rem', lineHeight: '1.6' }, children: feature.desc })] }) }) }, i))) })] }) }), _jsx("section", { className: "py-5", style: { backgroundColor: 'linear-gradient(to bottom, rgba(15, 23, 42, 1), rgba(15, 23, 42, 0.5))' }, children: _jsxs("div", { className: "container-lg", children: [_jsxs("div", { className: "text-center mb-5", children: [_jsx("h2", { style: { fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '1.5rem' }, children: "Get Started in Minutes" }), _jsx("p", { style: { fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db' }, children: "Three simple steps to compete" })] }), _jsx("div", { className: "row g-4", children: [
                                { num: '01', title: 'Configure', icon: '⚙️', items: ['Select AI model', 'Add API key', 'Set preferences'] },
                                { num: '02', title: 'Test', icon: '🧪', items: ['Validate connection', 'Test API call', 'Verify response'] },
                                { num: '03', title: 'Compete', icon: '🚀', items: ['Launch your bot', 'Get matched', 'Watch live'] }
                            ].map((step, i) => (_jsx("div", { className: "col-md-4", children: _jsxs("div", { className: "card h-100", style: {
                                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                        border: '1px solid rgba(71, 85, 105, 0.5)',
                                        borderRadius: '1rem',
                                        padding: '2rem',
                                        transition: 'all 0.3s'
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                                    }, children: [_jsx("div", { style: {
                                                width: '4rem',
                                                height: '4rem',
                                                background: 'linear-gradient(to right, #9333ea, #ec4899)',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                fontSize: '1.5rem',
                                                marginBottom: '1.5rem',
                                                boxShadow: '0 20px 25px -5px rgba(168, 85, 247, 0.5)'
                                            }, children: step.num }), _jsx("div", { style: { fontSize: '2.5rem', marginBottom: '1.5rem' }, children: step.icon }), _jsx("h3", { className: "fw-bold", style: { fontSize: '1.75rem', color: '#fff', marginBottom: '1.5rem' }, children: step.title }), _jsx("ul", { className: "list-unstyled", children: step.items.map((item, j) => (_jsxs("li", { className: "d-flex gap-3 mb-3", style: { color: '#d1d5db', fontSize: '1.05rem' }, children: [_jsx("span", { style: { color: '#4ade80', fontSize: '1.25rem' }, children: "\u2713" }), _jsx("span", { children: item })] }, j))) })] }) }, i))) })] }) }), _jsx("section", { className: "py-5", children: _jsxs("div", { className: "container-lg text-center", children: [_jsx("h2", { style: { fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '2rem' }, children: "Ready to Battle?" }), _jsx("p", { style: { fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db', marginBottom: '3rem' }, children: "Create your first match and experience competitive AI chess" }), _jsxs("div", { className: "d-flex flex-column flex-sm-row gap-3 justify-content-center", children: [_jsx("button", { onClick: handleCreateMatch, className: "btn btn-lg fw-bold", style: { padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', background: 'linear-gradient(to right, #9333ea, #a855f7)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }, onMouseEnter: (e) => (e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.5)', e.currentTarget.style.transform = 'scale(1.05)'), onMouseLeave: (e) => (e.currentTarget.style.boxShadow = 'none', e.currentTarget.style.transform = 'scale(1)'), children: "Create Match" }), _jsx(Link, { to: "/lobby", className: "btn btn-lg fw-bold", style: { padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'), children: "Configure Bot" })] })] }) })] }));
}
/**
 * Layout Component with Navbar
 */
function Layout({ children }) {
    return (_jsxs("div", { className: "d-flex flex-column", style: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }, children: [_jsx("nav", { className: "navbar navbar-dark sticky-top", style: { backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(168, 85, 247, 0.2)' }, children: _jsx("div", { className: "container-lg", children: _jsxs("div", { className: "d-flex justify-content-between align-items-center w-100", children: [_jsxs(Link, { to: "/", style: { display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textDecoration: 'none' }, children: [_jsx("div", { style: { fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }, children: "\u265F" }), _jsx("h1", { className: "h2 text-white mb-0", children: "LLMArena" })] }), _jsxs("div", { style: { display: 'flex', gap: '12px' }, children: [_jsx(Link, { to: "/leaderboard", className: "btn d-flex align-items-center gap-2", style: { color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)', textDecoration: 'none' }, children: _jsx("span", { children: "\uD83C\uDFC6 Leaderboard" }) }), _jsxs(Link, { to: "/", className: "btn d-flex align-items-center gap-2", style: { color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)', textDecoration: 'none' }, children: [_jsx(HomeIcon, { size: 20 }), _jsx("span", { children: "Home" })] })] })] }) }) }), _jsx("main", { className: "flex-grow-1", children: children })] }));
}
/**
 * Lobby Page Wrapper with Socket Listeners
 */
function LobbyPageWrapper() {
    const socket = useSocket();
    const setStatus = useGameStore((s) => s.setStatus);
    const setGameState = useGameStore((s) => s.setGameState);
    const navigate = useNavigate();
    useEffect(() => {
        if (!socket)
            return;
        socket.on('gameStart', (data) => {
            setStatus('in_progress');
            setGameState(data.fen, '', data.legalMoves, [], false);
            navigate('/game');
        });
        socket.on('error', (data) => {
            console.error('Socket error:', data);
            alert(`Error: ${data.message}`);
        });
        return () => {
            socket.off('gameStart');
            socket.off('error');
        };
    }, [socket, setStatus, setGameState, navigate]);
    return _jsx(LobbyPage, {});
}
/**
 * Game Page Wrapper with Socket Listeners
 */
function GamePageWrapper() {
    const socket = useSocket();
    const setStatus = useGameStore((s) => s.setStatus);
    const setGameState = useGameStore((s) => s.setGameState);
    useEffect(() => {
        if (!socket)
            return;
        socket.on('turnStart', (data) => {
            setGameState(data.fen, data.pgn, data.legalMoves, [], false);
        });
        socket.on('moveMade', (data) => {
            setGameState(data.fen, data.pgn, data.legalMoves, [], data.isCheck);
        });
        socket.on('gameOver', () => {
            setStatus('completed');
        });
        return () => {
            socket.off('turnStart');
            socket.off('moveMade');
            socket.off('gameOver');
        };
    }, [socket, setStatus, setGameState]);
    return _jsx(GamePage, {});
}
/**
 * Main App Component with Router
 */
export function App() {
    return (_jsx(Router, { children: _jsx(Layout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/lobby", element: _jsx(LobbyPageWrapper, {}) }), _jsx(Route, { path: "/game", element: _jsx(GamePageWrapper, {}) }), _jsx(Route, { path: "/game/:matchId", element: _jsx(SpectatorGame, {}) }), _jsx(Route, { path: "/leaderboard", element: _jsx(Leaderboard, {}) }), _jsx(Route, { path: "/bot/:slug", element: _jsx(BotProfile, {}) })] }) }) }));
}
export default App;
