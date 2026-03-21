import type { RunStatus } from '../../hooks/usePaperRun';

type Props = {
  status: RunStatus | null;
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

export function RunProgress({ status, health, artifactReady }: Props) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {status ? (
        <section
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            padding: 20,
            borderRadius: 12,
            border: '2px solid #4C72B0'
          }}
        >
          <div style={{ fontSize: 16, marginBottom: 8 }}>
            <strong>Stage:</strong> {status.step || 'Initializing...'}
          </div>
          <div style={{ fontSize: 14, color: '#aaa' }}>
            <strong>Progress:</strong> {status.progress || 0} / {status.total || 0}
          </div>
          <div style={{ background: '#0a0a0a', borderRadius: 8, height: 24, marginTop: 12, overflow: 'hidden' }}>
            <div
              style={{
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                width: `${((status.progress || 0) / (status.total || 1)) * 100}%`,
                height: '100%',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
          {status.done ? <div style={{ color: '#55A868', marginTop: 12 }}>Run complete</div> : null}
          {status.error ? <div style={{ color: '#ff6b6b', marginTop: 12 }}>{status.error}</div> : null}
        </section>
      ) : null}

      <section style={{ background: '#1a1a2e', padding: 20, borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Run Health</h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 12 }}>
          <div>Status: {health.ok ? 'healthy' : 'warning'}</div>
          <div>Matchup: {health.matchupLabel || '-'}</div>
          <div>Completed games observed: {health.completedGames}</div>
          <div>Total moves observed: {health.totalMoves}</div>
          <div>Fallback moves: {health.fallbackMoves}</div>
          <div>Repeat-state moves: {health.repeatStateMoves}</div>
          <div>Oscillation rejected: {health.oscillationRejectedCount}</div>
          <div>No-progress streak max: {health.noProgressMaxStreak}</div>
          <div>Collapse-detected games: {health.collapseDetectedGames}</div>
          <div>Artifacts ready: {artifactReady ? 'yes' : 'no'}</div>
        </div>
        {health.warnings.length > 0 ? (
          <ul style={{ marginTop: 0, color: '#ffb86c' }}>
            {health.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <div style={{ color: '#8fd19e' }}>No health warnings reported yet.</div>
        )}
      </section>
    </div>
  );
}
