import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
export function BotProfile() {
    const { slug } = useParams();
    const [bot, setBot] = useState(null);
    const [stats, setStats] = useState(null);
    const [recentMatches, setRecentMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchBot = async () => {
            try {
                const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
                const response = await fetch(`${serverUrl}/api/bots/${slug}`);
                if (!response.ok) {
                    throw new Error(`Bot not found: ${response.status}`);
                }
                const data = await response.json();
                setBot(data.bot);
                setStats(data.stats);
                setRecentMatches(data.recentMatches || []);
            }
            catch (err) {
                setError(err.message || 'Failed to load bot profile');
                console.error('Error fetching bot:', err);
            }
            finally {
                setLoading(false);
            }
        };
        if (slug) {
            fetchBot();
        }
    }, [slug]);
    if (loading) {
        return (_jsx("div", { style: { padding: '2rem', textAlign: 'center' }, children: _jsx("p", { children: "Loading bot profile..." }) }));
    }
    if (error || !bot) {
        return (_jsx("div", { style: { padding: '2rem', textAlign: 'center', color: '#ef4444' }, children: _jsxs("p", { children: ["\u274C ", error || 'Bot not found'] }) }));
    }
    return (_jsxs("div", { style: { padding: '2rem', maxWidth: '900px', margin: '0 auto' }, children: [_jsx("div", { style: {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '2rem',
                    borderRadius: '12px',
                    color: 'white',
                    marginBottom: '2rem'
                }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start' }, children: [_jsxs("div", { children: [_jsx("h1", { style: { margin: '0 0 0.5rem 0', fontSize: '2.5rem' }, children: bot.name }), _jsxs("p", { style: { margin: '0 0 1rem 0', opacity: 0.9, fontSize: '1.1rem' }, children: ["Model: ", _jsx("code", { style: { background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }, children: bot.model })] }), _jsxs("p", { style: { margin: 0, opacity: 0.8 }, children: ["@", bot.slug] })] }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsx("div", { style: { fontSize: '3rem', fontWeight: 'bold', marginBottom: '0.5rem' }, children: bot.elo }), _jsx("div", { style: { opacity: 0.9 }, children: "Elo Rating" })] })] }) }), stats && (_jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                }, children: [_jsxs("div", { style: {
                            background: '#f0fdf4',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #86efac'
                        }, children: [_jsx("div", { style: { fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }, children: "Games Played" }), _jsx("div", { style: { fontSize: '2rem', fontWeight: 'bold', color: '#15803d' }, children: stats.gamesPlayed })] }), _jsxs("div", { style: {
                            background: '#fefce8',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #fde047'
                        }, children: [_jsx("div", { style: { fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }, children: "Wins" }), _jsx("div", { style: { fontSize: '2rem', fontWeight: 'bold', color: '#ca8a04' }, children: stats.wins })] }), _jsxs("div", { style: {
                            background: '#fee2e2',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #fca5a5'
                        }, children: [_jsx("div", { style: { fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }, children: "Losses" }), _jsx("div", { style: { fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }, children: stats.losses })] }), _jsxs("div", { style: {
                            background: '#f0f9ff',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #7dd3fc'
                        }, children: [_jsx("div", { style: { fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }, children: "Draws" }), _jsx("div", { style: { fontSize: '2rem', fontWeight: 'bold', color: '#0284c7' }, children: stats.draws })] }), _jsxs("div", { style: {
                            background: '#f5f3ff',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #d8b4fe',
                            gridColumn: 'span 1'
                        }, children: [_jsx("div", { style: { fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }, children: "Win Rate" }), _jsxs("div", { style: { fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed' }, children: [stats.winRate, "%"] })] })] })), _jsxs("div", { children: [_jsx("h2", { style: { marginTop: '2rem', marginBottom: '1rem', color: '#1f2937' }, children: "Recent Matches" }), recentMatches.length === 0 ? (_jsx("p", { style: { color: '#999', fontStyle: 'italic', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }, children: "No matches yet" })) : (_jsx("div", { style: {
                            display: 'grid',
                            gap: '0.75rem'
                        }, children: recentMatches.map((match, idx) => {
                            const isWhiteBot = match.white_bot_id === bot.id;
                            const resultEmoji = {
                                '1-0': isWhiteBot ? '✅' : '❌',
                                '0-1': isWhiteBot ? '❌' : '✅',
                                '1/2-1/2': '🤝'
                            }[match.result] || '?';
                            return (_jsxs("a", { href: `/game/${match.id}`, style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1rem',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#9ca3af';
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                }, children: [_jsxs("div", { children: [_jsxs("div", { style: { fontWeight: '500', marginBottom: '0.25rem' }, children: ["Match ", match.id.substring(0, 8)] }), _jsxs("div", { style: { fontSize: '0.875rem', color: '#666' }, children: ["Result: ", _jsx("strong", { children: match.result })] }), match.started_at && (_jsx("div", { style: { fontSize: '0.875rem', color: '#999' }, children: new Date(match.started_at).toLocaleDateString() }))] }), _jsx("div", { style: { fontSize: '1.5rem' }, children: resultEmoji })] }, idx));
                        }) }))] }), _jsx("div", { style: { marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }, children: _jsx("a", { href: "/leaderboard", style: {
                        color: '#667eea',
                        textDecoration: 'none',
                        fontSize: '0.95rem',
                        fontWeight: '500'
                    }, children: "\u2190 Back to Leaderboard" }) })] }));
}
