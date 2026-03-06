import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import io from 'socket.io-client';

export default function ResearchDashboard() {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ whiteWins: 0, blackWins: 0, totalGames: 0 });
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('game-update', (data: any) => {
      setFen(data.fen);
      setStats(data.stats);
    });

    newSocket.on('batch-complete', () => {
      setStatus('complete');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const startPaperBatch = async () => {
    setStatus('running');
    await fetch('http://localhost:3001/api/research/batch-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalGames: 50,
        whiteModel: 'tinyllama:latest',
        blackModel: 'phi3:latest'
      })
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">
        🧠 LLM Chess Research (Paper Mode)
      </h1>

      <div className="mb-12 p-4 border-2 border-gray-200 rounded-lg">
        <Chessboard position={fen} boardOrientation="white" />
      </div>

      <div className="grid md:grid-cols-4 gap-6 mb-8 p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.whiteWins}</div>
          <div>TinyLlama Wins</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.blackWins}</div>
          <div>Phi3 Wins</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{stats.totalGames}</div>
          <div>Total Games</div>
        </div>
        <div className="text-center">
          <span
            className={`px-3 py-1 rounded-full text-sm font-bold ${
              status === 'running'
                ? 'bg-yellow-200 text-yellow-800'
                : status === 'complete'
                  ? 'bg-green-200 text-green-800'
                  : 'bg-gray-200'
            }`}
          >
            {status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={startPaperBatch}
          disabled={status === 'running'}
          className="text-xl px-12 py-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold shadow-xl rounded-lg disabled:opacity-60"
        >
          {status === 'idle'
            ? '🚀 START 50-GAME RESEARCH BATCH'
            : status === 'running'
              ? '⏳ RESEARCH RUNNING... (LEAVE ON)'
              : '✅ PAPER DATA READY in research/ folder'}
        </button>
        <p className="mt-4 text-sm text-gray-600">Leave laptop on overnight for 100+ games</p>
      </div>
    </div>
  );
}
