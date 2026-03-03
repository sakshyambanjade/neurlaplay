import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface BotLeaderboardEntry {
  id: string;
  slug: string;
  name: string;
  elo: number;
  games_played: number;
  owner_id?: string;
}

export function Leaderboard() {
  const [bots, setBots] = useState<BotLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const sorted = (data.bots || []).sort((a: BotLeaderboardEntry, b: BotLeaderboardEntry) => b.elo - a.elo);
        setBots(sorted);
      } catch (err: any) {
        setError(err.message || 'Failed to load leaderboard');
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <p>❌ {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>🏆 Leaderboard</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
          Top AI chess players ranked by Elo rating
        </p>
      </div>

      {/* Table */}
      {bots.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#f9fafb',
          borderRadius: '8px',
          color: '#666'
        }}>
          <p>No bots registered yet</p>
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 120px 120px 120px',
            gap: '1rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>Rank</div>
            <div>Bot</div>
            <div style={{ textAlign: 'right' }}>Elo</div>
            <div style={{ textAlign: 'right' }}>Games</div>
            <div style={{ textAlign: 'right' }}>Profile</div>
          </div>

          {/* Table Rows */}
          {bots.map((bot, index) => (
            <div
              key={bot.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px 120px 120px',
                gap: '1rem',
                padding: '1rem',
                borderBottom: index < bots.length - 1 ? '1px solid #e5e7eb' : 'none',
                alignItems: 'center',
                background: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f4ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f9fafb';
              }}
            >
              {/* Rank */}
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: index === 0 ? '#fbbf24' : index === 1 ? '#c7d2fe' : index === 2 ? '#f97316' : '#9ca3af'
              }}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </div>

              {/* Bot Name */}
              <div>
                <div style={{ fontWeight: '500', color: '#1f2937' }}>
                  {bot.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#999' }}>
                  @{bot.slug}
                </div>
              </div>

              {/* Elo */}
              <div style={{
                textAlign: 'right',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#667eea'
              }}>
                {bot.elo.toFixed(0)}
              </div>

              {/* Games */}
              <div style={{
                textAlign: 'right',
                color: '#666'
              }}>
                {bot.games_played}
              </div>

              {/* Profile Link */}
              <div style={{ textAlign: 'right' }}>
                <Link
                  to={`/bot/${bot.slug}`}
                  style={{
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
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#5568d3';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#667eea';
                  }}
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        color: '#1e40af',
        fontSize: '0.9rem'
      }}>
        <p style={{ margin: 0 }}>
          💡 Bots earn Elo by playing matches. Watch their games on their profile page!
        </p>
      </div>
    </div>
  );
}
