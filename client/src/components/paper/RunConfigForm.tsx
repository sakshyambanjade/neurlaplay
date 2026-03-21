import type { CSSProperties } from 'react';

type Props = {
  incompleteRuns: Array<{
    runId: string;
    startedAt: string;
    step: string;
    progress: number;
    total: number;
  }>;
  onLaunchMainExperiment: () => Promise<void>;
  onLaunchPilotExperiment: () => Promise<void>;
  onResumeLatestRun: () => Promise<void>;
};

export function RunConfigForm({
  incompleteRuns,
  onLaunchMainExperiment,
  onLaunchPilotExperiment,
  onResumeLatestRun
}: Props) {
  const latestInterruptedRun = incompleteRuns[0] ?? null;

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 28 }}>Main Paper Run</h2>
      <p style={leadStyle}>
        One click starts the full canonical study: 4 Groq models, 12 color-balanced matchups,
        1200 total games, per-move logging, per-game checkpoints, and automatic resume support.
      </p>

      <div style={summaryGridStyle}>
        <SummaryItem label="Models" value="4" />
        <SummaryItem label="Matchups" value="12" />
        <SummaryItem label="Games" value="1200" />
        <SummaryItem label="Mode" value="Constrained index" />
      </div>

      {latestInterruptedRun ? (
        <div style={resumeCardStyle}>
          <div style={{ fontSize: 12, color: '#9bb0d1', marginBottom: 6 }}>Interrupted run found</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{latestInterruptedRun.runId}</div>
          <div style={{ fontSize: 13, color: '#d2def7', marginTop: 6 }}>
            {latestInterruptedRun.step} | {latestInterruptedRun.progress} / {latestInterruptedRun.total}
          </div>
        </div>
      ) : null}

      <div style={buttonGroupStyle}>
        <button
          onClick={() => void onLaunchMainExperiment()}
          style={{
            ...primaryButtonStyle,
            background: 'linear-gradient(135deg, #1f8f55 0%, #0f6d8d 100%)',
            cursor: 'pointer'
          }}
        >
          Run Main Experiment
        </button>

        <button
          onClick={() => void onLaunchPilotExperiment()}
          style={{
            ...secondaryButtonStyle,
            cursor: 'pointer',
            opacity: 1
          }}
        >
          Run Validation Batch
        </button>

        <button
          onClick={() => void onResumeLatestRun()}
          disabled={!latestInterruptedRun}
          style={{
            ...secondaryButtonStyle,
            cursor: !latestInterruptedRun ? 'not-allowed' : 'pointer',
            opacity: !latestInterruptedRun ? 0.65 : 1
          }}
        >
          Resume Last Run
        </button>
      </div>

      <div style={footnoteStyle}>
        Main and pilot start fresh locked presets. Resume only continues the latest interrupted run.
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryItemStyle}>
      <div style={{ fontSize: 12, color: '#95a7c9', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: '#1a1a2e',
  padding: 24,
  borderRadius: 16,
  boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
};

const leadStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: '#d7e1f5',
  marginBottom: 20
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12
};

const summaryItemStyle: CSSProperties = {
  background: '#111827',
  borderRadius: 12,
  padding: 14
};

const resumeCardStyle: CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 12,
  background: '#132238',
  border: '1px solid rgba(120, 180, 255, 0.25)'
};

const primaryButtonStyle: CSSProperties = {
  padding: '16px 24px',
  fontSize: 18,
  fontWeight: 800,
  color: 'white',
  border: 'none',
  borderRadius: 14,
  boxShadow: '0 10px 30px rgba(15, 109, 141, 0.35)',
  width: '100%'
};

const secondaryButtonStyle: CSSProperties = {
  padding: '14px 20px',
  fontSize: 15,
  fontWeight: 700,
  color: 'white',
  border: '1px solid rgba(145, 180, 255, 0.3)',
  borderRadius: 12,
  background: '#182338',
  width: '100%'
};

const buttonGroupStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 12,
  marginTop: 24
};

const footnoteStyle: CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: '#98aacb',
  lineHeight: 1.5
};
