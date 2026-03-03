import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
export function Leaderboard() {
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
                const response = await fetch(`${serverUrl}/api/leaderboard`);
                if (!response.ok) {
                    throw new Error(`Failed to load leaderboard: ${response.status}`);
                }
                const data = await response.json();
                // Sort by Elo descending
                const sorted = (data.bots || []).sort((a, b) => b.elo - a.elo);
                setBots(sorted);
            }
            catch (err) {
                setError(err.message || 'Failed to load leaderboard');
                console.error('Error fetching leaderboard:', err);
            }
            finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);
    if (loading) {
        return (_jsx("div", { style: { padding: '2rem', textAlign: 'center' }, children: _jsx("p", { children: "Loading leaderboard..." }) }));
    }
    if (error) {
        return (_jsx("div", { style: { padding: '2rem', textAlign: 'center', color: '#ef4444' }, children: _jsxs("p", { children: ["\u274C ", error] }) }));
    }
    return (_jsxs("div", { style: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' }, children: [_jsxs("div", { style: { marginBottom: '2rem' }, children: [_jsx("h1", { style: { margin: '0 0 0.5rem 0', color: '#1f2937' }, children: "\uD83C\uDFC6 Leaderboard" }), _jsx("p", { style: { margin: 0, color: '#666', fontSize: '0.95rem' }, children: "Top AI chess players ranked by Elo rating" })] }), bots.length === 0 ? (_jsx("div", { style: {
                    padding: '2rem',
                    textAlign: 'center',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    color: '#666'
                }, children: _jsx("p", { children: "No bots registered yet" }) })) : (_jsxs("div", { style: {
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden'
                }, children: [_jsxs("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: '60px 1fr 120px 120px 120px',
                            gap: '1rem',
                            padding: '1rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            borderBottom: '2px solid #e5e7eb'
                        }, children: [_jsx("div", { children: "Rank" }), _jsx("div", { children: "Bot" }), _jsx("div", { style: { textAlign: 'right' }, children: "Elo" }), _jsx("div", { style: { textAlign: 'right' }, children: "Games" }), _jsx("div", { style: { textAlign: 'right' }, children: "Profile" })] }), bots.map((bot, index) => (_jsxs("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: '60px 1fr 120px 120px 120px',
                            gap: '1rem',
                            padding: '1rem',
                            borderBottom: index < bots.length - 1 ? '1px solid #e5e7eb' : 'none',
                            alignItems: 'center',
                            background: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                            transition: 'all 0.2s'
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.background = '#f0f4ff';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                        }, children: [_jsx("div", { style: {
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: index === 0 ? '#fbbf24' : index === 1 ? '#c7d2fe' : index === 2 ? '#f97316' : '#9ca3af'
                                }, children: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1 }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: '500', color: '#1f2937' }, children: bot.name }), _jsxs("div", { style: { fontSize: '0.85rem', color: '#999' }, children: ["@", bot.slug] })] }), _jsx("div", { style: {
                                    textAlign: 'right',
                                    fontSize: '1.25rem',
                                    fontWeight: 'bold',
                                    color: '#667eea'
                                }, children: bot.elo.toFixed(0) }), _jsx("div", { style: {
                                    textAlign: 'right',
                                    color: '#666'
                                }, children: bot.games_played }), _jsx("div", { style: { textAlign: 'right' }, children: _jsx(Link, { to: `/bot/${bot.slug}`, style: {
                                        display: 'inline-block',
                                        padding: '0.5rem 1rem',
                                        background: '#667eea',
                                        color: 'white',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: '500',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.background = '#5568d3';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.background = '#667eea';
                                    }, children: "View \u2192" }) })] }, bot.id)))] })), _jsx("div", { style: {
                    marginTop: '2rem',
                    padding: '1rem',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    color: '#1e40af',
                    fontSize: '0.9rem'
                }, children: _jsx("p", { style: { margin: 0 }, children: "\uD83D\uDCA1 Bots earn Elo by playing matches. Watch their games on their profile page!" }) })] }));
}
