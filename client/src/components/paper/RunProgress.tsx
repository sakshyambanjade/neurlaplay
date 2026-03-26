import { useEffect, useState } from 'react';
import type { RunStatus } from '../../hooks/usePaperRun';

type Props = {
  status: RunStatus | null;
  liveUpdatedAt: string | null;
  gameInfo: {
    white: string;
    black: string;
    moveNumber: number;
    gameNum: number;
    totalGames: number;
  };
  health: {
    ok: boolean;
    warnings: string[];
    completedGames: number;
    totalMoves: number;
    matchupLabel: string;
    fallbackMoves: number;
    repeatStateMoves: number;
    oscillationRejectedCount: number;
    collapseDetectedGames: number;
    noProgressMaxStreak: number;
  };
  artifactReady: boolean;
};

export function RunProgress({ status, liveUpdatedAt, gameInfo, health, artifactReady }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const liveAgeSec =
    liveUpdatedAt && !Number.isNaN(Date.parse(liveUpdatedAt))
      ? Math.max(0, Math.floor((nowMs - Date.parse(liveUpdatedAt)) / 1000))
      : null;
  const isActivelyUpdating = liveAgeSec !== null && liveAgeSec <= 45;
  const currentGameOrdinal =
    status && !status.done && status.total > 0 ? Math.min(status.progress + 1, status.total) : status?.progress ?? 0;
  const liveStateLabel =
    status?.done
      ? 'Complete'
      : liveAgeSec === null
        ? 'Waiting'
        : isActivelyUpdating
          ? `Live • ${formatAge(liveAgeSec)}`
          : `Quiet • ${formatAge(liveAgeSec)}`;

  return (
    <div style={{ display: 'grid', gap: 22, marginBottom: 28 }}>
      {status ? (
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
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#b39a70' }}>
                Bout Status
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f4f7fb', marginTop: 4 }}>
                {status.step || 'Initializing'}
              </div>
            </div>
            <div style={status.done ? completeBadgeStyle : isActivelyUpdating ? activeBadgeStyle : warningBadgeStyle}>
              {status.done ? 'Completed' : liveStateLabel}
            </div>
          </div>

          <div style={metricGridStyle}>
            <MetricCard label="Progress" value={`${status.progress || 0} / ${status.total || 0}`} />
            <MetricCard label="Current Game" value={String(currentGameOrdinal || 0)} />
            <MetricCard label="Current Move" value={String(gameInfo.moveNumber || 0)} />
            <MetricCard
              label="Completion"
              value={`${((((status.progress || 0) / (status.total || 1)) * 100) || 0).toFixed(1)}%`}
            />
            <MetricCard label="Last Activity" value={liveAgeSec === null ? '-' : formatAge(liveAgeSec)} />
            <MetricCard label="Artifacts" value={artifactReady ? 'Ready' : 'Pending'} />
          </div>

          <div
            style={{
                background: '#151922',
              borderRadius: 999,
              height: 14,
              marginTop: 18,
              overflow: 'hidden',
              border: '1px solid rgba(148, 163, 184, 0.08)'
            }}
          >
            <div
              style={{
                background: 'linear-gradient(90deg, #b24734 0%, #f3b64d 100%)',
                width: `${((status.progress || 0) / (status.total || 1)) * 100}%`,
                height: '100%',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
          {status.done ? <div style={{ color: '#7ed39a', marginTop: 14, fontWeight: 700 }}>Run complete</div> : null}
          {status.error ? <div style={{ color: '#ff8383', marginTop: 14, fontWeight: 700 }}>{status.error}</div> : null}
        </section>
      ) : null}

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
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 18
          }}
        >
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#b39a70' }}>
              Judge Table
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 28, letterSpacing: '-0.05em' }}>Operational Signals</h2>
          </div>
          <div style={health.ok ? completeBadgeStyle : warningBadgeStyle}>{health.ok ? 'Healthy' : 'Warning'}</div>
        </div>

        <div style={metricGridStyle}>
          <MetricCard label="Matchup" value={health.matchupLabel || '-'} compact />
          <MetricCard label="Observed Games" value={String(health.completedGames)} />
          <MetricCard label="Observed Moves" value={String(health.totalMoves)} />
          <MetricCard label="Fallback Moves" value={String(health.fallbackMoves)} />
          <MetricCard label="Repeat-State Moves" value={String(health.repeatStateMoves)} />
          <MetricCard label="Oscillation Rejects" value={String(health.oscillationRejectedCount)} />
          <MetricCard label="Max No-Progress" value={String(health.noProgressMaxStreak)} />
          <MetricCard label="Collapse Games" value={String(health.collapseDetectedGames)} />
        </div>

        {health.warnings.length > 0 ? (
          <ul
            style={{
              marginTop: 16,
              marginBottom: 0,
              color: '#ffcb86',
              background: 'rgba(91, 52, 14, 0.34)',
              borderRadius: 16,
              padding: '14px 18px 14px 34px',
              border: '1px solid rgba(243, 182, 77, 0.18)'
            }}
          >
            {health.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <div
            style={{
              color: '#8edaa9',
              marginTop: 16,
              padding: '14px 16px',
              borderRadius: 16,
              background: 'rgba(24, 64, 39, 0.34)',
              border: '1px solid rgba(70, 183, 116, 0.15)'
            }}
          >
            No health warnings reported yet.
          </div>
        )}
      </section>
    </div>
  );
}

function formatAge(ageSec: number): string {
  if (ageSec < 60) {
    return `${ageSec}s ago`;
  }
  const minutes = Math.floor(ageSec / 60);
  const seconds = ageSec % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s ago`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m ago`;
}

function MetricCard({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, rgba(18,21,27,0.98) 0%, rgba(13,15,20,0.98) 100%)',
        border: '1px solid rgba(243, 182, 77, 0.08)'
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#b39a70' }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: compact ? 14 : 22,
          lineHeight: 1.35,
          fontWeight: 800,
          color: '#f4f7fb',
          wordBreak: 'break-word'
        }}
      >
        {value}
      </div>
    </div>
  );
}

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 14
};

const activeBadgeStyle = {
  padding: '8px 14px',
  borderRadius: 999,
  background: 'rgba(243, 182, 77, 0.12)',
  color: '#f3c575',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: 1
};

const completeBadgeStyle = {
  padding: '8px 14px',
  borderRadius: 999,
  background: 'rgba(70, 183, 116, 0.16)',
  color: '#8edaa9',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: 1
};

const warningBadgeStyle = {
  padding: '8px 14px',
  borderRadius: 999,
  background: 'rgba(243, 182, 77, 0.16)',
  color: '#ffcb86',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: 1
};
