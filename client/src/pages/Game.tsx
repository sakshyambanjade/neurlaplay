import React from 'react';
import { useGameStore } from '../store/gameStore';
import { Clock, Zap, Award, Eye } from 'lucide-react';

/**
 * Game page - Live spectator view
 * Displays ongoing games between bots in real-time
 */
export function GamePage() {
  const store = useGameStore();

  const currentTurn = store.fen ? (store.fen.split(' ')[1] === 'w' ? 'White' : 'Black') : '';
  const isGameActive = store.status === 'in_progress';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            {isGameActive && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 rounded-full animate-pulse">
                <div className="w-3 h-3 bg-red-200 rounded-full"></div>
                <span className="text-red-100 font-bold text-sm">LIVE GAME</span>
              </div>
            )}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Live Chess Match</h1>
          <p className="text-gray-400">Match ID: <span className="text-purple-400 font-mono">{store.matchId || 'N/A'}</span></p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Board Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chess Board Placeholder */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur border border-purple-500/30 rounded-xl p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">♟️</div>
                <p className="text-gray-300 font-semibold mb-2">Chess Board Component</p>
                <p className="text-gray-500 text-sm">Ready for implementation</p>
                {store.fen && (
                  <p className="text-gray-600 text-xs mt-3 font-mono">FEN: {store.fen.substring(0, 40)}...</p>
                )}
              </div>
            </div>

            {/* Move History */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap size={20} className="text-purple-400" />
                Move History
              </h2>
              <div className="bg-slate-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                {store.moves && store.moves.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {store.moves.map((move, idx) => (
                      <div key={idx} className="bg-slate-700/50 rounded p-3 hover:bg-slate-700 transition">
                        <div className="text-gray-400 text-xs mb-1">{Math.floor(idx / 2) + 1}.</div>
                        <div className="text-purple-300 font-mono font-bold">{move.uci}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No moves yet - game awaiting start...</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Players & Stats */}
          <div className="space-y-6">
            {/* Game Status */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Game Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isGameActive ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    <p className="text-white font-semibold capitalize">{store.status.replace('_', ' ')}</p>
                  </div>
                </div>
                {isGameActive && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Turn</p>
                    <p className="text-white font-semibold flex items-center gap-2">
                      <Clock size={16} className="text-purple-400" />
                      {currentTurn}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Moves</p>
                  <p className="text-2xl font-bold text-purple-400">{store.moves?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* White Player */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur border border-white/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">⚪</div>
                <div>
                  <p className="text-xs text-gray-400">White</p>
                  <p className="text-lg font-bold text-white">{store.whiteBot?.botName || 'Waiting...'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">{store.whiteBot?.model || '-'}</p>
                {store.whiteBot?.eloRating && (
                  <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 rounded px-3 py-2">
                    <Award size={16} className="text-yellow-400" />
                    <span className="text-yellow-200 font-semibold">Elo: {store.whiteBot.eloRating}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Black Player */}
            <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">⚫</div>
                <div>
                  <p className="text-xs text-gray-400">Black</p>
                  <p className="text-lg font-bold text-white">{store.blackBot?.botName || 'Waiting...'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">{store.blackBot?.model || '-'}</p>
                {store.blackBot?.eloRating && (
                  <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/50 rounded px-3 py-2">
                    <Award size={16} className="text-blue-400" />
                    <span className="text-blue-200 font-semibold">Elo: {store.blackBot.eloRating}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur border border-blue-500/30 rounded-xl p-4">
              <div className="flex gap-3">
                <Eye size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-200 text-sm font-semibold mb-1">Spectator Mode</p>
                  <p className="text-blue-200/70 text-xs">Real-time game view. Bots play autonomously.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
