import type { CSSProperties } from 'react';
import type { MatchupConfig } from '../../hooks/usePaperRun';
import { matchupKey } from '../../hooks/usePaperRun';

type Props = {
  matchups: MatchupConfig[];
  completedByMatchup: Record<string, number>;
  onChange: (index: number, patch: Partial<MatchupConfig>) => void;
  onRefresh: () => Promise<unknown>;
};

export function MatchupEditor({ matchups, completedByMatchup, onChange, onRefresh }: Props) {
  const totalGames = matchups.reduce((sum, matchup) => sum + matchup.games, 0);

  return (
    <section style={{ background: '#1a1a2e', padding: 20, borderRadius: 12, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>Matchups ({totalGames} total games)</h2>
      {matchups.map((matchup, index) => {
        const completed = completedByMatchup[matchupKey(matchup.white, matchup.black)] ?? 0;
        const remaining = Math.max(0, matchup.games - completed);
        return (
          <div
            key={`${matchup.label}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.7fr 1fr 1fr 90px',
              gap: 8,
              alignItems: 'center',
              marginBottom: 10
            }}
          >
            <input
              value={matchup.label}
              onChange={(event) => onChange(index, { label: event.target.value })}
              style={inputStyle}
            />
            <input
              value={matchup.white}
              onChange={(event) => onChange(index, { white: event.target.value })}
              style={inputStyle}
            />
            <input
              value={matchup.black}
              onChange={(event) => onChange(index, { black: event.target.value })}
              style={inputStyle}
            />
            <input
              type="number"
              value={matchup.games}
              onChange={(event) => onChange(index, { games: Number(event.target.value) })}
              style={inputStyle}
            />
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9bb0d1' }}>
              done: {completed} | remaining: {remaining}
            </div>
          </div>
        );
      })}

      <button onClick={() => void onRefresh()} style={secondaryButtonStyle}>
        Refresh Completed Counts
      </button>
    </section>
  );
}

const inputStyle: CSSProperties = {
  padding: 8,
  background: '#0a0a0a',
  color: '#fff',
  border: '1px solid #4C72B0',
  borderRadius: 6
};

const secondaryButtonStyle: CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  background: '#2f4a7a',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer'
};
