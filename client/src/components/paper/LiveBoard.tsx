import { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';

type Props = {
  currentFen: string;
  gameInfo: {
    white: string;
    black: string;
    moveNumber: number;
    gameNum: number;
    totalGames: number;
  };
  quality: {
    illegalSuggestions: number;
    correctionsApplied: number;
    repeatStateMoves: number;
    oscillationRejected: number;
    oscillationOverrides: number;
    lastMove: string;
    lastModel: string;
    lastSide: string;
  };
  eta: {
    completedGames: number;
    totalGames: number;
    gamesPerHour: number;
  };
  etaText: string;
};

export function LiveBoard({ currentFen, gameInfo, quality, eta, etaText }: Props) {
  const [boardWidth, setBoardWidth] = useState(520);

  useEffect(() => {
    function updateBoardWidth() {
      const viewport = window.innerWidth;
      if (viewport < 640) {
        setBoardWidth(Math.max(280, viewport - 56));
        return;
      }
      if (viewport < 900) {
        setBoardWidth(Math.min(520, viewport - 96));
        return;
      }
      setBoardWidth(520);
    }

    updateBoardWidth();
    window.addEventListener('resize', updateBoardWidth);
    return () => window.removeEventListener('resize', updateBoardWidth);
  }, []);

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(16,18,23,0.96) 0%, rgba(12,14,18,0.94) 100%)',
        padding: 24,
        borderRadius: 24,
        border: '1px solid rgba(147, 163, 184, 0.12)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.32)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18
        }}
      >
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8f98a8' }}>
            Live Position
          </div>
          <h3 style={{ margin: '4px 0 0', fontSize: 28, letterSpacing: '-0.05em' }}>Board + Runtime Feed</h3>
        </div>
        <div style={chipStyle}>{gameInfo.white ? 'In Progress' : 'Idle'}</div>
      </div>

      <div style={gridStyle}>
        <MiniCard label="Current Game" value={gameInfo.gameNum ? `${gameInfo.gameNum} / ${gameInfo.totalGames}` : '-'} />
        <MiniCard label="Move Number" value={gameInfo.moveNumber ? String(gameInfo.moveNumber) : '-'} />
        <MiniCard label="Run Progress" value={`${eta.completedGames} / ${eta.totalGames || 0}`} />
        <MiniCard label="Speed" value={eta.gamesPerHour > 0 ? `${eta.gamesPerHour.toFixed(1)}/hr` : 'warming up'} />
        <MiniCard label="ETA" value={etaText} />
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
        <FeedRow label="White" value={gameInfo.white || 'Waiting for run start'} />
        <FeedRow label="Black" value={gameInfo.black || 'Waiting for run start'} />
        <FeedRow
          label="Last Move"
          value={quality.lastSide ? `${quality.lastSide} · ${quality.lastModel} · ${quality.lastMove}` : '-'}
        />
      </div>

      <div style={statGridStyle}>
        <SmallStat label="Illegal" value={quality.illegalSuggestions} />
        <SmallStat label="Corrections" value={quality.correctionsApplied} />
        <SmallStat label="Repeat" value={quality.repeatStateMoves} />
        <SmallStat label="Rejects" value={quality.oscillationRejected} />
        <SmallStat label="Overrides" value={quality.oscillationOverrides} />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 16,
          borderRadius: 24,
          background:
            'radial-gradient(circle at top left, rgba(96,165,250,0.14), transparent 30%), linear-gradient(180deg, #11151b 0%, #171c24 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 20px 50px rgba(0,0,0,0.28)'
        }}
      >
        <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 44px rgba(0, 0, 0, 0.35)' }}>
          <Chessboard position={currentFen} boardWidth={boardWidth} />
        </div>
      </div>
    </section>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, rgba(19,22,29,0.98) 0%, rgba(13,15,20,0.98) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.08)'
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8f98a8' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#f4f7fb' }}>{value}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        background: 'rgba(20, 24, 31, 0.88)',
        border: '1px solid rgba(148, 163, 184, 0.08)'
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8f98a8' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: '#f4f7fb' }}>{value}</div>
    </div>
  );
}

function FeedRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 12,
        padding: '11px 14px',
        borderRadius: 14,
        background: 'rgba(20, 24, 31, 0.88)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
        alignItems: 'start'
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8f98a8' }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: '#d9e0ea', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
  marginBottom: 18
};

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 10,
  marginBottom: 20
};

const chipStyle = {
  padding: '8px 14px',
  borderRadius: 999,
  background: 'rgba(96, 165, 250, 0.12)',
  color: '#9ecaff',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: 1
};
