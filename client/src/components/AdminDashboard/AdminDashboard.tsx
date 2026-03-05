import React, { useState, useEffect } from 'react';
import { GameViewer } from '../GameViewer/GameViewer';
import { LiveGameViewer } from '../LiveGameViewer/LiveGameViewer';
import './AdminDashboard.css';

interface GameSummary {
  matchId: string;
  timestamp: string;
  whiteBotName: string;
  blackBotName: string;
  result: 'white' | 'black' | 'draw';
  totalMoves: number;
}

interface GameStats {
  totalGames: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  averageMoves: string;
  averageDuration_ms: number;
  games: GameSummary[];
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBot, setFilterBot] = useState<string>('');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'viewer' | 'live'>('list');
  const [liveMatchId, setLiveMatchId] = useState<string>('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/games/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data.stats);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="admin-dashboard loading">Loading games...</div>;
  if (error) return <div className="admin-dashboard error">{error}</div>;
  if (!stats) return <div className="admin-dashboard">No data available</div>;

  const filteredGames = stats.games.filter(game => {
    if (filterBot && !game.whiteBotName.toLowerCase().includes(filterBot.toLowerCase()) &&
        !game.blackBotName.toLowerCase().includes(filterBot.toLowerCase())) {
      return false;
    }
    if (filterResult !== 'all') {
      if (filterResult === 'draw' && game.result !== 'draw') return false;
      if (filterResult === 'white' && game.result !== 'white') return false;
      if (filterResult === 'black' && game.result !== 'black') return false;
    }
    return true;
  });

  const getResultText = (result: string) => {
    if (result === 'draw') return '½-½';
    if (result === 'white') return '1-0';
    return '0-1';
  };

  if (viewMode === 'viewer' && selectedGameId) {
    return (
      <div className="admin-dashboard">
        <button className="btn btn-back" onClick={() => { setViewMode('list'); setSelectedGameId(null); }}>
          ← Back to Games
        </button>
        <GameViewer matchId={selectedGameId} autoRefresh={true} refreshInterval={2000} />
      </div>
    );
  }

  if (viewMode === 'live') {
    return (
      <div className="admin-dashboard">
        <button className="btn btn-back" onClick={() => { setViewMode('list'); setLiveMatchId(''); }}>
          ← Back to Dashboard
        </button>
        <LiveGameViewer matchId={liveMatchId} />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>🎮 Game Admin Dashboard</h1>
        <p className="subtitle">Monitor and analyze all games</p>
      </div>

      <div className="live-game-controls">
        <div className="control-section">
          <h3>⏹️ Watch Live Game</h3>
          <div className="control-input-group">
            <input
              type="text"
              placeholder="Enter match ID (e.g., match-123)"
              value={liveMatchId}
              onChange={(e) => setLiveMatchId(e.target.value)}
              className="live-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && liveMatchId.trim()) {
                  setViewMode('live');
                }
              }}
            />
            <button
              className="btn btn-live"
              onClick={() => {
                if (liveMatchId.trim()) {
                  setViewMode('live');
                }
              }}
              disabled={!liveMatchId.trim()}
            >
              Start Watching
            </button>
          </div>
          <p className="hint">Enter the match ID that's currently being played to watch it live</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalGames}</div>
          <div className="stat-label">Total Games</div>
        </div>
        <div className="stat-card white">
          <div className="stat-value">{stats.whiteWins}</div>
          <div className="stat-label">White Wins</div>
        </div>
        <div className="stat-card black">
          <div className="stat-value">{stats.blackWins}</div>
          <div className="stat-label">Black Wins</div>
        </div>
        <div className="stat-card draw">
          <div className="stat-value">{stats.draws}</div>
          <div className="stat-label">Draws</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.averageMoves}</div>
          <div className="stat-label">Avg Moves/Game</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.averageDuration_ms / 1000).toFixed(1)}s</div>
          <div className="stat-label">Avg Duration</div>
        </div>
      </div>

      <div className="filters-section">
        <h2>Games List</h2>
        <div className="filter-controls">
          <input
            type="text"
            placeholder="Filter by bot name..."
            value={filterBot}
            onChange={(e) => setFilterBot(e.target.value)}
            className="filter-input"
          />
          <select 
            value={filterResult} 
            onChange={(e) => setFilterResult(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Results</option>
            <option value="white">White Wins</option>
            <option value="black">Black Wins</option>
            <option value="draw">Draws</option>
          </select>
          <span className="filter-count">{filteredGames.length} games</span>
        </div>
      </div>

      <div className="games-table-container">
        <table className="games-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>White Bot</th>
              <th>Black Bot</th>
              <th>Result</th>
              <th>Moves</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGames.map((game) => (
              <tr key={game.matchId}>
                <td><span className="timestamp">{new Date(game.timestamp).toLocaleString()}</span></td>
                <td><span className="bot-name">{game.whiteBotName}</span></td>
                <td><span className="bot-name">{game.blackBotName}</span></td>
                <td>
                  <span className={`result result-${game.result}`}>
                    {getResultText(game.result)}
                  </span>
                </td>
                <td><span className="moves">{game.totalMoves}</span></td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-small btn-view"
                      onClick={() => {
                        setSelectedGameId(game.matchId);
                        setViewMode('viewer');
                      }}
                    >
                      View
                    </button>
                    <a
                      href={`/api/games/${game.matchId}/pgn`}
                      className="btn btn-small btn-download"
                      title="Download as PGN"
                    >
                      PGN
                    </a>
                    <a
                      href={`/api/games/${game.matchId}/json`}
                      className="btn btn-small btn-download"
                      title="Download as JSON"
                    >
                      JSON
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredGames.length === 0 && (
        <div className="no-games">No games match the current filters</div>
      )}
    </div>
  );
};
