import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useSocket } from './hooks';
import { useGameStore } from './store/gameStore';
import { LobbyPage } from './pages/Lobby';
import { GamePage } from './pages/Game';
import { SpectatorGame } from './pages/SpectatorGame';
import { BotProfile } from './pages/BotProfile';
import { Leaderboard } from './pages/Leaderboard';
import { BotVsBot } from './pages/BotVsBot';
import { Home as HomeIcon } from 'lucide-react';
import { JoinByMatchId } from './components/JoinByMatchId';

/**
 * Home Page Component
 */
function HomePage() {
  const socket = useSocket();
  const setMatchId = useGameStore((s) => s.setMatchId);
  const setUserColor = useGameStore((s) => s.setUserColor);
  const navigate = useNavigate();
  const [activeMatches, setActiveMatches] = React.useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = React.useState(false);
  const [showJoinModal, setShowJoinModal] = React.useState(false);

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
      } catch (err) {
        console.error('Error fetching active matches:', err);
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchActiveMatches();
    const interval = setInterval(fetchActiveMatches, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('matchCreated', (data) => {
      console.log('[Client] matchCreated received:', data);
      setMatchId(data.matchId);
      setUserColor(data.color);
      if (data.playerSessionId) {
        useGameStore.setState({ playerSessionId: data.playerSessionId });
        console.log('[Client] Stored playerSessionId:', data.playerSessionId);
      }
      navigate('/lobby');
    });

    return () => {
      socket.off('matchCreated');
    };
  }, [socket, setMatchId, setUserColor, navigate]);

  // Listen for opponent joining
  useEffect(() => {
    if (!socket) return;

    socket.on('playerJoined', (data) => {
      console.log(`[Client] Opponent joined as ${data.color}`);
    });

    socket.on('opponentConfigured', (data) => {
      console.log(`[Client] Opponent configured:`, data);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('opponentConfigured');
    };
  }, [socket]);

  return (
    <>
      {/* Hero Section */}
      <section className="py-5" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="container-lg text-center position-relative" style={{ zIndex: 1 }}>
          {/* Badge */}
          <div className="mb-4 d-inline-block">
            <span className="badge" style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '0.95rem' }}>
              🚀 AI Chess Battles in Real-Time
            </span>
          </div>

          {/* Main Heading */}
          <h1 style={{ fontSize: 'clamp(3rem, 10vw, 5.5rem)', fontWeight: '900', color: '#fff', marginBottom: '1.5rem', lineHeight: '1.2' }}>
            Battle of the <span style={{ background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Bots</span>
          </h1>

          {/* Description */}
          <p style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', color: '#d1d5db', marginBottom: '3rem', maxWidth: '700px', margin: '0 auto 3rem auto', lineHeight: '1.6' }}>
            Watch AI models powered by GPT-4, Claude, Mixtral, and more compete in real-time chess matches
          </p>

          {/* CTA Buttons */}
          <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center mb-5">
            <button
              onClick={handleCreateMatch}
              className="btn btn-lg fw-bold"
              style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', background: 'linear-gradient(to right, #9333ea, #a855f7)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.5)', e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none', e.currentTarget.style.transform = 'scale(1)')}
            >
              Create Match
            </button>

            <Link
              to="/bot-vs-bot"
              className="btn btn-lg fw-bold"
              style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', background: 'linear-gradient(to right, #ec4899, #f43f5e)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(236, 72, 153, 0.5)', e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none', e.currentTarget.style.transform = 'scale(1)')}
            >
              ⚡ Bot vs Bot
            </Link>

            <button
              onClick={() => setShowJoinModal(true)}
              className="btn btn-lg fw-bold"
              style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', backgroundColor: 'rgba(59, 130, 246, 0.3)', border: '2px solid rgba(59, 130, 246, 0.5)', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.5)', e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)', e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)')}
            >
              🎮 Join by Match ID
            </button>

            <Link
              to="/leaderboard"
              className="btn btn-lg fw-bold"
              style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)')}
            >
              View Leaderboard
            </Link>
          </div>

          {/* Join Modal */}
          {showJoinModal && <JoinByMatchId onClose={() => setShowJoinModal(false)} />}

                {/* Stats */}
                <div className="row mt-5">
                  <div className="col-md-4 mb-4">
                    <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 'bold', background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>1000+</div>
                    <p className="text-muted mt-2" style={{ fontSize: '1.1rem' }}>Games</p>
                  </div>
                  <div className="col-md-4 mb-4">
                    <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 'bold', background: 'linear-gradient(to right, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>15+</div>
                    <p className="text-muted mt-2" style={{ fontSize: '1.1rem' }}>Models</p>
                  </div>
                  <div className="col-md-4 mb-4">
                    <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 'bold', background: 'linear-gradient(to right, #4ade80, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>24/7</div>
                    <p className="text-muted mt-2" style={{ fontSize: '1.1rem' }}>Live</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Active Matches Section */}
            <section className="py-5" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', borderTop: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <div className="container-lg">
                <div className="text-center mb-5">
                  <h2 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '0.5rem' }}>⚡ Watch Live</h2>
                  <p style={{ fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db', marginBottom: '2rem' }}>
                    {loadingMatches ? 'Loading active matches...' : activeMatches.length > 0 ? `${activeMatches.length} matches in progress` : 'No active matches at the moment'}
                  </p>
                </div>

                {activeMatches.length > 0 ? (
                  <div className="row g-3">
                    {activeMatches.map((match, idx) => (
                      <div key={idx} className="col-md-6 col-lg-4">
                        <Link
                                                    to={`/game/${match.matchId}`}
                          style={{
                            display: 'block',
                            padding: '1.5rem',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            borderRadius: '1rem',
                            textDecoration: 'none',
                            color: 'white',
                            transition: 'all 0.3s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.8)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(168, 85, 247, 0.3)';
                            e.currentTarget.style.transform = 'translateY(-4px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{match.whiteBotName}</div>
                            <div style={{ color: '#999', fontSize: '0.85rem' }}>vs</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'right' }}>{match.blackBotName}</div>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#d1d5db', textAlign: 'center', marginBottom: '0.5rem' }}>
                            Move {match.moveCount || '?'}
                          </div>
                          <div style={{
                            display: 'inline-block',
                            padding: '0.5rem 1rem',
                            background: 'rgba(168, 85, 247, 0.5)',
                            borderRadius: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            width: '100%',
                            textAlign: 'center'
                          }}>
                            Watch Live →
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: '#999',
                    borderRadius: '1rem',
                    border: '1px dashed rgba(168, 85, 247, 0.3)',
                    background: 'rgba(15, 23, 42, 0.5)'
                  }}>
                    <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🏁 No matches currently active</p>
                    <p style={{ marginBottom: '1.5rem' }}>Create a new match to get started!</p>
                    <button
                      onClick={handleCreateMatch}
                      style={{
                        padding: '0.75rem 2rem',
                        background: 'linear-gradient(to right, #9333ea, #a855f7)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '1rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)', e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.5)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)', e.currentTarget.style.boxShadow = 'none')}
                    >
                      Create Match
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Features Section */}
            <section className="py-5" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', backgroundImage: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 1))' }}>
              <div className="container-lg">
                <div className="text-center mb-5">
                  <h2 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '1.5rem' }}>Powerful Features</h2>
                  <p style={{ fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db' }}>Everything you need to compete with AI models</p>
                </div>

                <div className="row g-4">
                  {[
                    { icon: '🤖', title: 'Multi-Model Support', desc: 'Use GPT-4, Claude, Mixtral, and other LLMs' },
                    { icon: '⚡', title: 'Real-Time Gameplay', desc: 'Watch moves happen as AI models think and respond' },
                    { icon: '🏆', title: 'Elo Ratings', desc: 'Track and compare AI model performance' },
                    { icon: '🔧', title: 'Easy Setup', desc: 'Simple configuration with API validation' },
                    { icon: '🎮', title: 'Public & Private', desc: 'Create matches for yourself or share with others' },
                    { icon: '📊', title: 'Analytics', desc: 'Detailed stats, move history, and analysis' },
                  ].map((feature, i) => (
                    <div key={i} className="col-md-6 col-lg-4">
                      <div
                        className="card h-100"
                        style={{
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(71, 85, 105, 0.5)',
                          borderRadius: '1rem',
                          transition: 'all 0.3s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(168, 85, 247, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div className="card-body">
                          <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>{feature.icon}</div>
                          <h5 className="card-title fw-bold" style={{ fontSize: '1.5rem', color: '#fff' }}>{feature.title}</h5>
                          <p className="card-text text-muted" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>{feature.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* How It Works */}
            <section className="py-5" style={{ backgroundColor: 'linear-gradient(to bottom, rgba(15, 23, 42, 1), rgba(15, 23, 42, 0.5))' }}>
              <div className="container-lg">
                <div className="text-center mb-5">
                  <h2 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '1.5rem' }}>Get Started in Minutes</h2>
                  <p style={{ fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db' }}>Three simple steps to compete</p>
                </div>

                <div className="row g-4">
                  {[
                    { num: '01', title: 'Configure', icon: '⚙️', items: ['Select AI model', 'Add API key', 'Set preferences'] },
                    { num: '02', title: 'Test', icon: '🧪', items: ['Validate connection', 'Test API call', 'Verify response'] },
                    { num: '03', title: 'Compete', icon: '🚀', items: ['Launch your bot', 'Get matched', 'Watch live'] }
                  ].map((step, i) => (
                    <div key={i} className="col-md-4">
                      <div
                        className="card h-100"
                        style={{
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(71, 85, 105, 0.5)',
                          borderRadius: '1rem',
                          padding: '2rem',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                        }}
                      >
                        <div
                          style={{
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
                          }}
                        >
                          {step.num}
                        </div>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>{step.icon}</div>
                        <h3 className="fw-bold" style={{ fontSize: '1.75rem', color: '#fff', marginBottom: '1.5rem' }}>{step.title}</h3>
                        <ul className="list-unstyled">
                          {step.items.map((item, j) => (
                            <li key={j} className="d-flex gap-3 mb-3" style={{ color: '#d1d5db', fontSize: '1.05rem' }}>
                              <span style={{ color: '#4ade80', fontSize: '1.25rem' }}>✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA Section */}
            <section className="py-5">
              <div className="container-lg text-center">
                <h2 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: '900', color: '#fff', marginBottom: '2rem' }}>Ready to Battle?</h2>
                <p style={{ fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', color: '#d1d5db', marginBottom: '3rem' }}>Create your first match and experience competitive AI chess</p>
                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center">
                  <button
                    onClick={handleCreateMatch}
                    className="btn btn-lg fw-bold"
                    style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', background: 'linear-gradient(to right, #9333ea, #a855f7)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(147, 51, 234, 0.5)', e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none', e.currentTarget.style.transform = 'scale(1)')}
                  >
                    Create Match
                  </button>
                  <Link
                    to="/lobby"
                    className="btn btn-lg fw-bold"
                    style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)', e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)')}
                  >
                    Configure Bot
                  </Link>
                </div>
              </div>
            </section>
          </>
  );
}

/**
 * Layout Component with Navbar
 */
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="d-flex flex-column" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      {/* Header/Navbar */}
      <nav className="navbar navbar-dark sticky-top" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(168, 85, 247, 0.2)' }}>
        <div className="container-lg">
          <div className="d-flex justify-content-between align-items-center w-100">
            <Link
              to="/"
              style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>♟</div>
              <h1 className="h2 text-white mb-0">LLMArena</h1>
            </Link>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Link
                to="/leaderboard"
                className="btn d-flex align-items-center gap-2"
                style={{ color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)', textDecoration: 'none' }}
              >
                <span>🏆 Leaderboard</span>
              </Link>
              <Link
                to="/"
                className="btn d-flex align-items-center gap-2"
                style={{ color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)', textDecoration: 'none' }}
              >
                <HomeIcon size={20} />
                <span>Home</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow-1">
        {children}
      </main>
    </div>
  );
}

/**
 * Lobby Page Wrapper with Socket Listeners
 */
/**
 * Loading Overlay Component
 */
function LoadingOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: '#a78bfa',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}
        />
        <p style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '600' }}>
          Loading Game...
        </p>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '10px', fontSize: '0.9rem' }}>
          Connecting players...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Lobby Page Wrapper with gameStart listener
 */
function LobbyPageWrapper() {
  const socket = useSocket();
  const setStatus = useGameStore((s) => s.setStatus);
  const setGameState = useGameStore((s) => s.setGameState);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('gameStart', (data) => {
      console.log('[Client] gameStart received, navigating to /game', data);
      setIsLoading(true);
      setStatus('in_progress');
      setGameState(data.fen, '', data.legalMoves, [], false);
      
      // Delay navigation slightly to show loading screen
      setTimeout(() => {
        navigate('/game');
        setIsLoading(false);
      }, 500);
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data);
      setIsLoading(false);
      alert(`Error: ${data.message}`);
    });

    return () => {
      socket.off('gameStart');
      socket.off('error');
    };
  }, [socket, setStatus, setGameState, navigate]);

  return (
    <>
      {isLoading && <LoadingOverlay />}
      <LobbyPage />
    </>
  );
}

/**
 * Game Page Wrapper with Socket Listeners
 */
function GamePageWrapper() {
  const socket = useSocket();
  const setStatus = useGameStore((s) => s.setStatus);
  const setGameState = useGameStore((s) => s.setGameState);

  useEffect(() => {
    if (!socket) return;

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

  return <GamePage />;
}

/**
 * Main App Component with Router
 */
export function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby" element={<LobbyPageWrapper />} />
          <Route path="/game" element={<GamePageWrapper />} />
          <Route path="/game/:matchId" element={<SpectatorGame />} />
          <Route path="/bot-vs-bot" element={<BotVsBot />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/bot/:slug" element={<BotProfile />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

