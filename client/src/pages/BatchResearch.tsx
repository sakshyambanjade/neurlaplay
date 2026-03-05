import { useState, useEffect } from 'react';
import { useSocket } from '../hooks';
import { Play, Square, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GameProgress {
  gameNumber: number;
  gameId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  moves?: number;
  result?: string;
  whiteModel?: string;
  blackModel?: string;
}

/**
 * BatchResearch - One-button batch game runner for research
 * Watch 50+ games play out live with data collection
 */
export function BatchResearch() {
  const navigate = useNavigate();
  const socket = useSocket();
  
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [games, setGames] = useState<GameProgress[]>([]);
  const [totalGames, setTotalGames] = useState(50);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Timer for elapsed time
  useEffect(() => {
    if (batchStatus === 'running' && startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [batchStatus, startTime]);

  // Socket listeners for batch progress
  useEffect(() => {
    if (!socket) return;

    socket.on('batch:gameStart', (data: any) => {
      setGames(prev => prev.map(g => 
        g.gameId === data.gameId ? { ...g, status: 'running', whiteModel: data.whiteModel, blackModel: data.blackModel } : g
      ));
    });

    socket.on('batch:gameComplete', (data: any) => {
      setGames(prev => prev.map(g => 
        g.gameId === data.gameId ? { ...g, status: 'completed', moves: data.moves, result: data.result } : g
      ));
      setCompletedCount(prev => prev + 1);
    });

    socket.on('batch:gameFailed', (data: any) => {
      setGames(prev => prev.map(g => 
        g.gameId === data.gameId ? { ...g, status: 'failed', result: data.error } : g
      ));
      setFailedCount(prev => prev + 1);
    });

    socket.on('batch:progress', () => {
      // Update overall progress
    });

    socket.on('batch:complete', () => {
      setBatchStatus('completed');
    });

    socket.on('batch:failed', () => {
      setBatchStatus('failed');
    });

    return () => {
      socket.off('batch:gameStart');
      socket.off('batch:gameComplete');
      socket.off('batch:gameFailed');
      socket.off('batch:progress');
      socket.off('batch:complete');
      socket.off('batch:failed');
    };
  }, [socket]);

  const startBatch = async () => {
    try {
      const response = await fetch('/api/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalGames })
      });

      const data = await response.json();
      if (data.success) {
        setBatchStatus('running');
        setStartTime(Date.now());
        setCompletedCount(0);
        setFailedCount(0);
        
        // Initialize game list
        const gameList: GameProgress[] = [];
        for (let i = 1; i <= data.totalGames; i++) {
          gameList.push({
            gameNumber: i,
            gameId: `seq-game-${String(i).padStart(3, '0')}`,
            status: 'pending'
          });
        }
        setGames(gameList);
      } else {
        alert(data.error || 'Failed to start batch');
      }
    } catch (error: any) {
      alert('Error starting batch: ' + error.message);
    }
  };

  const stopBatch = async () => {
    try {
      const response = await fetch('/api/batch/stop', {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        setBatchStatus('idle');
      }
    } catch (error: any) {
      alert('Error stopping batch: ' + error.message);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const progress = totalGames > 0 ? (completedCount / totalGames) * 100 : 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        🧪 Research Batch Runner
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Run 50+ games sequentially for research paper data collection
      </p>

      {/* Control Panel */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <label>Total Games:</label>
          <input 
            type="number" 
            value={totalGames}
            onChange={(e) => setTotalGames(parseInt(e.target.value) || 50)}
            disabled={batchStatus === 'running'}
            min="1"
            max="500"
            style={{ padding: '0.5rem', width: '100px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {batchStatus === 'idle' && (
            <button 
              onClick={startBatch}
              style={{ 
                padding: '0.75rem 1.5rem', 
                background: '#10b981', 
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              <Play size={20} />
              Start Research Batch
            </button>
          )}

          {batchStatus === 'running' && (
            <button 
              onClick={stopBatch}
              style={{ 
                padding: '0.75rem 1.5rem', 
                background: '#ef4444', 
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Square size={20} />
              Stop Batch
            </button>
          )}

          {batchStatus === 'completed' && (
            <div style={{ color: '#10b981', fontWeight: '600' }}>
              ✅ Batch Complete!
            </div>
          )}

          {batchStatus === 'failed' && (
            <div style={{ color: '#ef4444', fontWeight: '600' }}>
              ❌ Batch Failed
            </div>
          )}
        </div>
      </div>

      {/* Progress Stats */}
      {batchStatus !== 'idle' && (
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Progress: {completedCount}/{totalGames}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div style={{ 
              height: '24px', 
              background: '#e5e7eb', 
              borderRadius: '12px', 
              overflow: 'hidden' 
            }}>
              <div style={{ 
                height: '100%', 
                background: '#10b981', 
                width: `${progress}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div>
              <div style={{ color: '#666', fontSize: '0.875rem' }}>Completed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#10b981' }}>
                {completedCount}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.875rem' }}>Failed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ef4444' }}>
                {failedCount}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.875rem' }}>Remaining</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                {totalGames - completedCount - failedCount}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.875rem' }}>Elapsed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                {formatTime(elapsedTime)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games List */}
      {games.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Games</h2>
          <div style={{ 
            display: 'grid', 
            gap: '0.5rem',
            maxHeight: '600px',
            overflowY: 'auto',
            padding: '0.5rem'
          }}>
            {games.map(game => (
              <div 
                key={game.gameId}
                style={{ 
                  background: game.status === 'running' ? '#dbeafe' :
                           game.status === 'completed' ? '#d1fae5' :
                           game.status === 'failed' ? '#fee2e2' : 'white',
                  border: `2px solid ${
                    game.status === 'running' ? '#3b82f6' :
                    game.status === 'completed' ? '#10b981' :
                    game.status === 'failed' ? '#ef4444' : '#e5e7eb'
                  }`,
                  borderRadius: '6px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    fontWeight: '600',
                    minWidth: '80px'
                  }}>
                    Game {game.gameNumber}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    {game.gameId}
                  </div>
                  {game.whiteModel && game.blackModel && (
                    <div style={{ fontSize: '0.875rem' }}>
                      {game.whiteModel.split('/').pop()} vs {game.blackModel.split('/').pop()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {game.status === 'completed' && (
                    <>
                      <span style={{ fontSize: '0.875rem', color: '#666' }}>
                        {game.moves} moves
                      </span>
                      <button
                        onClick={() => navigate(`/batch-game/${game.gameId}`)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <Eye size={16} />
                        View Game
                      </button>
                    </>
                  )}
                  {game.status === 'running' && (
                    <span style={{ color: '#3b82f6' }}>⚡ Playing...</span>
                  )}
                  {game.status === 'failed' && (
                    <span style={{ color: '#ef4444' }}>❌ Failed</span>
                  )}
                  {game.status === 'pending' && (
                    <span style={{ color: '#9ca3af' }}>⏳ Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchResearch;
