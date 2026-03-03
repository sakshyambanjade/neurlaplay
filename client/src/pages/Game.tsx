import React from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * Game page - Live spectator view
 * Displays ongoing games between bots in real-time
 */
export function GamePage() {
  const store = useGameStore();

  const currentTurn = store.fen ? (store.fen.split(' ')[1] === 'w' ? 'White' : 'Black') : '';
  const isGameActive = store.status === 'in_progress';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }} className="mb-5">
            {isGameActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-3 rounded-full animate-pulse">
                <div className="w-4 h-4 bg-red-200 rounded-full"></div>
                <span className="text-red-100 font-bold text-base">LIVE GAME</span>
              </div>
            )}
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">Live Chess Match</h1>
          <p className="text-gray-400 text-lg">Match ID: <span className="text-purple-400 font-mono text-xl">{store.matchId || 'N/A'}</span></p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Board Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Chess Board Placeholder */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-10 aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl mb-6">♟️</div>
                <p className="text-gray-300 font-semibold mb-3 text-2xl">Chess Board Component</p>
                <p className="text-gray-500 text-lg">Ready for implementation</p>
                {store.fen && (
                  <p className="text-gray-600 text-sm mt-4 font-mono">FEN: {store.fen.substring(0, 40)}...</p>
                )}
              </div>
            </div>

            {/* Move History */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="text-3xl">⚡</span>
                Move History
              </h2>
              <div className="bg-slate-800/50 rounded-xl p-5 max-h-64 overflow-y-auto">
                {store.moves && store.moves.length > 0 ? (
                  <div className="grid grid-cols-4 gap-4">
                    {store.moves.map((move, idx) => (
                      <div key={idx} className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition" style={{ cursor: 'default' }}>
                        <div className="text-gray-400 text-sm mb-2">{Math.floor(idx / 2) + 1}.</div>
                        <div className="text-purple-300 font-mono font-bold text-base">{move.uci}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-10 text-lg">No moves yet - game awaiting start...</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Players & Stats */}
          <div className="space-y-8">
            {/* Game Status */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8">
              <h3 className="text-base font-bold text-gray-400 mb-6 uppercase tracking-wider">Game Status</h3>
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Status</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={`w-3 h-3 rounded-full ${isGameActive ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    <p className="text-white font-semibold capitalize text-lg">{store.status.replace('_', ' ')}</p>
                  </div>
                </div>
                {isGameActive && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Current Turn</p>
                    <p className="text-white font-semibold text-lg" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="text-2xl">🕒</span>
                      {currentTurn}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 mb-2">Total Moves</p>
                  <p className="text-3xl font-bold text-purple-400">{store.moves?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* White Player */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} className="mb-6">
                <div className="text-5xl">⚪</div>
                <div>
                  <p className="text-sm text-gray-400">White</p>
                  <p className="text-xl font-bold text-white">{store.whiteBot?.botName || 'Waiting...'}</p>
                </div>
              </div>
              <div className="space-y-3 text-base">
                <p className="text-gray-400">{store.whiteBot?.model || '-'}</p>
                {store.whiteBot?.eloRating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-4 py-3">
                    <span className="text-2xl">🏆</span>
                    <span className="text-yellow-200 font-semibold text-lg">Elo: {store.whiteBot.eloRating}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Black Player */}
            <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} className="mb-6">
                <div className="text-5xl">⚫</div>
                <div>
                  <p className="text-sm text-gray-400">Black</p>
                  <p className="text-xl font-bold text-white">{store.blackBot?.botName || 'Waiting...'}</p>
                </div>
              </div>
              <div className="space-y-3 text-base">
                <p className="text-gray-400">{store.blackBot?.model || '-'}</p>
                {store.blackBot?.eloRating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="bg-blue-500/20 border border-blue-500/50 rounded-lg px-4 py-3">
                    <span className="text-2xl">🏆</span>
                    <span className="text-blue-200 font-semibold text-lg">Elo: {store.blackBot.eloRating}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur-lg border border-blue-500/30 rounded-2xl p-6">
              <div style={{ display: 'flex', gap: '16px' }}>
                <span className="text-3xl flex-shrink-0">👁️</span>
                <div>
                  <p className="text-blue-200 text-base font-semibold mb-2">Spectator Mode</p>
                  <p className="text-blue-200/70 text-sm">Real-time game view. Bots play autonomously.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
