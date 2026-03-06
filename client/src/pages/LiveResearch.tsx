import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import io from 'socket.io-client';

function LiveResearch() {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ 
    whiteWins: 0, 
    blackWins: 0, 
    draws: 0, 
    totalGames: 0,
    currentGame: 0 
  });
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Custom CSS for animations and effects
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.3); }
        50% { box-shadow: 0 0 40px rgba(255, 255, 255, 0.6); }
      }
      
      @keyframes gradient-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      .glass-card {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        transition: all 0.3s ease;
      }
      
      .glass-card:hover {
        background: rgba(255, 255, 255, 0.15);
        transform: translateY(-5px);
        box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.5);
      }
      
      .stat-card {
        animation: float 3s ease-in-out infinite;
        transition: all 0.3s ease;
      }
      
      .stat-card:nth-child(1) { animation-delay: 0s; }
      .stat-card:nth-child(2) { animation-delay: 0.2s; }
      .stat-card:nth-child(3) { animation-delay: 0.4s; }
      .stat-card:nth-child(4) { animation-delay: 0.6s; }
      
      .stat-card:hover {
        transform: scale(1.05) translateY(-10px);
      }
      
      .chess-card {
        background: linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      }
      
      .chess-card:hover {
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
      }
      
      .live-badge {
        animation: pulse-glow 2s infinite;
        background: linear-gradient(45deg, #ff6b6b, #ee5a6f, #ff6b6b);
        background-size: 200% 200%;
        animation: gradient-shift 3s ease infinite, pulse-glow 2s infinite;
      }
      
      .animated-gradient-bg {
        background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #4facfe);
        background-size: 400% 400%;
        animation: gradient-shift 15s ease infinite;
      }
      
      .stat-number {
        font-size: 4rem;
        font-weight: 800;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }
      
      .stat-card:hover .stat-number {
        transform: scale(1.1);
      }
      
      .glow-button {
        position: relative;
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .glow-button:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 0 30px rgba(255, 255, 255, 0.5);
      }
      
      .glow-button:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.6s, height 0.6s;
      }
      
      .glow-button:hover:before {
        width: 300px;
        height: 300px;
      }
    `;
    document.head.appendChild(style);

    // Bootstrap CDN
    const bootstrapCSS = document.createElement('link');
    bootstrapCSS.rel = 'stylesheet';
    bootstrapCSS.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    document.head.appendChild(bootstrapCSS);

    // Socket connection
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('game-update', (data: any) => {
      console.log('Live update:', data);
      if (data.fen) {
        setFen(data.fen);
      }
      if (data.stats) {
        setStats(prev => ({ ...prev, ...data.stats }));
      }
    });

    newSocket.on('batch-progress', (data: any) => {
      setStats(prev => ({ ...prev, currentGame: data.currentGame }));
    });

    newSocket.on('batch-complete', () => {
      setStatus('complete');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const startBatch = async () => {
    setStatus('running');
    await fetch('http://localhost:3001/api/research/live-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalGames: 200,
        whiteModel: 'tinyllama:latest',
        blackModel: 'phi3:latest'
      })
    });
  };

  return (
    <div className="min-vh-100 animated-gradient-bg d-flex align-items-center" style={{ padding: '2rem 0' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-11 col-xl-10">
            {/* HEADER */}
            <div className="text-center mb-5" style={{ animation: 'float 4s ease-in-out infinite' }}>
              <div className="mb-4">
                <span style={{ fontSize: '4rem' }}>♟️</span>
              </div>
              <h1 className="display-3 fw-bold text-white mb-3" style={{ 
                textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
                letterSpacing: '2px'
              }}>
                <span className="live-badge text-white px-4 py-2 rounded-pill me-3" style={{
                  fontSize: '1.2rem',
                  fontWeight: '700'
                }}>
                  ⚡ LIVE
                </span>
                AI Chess Arena
              </h1>
              <p className="lead text-white mb-0" style={{ 
                fontSize: '1.5rem',
                textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
                opacity: 0.95
              }}>
                Watch LLMs Battle in Real-Time • TinyLlama vs Phi3
              </p>
            </div>

            {/* LIVE CHESSBOARD */}
            <div className="chess-card mb-5">
              <div className="glass-card text-white p-4" style={{
                borderRadius: '20px 20px 0 0',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(118, 75, 162, 0.9))'
              }}>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="mb-0 fw-bold" style={{ fontSize: '1.8rem' }}>
                    <span style={{ fontSize: '2rem', marginRight: '0.5rem' }}>🎮</span>
                    Game #{stats.currentGame || '—'}
                  </h3>
                  <span className={`badge fs-5 px-4 py-2 ${
                    status === 'running' ? 'bg-warning text-dark' : 
                    status === 'complete' ? 'bg-success' : 'bg-secondary'
                  }`} style={{
                    borderRadius: '50px',
                    fontWeight: '700',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                  }}>
                    {status === 'running' ? '🔥 PLAYING' : 
                     status === 'complete' ? '✅ DONE' : '⏸️ IDLE'}
                  </span>
                </div>
              </div>
              <div className="p-4" style={{ background: 'linear-gradient(to bottom, #fff, #f8f9fa)' }}>
                <div style={{ 
                  borderRadius: '15px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                  border: '3px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <Chessboard 
                    position={fen} 
                    boardOrientation="white"
                    customBoardStyle={{
                      borderRadius: '15px'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* LIVE STATS - GLASSMORPHISM CARDS */}
            <div className="row g-4 mb-5">
              <div className="col-md-3">
                <div className="glass-card stat-card text-white p-4 text-center" style={{
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.8), rgba(41, 128, 185, 0.8))'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>♔</div>
                  <div className="stat-number">{stats.whiteWins}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.9 }}>
                    TinyLlama Wins
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="glass-card stat-card text-white p-4 text-center" style={{
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.8), rgba(192, 57, 43, 0.8))'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>♚</div>
                  <div className="stat-number">{stats.blackWins}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.9 }}>
                    Phi3 Wins
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="glass-card stat-card text-white p-4 text-center" style={{
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.8), rgba(16, 185, 129, 0.8))'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🤝</div>
                  <div className="stat-number">{stats.draws}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.9 }}>
                    Draws
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="glass-card stat-card text-white p-4 text-center" style={{
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.8), rgba(142, 68, 173, 0.8))'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
                  <div className="stat-number">{stats.totalGames}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.9 }}>
                    Total Games
                  </div>
                </div>
              </div>
            </div>

            {/* START BUTTON */}
            <div className="text-center">
              <button 
                className={`glow-button btn btn-lg px-5 py-4 fs-3 fw-bold ${
                  status === 'running' ? 'btn-warning text-dark' : 
                  status === 'complete' ? 'btn-success' : 'btn-light'
                }`}
                onClick={startBatch}
                disabled={status === 'running'}
                style={{
                  borderRadius: '50px',
                  minWidth: '400px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                  border: 'none',
                  letterSpacing: '1px',
                  position: 'relative'
                }}
              >
                {status === 'idle' ? '🚀 START RESEARCH BATTLE' :
                 status === 'running' ? '⚡ BATTLE IN PROGRESS...' :
                 '🎉 COMPLETE! View Results'}
              </button>
              <div className="mt-4 text-white" style={{ 
                fontSize: '1rem',
                textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                opacity: 0.9
              }}>
                <div>💡 20 games • Real Stockfish analysis • Live updates</div>
                <div className="mt-2" style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Results saved to <code style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    color: '#fff'
                  }}>research/paper-results.json</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveResearch;
