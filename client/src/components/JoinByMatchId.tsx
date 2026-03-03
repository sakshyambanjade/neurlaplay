import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks';
import { useGameStore } from '../store/gameStore';

interface JoinByMatchIdProps {
  onClose: () => void;
}

export function JoinByMatchId({ onClose }: JoinByMatchIdProps) {
  const [matchId, setMatchId] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const socket = useSocket();
  const setStoreMatchId = useGameStore((s) => s.setMatchId);
  const setUserColor = useGameStore((s) => s.setUserColor);

  const handleJoinAsPlayer = () => {
    const normalizedMatchId = matchId.trim().toUpperCase();
    if (!normalizedMatchId || !socket) {
      console.error('[Client] Missing matchId or socket');
      return;
    }

    console.log('[Client] === STARTING JOIN FLOW ===');
    console.log('[Client] Socket connected:', socket.connected);
    console.log('[Client] Socket ID:', socket.id);
    console.log('[Client] Attempting to join match:', normalizedMatchId);
    
    setJoining(true);
    setError(null);

    let eventHandled = false; // Prevent double handling

    const onJoined = (data: { matchId: string; color: 'white' | 'black'; playerSessionId?: string }) => {
      if (eventHandled) return;
      eventHandled = true;

      console.log('[Client] RECEIVED matchCreated event:', data);
      console.log('[Client] Cleaning up socket listeners...');
      
      socket.off('error', onError);
      socket.off('matchCreated', onJoined);
      socket.off('matchJoined', onMatchJoined);
      
      setJoining(false);
      setStoreMatchId(data.matchId);
      setUserColor(data.color);
      if (data.playerSessionId) {
        useGameStore.setState({ playerSessionId: data.playerSessionId });
        console.log('[Client] Stored playerSessionId:', data.playerSessionId);
      }
      
      console.log('[Client] Event handled, navigating to /lobby as', data.color);
      onClose(); // Close modal first
      
      // Use setTimeout to ensure modal closes before navigation
      setTimeout(() => {
        console.log('[Client] Navigating to /lobby...');
        navigate('/lobby');
      }, 100);
    };

    const onMatchJoined = (data: { matchId: string; color: 'white' | 'black'; playerSessionId?: string }) => {
      if (eventHandled) return;
      eventHandled = true;

      console.log('[Client] RECEIVED matchJoined event:', data);
      socket.off('error', onError);
      socket.off('matchCreated', onJoined);
      socket.off('matchJoined', onMatchJoined);
      
      setJoining(false);
      setStoreMatchId(data.matchId);
      setUserColor(data.color);
      if (data.playerSessionId) {
        useGameStore.setState({ playerSessionId: data.playerSessionId });
        console.log('[Client] Stored playerSessionId:', data.playerSessionId);
      }
      console.log('[Client] Event handled, navigating to /lobby as', data.color);
      onClose();
      
      setTimeout(() => {
        navigate('/lobby');
      }, 100);
    };

    const onError = (payload: { code?: string; message?: string }) => {
      if (eventHandled) return;
      eventHandled = true;

      console.log('[Client] RECEIVED error event:', payload);
      setJoining(false);
      setError(payload?.message || 'Unable to join match.');
      socket.off('matchCreated', onJoined);
      socket.off('matchJoined', onMatchJoined);
    };

    console.log('[Client] Registering event listeners...');
    socket.once('matchCreated', onJoined);
    socket.once('matchJoined', onMatchJoined);
    socket.once('error', onError);
    
    console.log('[Client] Listeners registered, emitting joinMatch event...');
    socket.emit('joinMatch', { matchId: normalizedMatchId });
    console.log('[Client] joinMatch event emitted to server');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: '#fff',
            textAlign: 'center'
          }}
        >
          🎮 Join a Match
        </h2>

        <p
          style={{
            margin: '0 0 1.5rem 0',
            color: '#d1d5db',
            textAlign: 'center',
            fontSize: '0.95rem'
          }}
        >
          Enter the match ID to join your opponent. You'll both configure your bots and click Ready to start.
        </p>

        <input
          type="text"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleJoinAsPlayer()}
          placeholder="e.g., A4B2C1D8"
          autoFocus
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            fontFamily: 'monospace',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '0.5rem',
            color: '#fff',
            marginBottom: '1.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        />

        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fecaca',
              fontSize: '0.9rem'
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleJoinAsPlayer}
            disabled={!matchId.trim() || joining || !socket}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              background: matchId.trim() && !joining && socket
                ? 'linear-gradient(to right, #9333ea, #a855f7)'
                : 'rgba(75, 85, 99, 0.5)',
              color: matchId.trim() && !joining && socket ? '#fff' : '#9ca3af',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: matchId.trim() && !joining && socket ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (matchId.trim() && !joining && socket) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(168, 85, 247, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {joining ? 'Joining...' : '🎮 Join Match'}
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              background: 'rgba(75, 85, 99, 0.3)',
              color: '#d1d5db',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(75, 85, 99, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
