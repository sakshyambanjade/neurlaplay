import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface BotData {
  id: string;
  name: string;
  slug: string;
  model: string;
  elo: number;
  endpoint_type?: string;
  endpoint_url?: string;
}

interface Match {
  id: string;
  result: string;
  white_bot_id: string;
  black_bot_id: string;
  started_at?: string;
  ended_at?: string;
}

interface Stats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
}

export function BotProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [bot, setBot] = useState<BotData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBot = async () => {
      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
        const response = await fetch(`${serverUrl}/api/bots/${slug}`);
        
        if (!response.ok) {
          throw new Error(`Bot not found: ${response.status}`);
        }

        const data = await response.json();
        setBot(data.bot);
        setStats(data.stats);
        setRecentMatches(data.recentMatches || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load bot profile');
        console.error('Error fetching bot:', err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchBot();
    }
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading bot profile...</p>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <p>❌ {error || 'Bot not found'}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Bot Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        borderRadius: '12px',
        color: 'white',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem' }}>{bot.name}</h1>
            <p style={{ margin: '0 0 1rem 0', opacity: 0.9, fontSize: '1.1rem' }}>
              Model: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                {bot.model}
              </code>
            </p>
            <p style={{ margin: 0, opacity: 0.8 }}>@{bot.slug}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {bot.elo}
            </div>
            <div style={{ opacity: 0.9 }}>Elo Rating</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: '#f0fdf4',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #86efac'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Games Played
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#15803d' }}>
              {stats.gamesPlayed}
            </div>
          </div>

          <div style={{
            background: '#fefce8',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #fde047'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Wins
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ca8a04' }}>
              {stats.wins}
            </div>
          </div>

          <div style={{
            background: '#fee2e2',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #fca5a5'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Losses
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
              {stats.losses}
            </div>
          </div>

          <div style={{
            background: '#f0f9ff',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #7dd3fc'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Draws
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0284c7' }}>
              {stats.draws}
            </div>
          </div>

          <div style={{
            background: '#f5f3ff',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #d8b4fe',
            gridColumn: 'span 1'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Win Rate
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed' }}>
              {stats.winRate}%
            </div>
          </div>
        </div>
      )}

      {/* Recent Matches */}
      <div>
        <h2 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#1f2937' }}>
          Recent Matches
        </h2>

        {recentMatches.length === 0 ? (
          <p style={{ color: '#999', fontStyle: 'italic', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
            No matches yet
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gap: '0.75rem'
          }}>
            {recentMatches.map((match, idx) => {
              const isWhiteBot = match.white_bot_id === bot.id;
              const resultEmoji = {
                '1-0': isWhiteBot ? '✅' : '❌',
                '0-1': isWhiteBot ? '❌' : '✅',
                '1/2-1/2': '🤝'
              }[match.result] || '?';

              return (
                <a
                  key={idx}
                  href={`/game/${match.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    background: '#fff',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                      Match {match.id.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      Result: <strong>{match.result}</strong>
                    </div>
                    {match.started_at && (
                      <div style={{ fontSize: '0.875rem', color: '#999' }}>
                        {new Date(match.started_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '1.5rem' }}>{resultEmoji}</div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Back Link */}
      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}>
        <a href="/leaderboard" style={{
          color: '#667eea',
          textDecoration: 'none',
          fontSize: '0.95rem',
          fontWeight: '500'
        }}>
          ← Back to Leaderboard
        </a>
      </div>
    </div>
  );
}
