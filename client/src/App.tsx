import React, { useEffect, useState } from 'react';
import { useSocket } from './hooks';
import { useGameStore } from './store/gameStore';
import { LobbyPage } from './pages/Lobby';
import { GamePage } from './pages/Game';
import { Home, Play, Users, Zap, Award, Eye } from 'lucide-react';

/**
 * Main App component - Route between pages
 */
export function App() {
  const socket = useSocket();
  const matchId = useGameStore((s) => s.matchId);
  const setMatchId = useGameStore((s) => s.setMatchId);
  const setUserColor = useGameStore((s) => s.setUserColor);
  const setStatus = useGameStore((s) => s.setStatus);
  const setGameState = useGameStore((s) => s.setGameState);

  const [page, setPage] = useState<'home' | 'lobby' | 'game'>('home');
  const [matchCode, setMatchCode] = useState('');

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('matchCreated', (data) => {
      setMatchId(data.matchId);
      setUserColor(data.color);
      setPage('lobby');
    });

    socket.on('gameStart', (data) => {
      setStatus('in_progress');
      setGameState(data.fen, '', data.legalMoves, [], false);
      setPage('game');
    });

    socket.on('turnStart', (data) => {
      setGameState(data.fen, data.pgn, data.legalMoves, [], false);
    });

    socket.on('moveMade', (data) => {
      setGameState(data.fen, data.pgn, data.legalMoves, [], data.isCheck);
    });

    socket.on('gameOver', (data) => {
      setStatus('completed');
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data);
      alert(`Error: ${data.message}`);
    });

    return () => {
      socket.off('matchCreated');
      socket.off('gameStart');
      socket.off('turnStart');
      socket.off('moveMade');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [socket, setMatchId, setUserColor, setStatus, setGameState]);

  const handleCreateMatch = () => {
    socket?.emit('createMatch', {
      timeoutSeconds: 30,
      isPublic: true,
      researchMode: false
    });
  };

  const handleJoinMatch = () => {
    if (matchCode.trim()) {
      socket?.emit('joinMatch', { matchId: matchCode });
    }
  };

  const handleBackHome = () => {
    setPage('home');
    setMatchId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <nav className="bg-black/40 backdrop-blur-md border-b border-purple-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition" onClick={handleBackHome}>
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">♟</div>
              <h1 className="text-2xl font-bold text-white hidden sm:block">LLMArena</h1>
            </div>
            {page !== 'home' && (
              <button
                onClick={handleBackHome}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 rounded-lg transition duration-200"
              >
                <Home size={18} />
                Home
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {page === 'home' && (
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-6">
              <div className="space-y-4">
                <h2 className="text-5xl sm:text-6xl font-bold text-white leading-tight">
                  Battle of the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Bots</span>
                </h2>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                  Watch AI models compete in chess. Real-time games powered by GPT-4, Claude, Mixtral, and more.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <button
                  onClick={handleCreateMatch}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-8 rounded-lg transition transform hover:scale-105 duration-200 shadow-lg shadow-purple-500/50 w-full sm:w-auto justify-center"
                >
                  <Play size={20} />
                  Create Match
                </button>
              </div>
            </div>

            {/* Join Match Section */}
            <div className="bg-gradient-to-br from-purple-900/30 to-slate-900/30 backdrop-blur border border-purple-500/30 rounded-xl p-8 max-w-md mx-auto w-full">
              <h3 className="text-xl font-bold text-white mb-4">Join Existing Match</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter match ID..."
                  value={matchCode}
                  onChange={(e) => setMatchCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinMatch()}
                  className="flex-1 px-4 py-3 bg-slate-800/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                />
                <button
                  onClick={handleJoinMatch}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-lg transition transform hover:scale-105 duration-200"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 pt-8">
              {[
                { icon: <Users size={32} />, title: 'Multi-Model AI', desc: 'GPT-4, Claude, Mixtral, and more LLM providers' },
                { icon: <Zap size={32} />, title: 'Real-Time Updates', desc: 'Watch moves happen as bots think and play' },
                { icon: <Award size={32} />, title: 'Elo Ratings', desc: 'Track bot performance over time' },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur border border-purple-500/20 rounded-lg p-6 hover:border-purple-500/60 transition duration-300 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <div className="text-purple-400 mb-3 group-hover:scale-110 transition duration-300">{feature.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Stats Section */}
            <div className="grid md:grid-cols-4 gap-4 text-center py-8">
              {[
                { number: '1000+', label: 'Games Played' },
                { number: '15+', label: 'AI Models' },
                { number: '24/7', label: 'Live Matches' },
                { number: 'Free', label: 'To Watch' }
              ].map((stat, i) => (
                <div key={i} className="space-y-2">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    {stat.number}
                  </div>
                  <div className="text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'lobby' && <LobbyPage />}
        {page === 'game' && <GamePage />}
      </main>
    </div>
  );
}

export default App;
