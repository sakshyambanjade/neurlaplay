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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap'
        }}
      >
        <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
          Fight Card
        </h2>
        <div style={tagStyle}>Locked Protocol</div>
      </div>
      <p style={leadStyle}>
        Main and pilot runs use fixed paper presets. Resume continues the latest interrupted run
        from disk without changing the protocol. Matchups stay locked so the data remains clean.
      </p>

      <div style={summaryGridStyle}>
        <SummaryItem label="Models" value="4" detail="Groq-backed" />
        <SummaryItem label="Matchups" value="12" detail="Color-balanced" />
        <SummaryItem label="Games" value="1200" detail="Main preset" />
        <SummaryItem label="Mode" value="Index" detail="Legal selection only" />
      </div>

      {latestInterruptedRun ? (
        <div style={resumeCardStyle}>
          <div style={{ fontSize: 11, color: '#f5c469', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Interrupted bout found
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f7fb' }}>{latestInterruptedRun.runId}</div>
          <div style={{ fontSize: 13, color: '#b8c1cf', marginTop: 6 }}>
            {latestInterruptedRun.step} · {latestInterruptedRun.progress} / {latestInterruptedRun.total}
          </div>
        </div>
      ) : null}

      <div style={buttonGroupStyle}>
        <button
          onClick={() => void onLaunchMainExperiment()}
          style={{
            ...primaryButtonStyle,
            background: 'linear-gradient(135deg, #f3b64d 0%, #d38b2f 100%)',
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

function SummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={summaryItemStyle}>
      <div style={{ fontSize: 11, color: '#8f98a8', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, marginTop: 6, color: '#f4f7fb' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#a2acbb', marginTop: 4 }}>{detail}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(16,18,23,0.96) 0%, rgba(12,14,18,0.94) 100%)',
  padding: 28,
  borderRadius: 24,
  border: '1px solid rgba(243, 182, 77, 0.14)',
  boxShadow: '0 28px 80px rgba(0,0,0,0.32)'
};

const leadStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: '#a4adbb',
  marginBottom: 20
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12
};

const summaryItemStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(19,22,29,0.96) 0%, rgba(13,15,20,0.98) 100%)',
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(243, 182, 77, 0.08)'
};

const resumeCardStyle: CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  background: 'linear-gradient(180deg, rgba(36,24,7,0.92) 0%, rgba(22,18,14,0.96) 100%)',
  border: '1px solid rgba(243, 182, 77, 0.18)'
};

const primaryButtonStyle: CSSProperties = {
  padding: '16px 24px',
  fontSize: 17,
  fontWeight: 800,
  color: '#0f1115',
  border: 'none',
  borderRadius: 16,
  boxShadow: '0 18px 36px rgba(0, 0, 0, 0.28)',
  width: '100%'
};

const secondaryButtonStyle: CSSProperties = {
  padding: '14px 20px',
  fontSize: 15,
  fontWeight: 700,
  color: '#edf2fa',
  border: '1px solid rgba(243, 182, 77, 0.12)',
  borderRadius: 14,
  background: 'rgba(20, 24, 31, 0.88)',
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
  color: '#8390a3',
  lineHeight: 1.5
};

const tagStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(243, 182, 77, 0.12)',
  color: '#f3c575',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1
};
