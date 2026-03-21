import type { CSSProperties } from 'react';

type IncompleteRun = {
  runId: string;
  startedAt: string;
  step: string;
  progress: number;
  total: number;
};

type Props = {
  incompleteRuns: IncompleteRun[];
  hasActiveRun: boolean;
  canStartFresh: boolean;
  canResumeLatest: boolean;
  activeRunId: string | null;
  activeRunStep?: string;
  onLaunchMainExperiment: () => Promise<void>;
  onLaunchPilotExperiment: () => Promise<void>;
  onResumeLatestRun: () => Promise<void>;
};

export function RunConfigForm({
  incompleteRuns,
  hasActiveRun,
  canStartFresh,
  canResumeLatest,
  activeRunId,
  activeRunStep,
  onLaunchMainExperiment,
  onLaunchPilotExperiment,
  onResumeLatestRun
}: Props) {
  const latestInterruptedRun = incompleteRuns[0] ?? null;
  const lockMessage = hasActiveRun
    ? 'A run is already active. Fresh launch controls are locked until it finishes.'
    : latestInterruptedRun
      ? 'An unfinished run already exists. Fresh launch controls are locked until you resume it.'
      : null;

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
        Main and pilot runs use fixed paper presets. Once a run starts, the panel becomes
        monitor-only until that run finishes or needs resume.
      </p>

      <div style={summaryGridStyle}>
        <SummaryItem label="Models" value="4" detail="Groq-backed" />
        <SummaryItem label="Matchups" value="12" detail="Color-balanced" />
        <SummaryItem label="Games" value="1200" detail="Main preset" />
        <SummaryItem label="Mode" value="Index" detail="Legal selection only" />
      </div>

      {lockMessage ? (
        <div style={lockCardStyle}>
          <div
            style={{
              fontSize: 11,
              color: '#d8b57a',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1
            }}
          >
            Control locked
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f7fb' }}>
            {activeRunId ?? latestInterruptedRun?.runId ?? 'Run in progress'}
          </div>
          <div style={{ fontSize: 13, color: '#b8c1cf', marginTop: 6 }}>
            {activeRunStep ?? latestInterruptedRun?.step ?? 'running'}
          </div>
          <div style={{ fontSize: 13, color: '#98a2b3', marginTop: 8 }}>{lockMessage}</div>
        </div>
      ) : null}

      {latestInterruptedRun ? (
        <div style={resumeCardStyle}>
          <div
            style={{
              fontSize: 11,
              color: '#f5c469',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1
            }}
          >
            Latest resumable run
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f7fb' }}>{latestInterruptedRun.runId}</div>
          <div style={{ fontSize: 13, color: '#b8c1cf', marginTop: 6 }}>
            {latestInterruptedRun.step} | {latestInterruptedRun.progress} / {latestInterruptedRun.total}
          </div>
        </div>
      ) : null}

      <div style={buttonGroupStyle}>
        <button
          onClick={() => void onLaunchMainExperiment()}
          disabled={!canStartFresh}
          style={{
            ...primaryButtonStyle,
            background: canStartFresh
              ? 'linear-gradient(135deg, #f3b64d 0%, #d38b2f 100%)'
              : 'linear-gradient(135deg, rgba(83,87,94,0.9) 0%, rgba(48,51,56,0.96) 100%)',
            cursor: canStartFresh ? 'pointer' : 'not-allowed',
            opacity: canStartFresh ? 1 : 0.72
          }}
        >
          Run Main Experiment
        </button>

        <button
          onClick={() => void onLaunchPilotExperiment()}
          disabled={!canStartFresh}
          style={{
            ...secondaryButtonStyle,
            cursor: canStartFresh ? 'pointer' : 'not-allowed',
            opacity: canStartFresh ? 1 : 0.6
          }}
        >
          Run Validation Batch
        </button>

        <button
          onClick={() => void onResumeLatestRun()}
          disabled={!canResumeLatest}
          style={{
            ...secondaryButtonStyle,
            cursor: !canResumeLatest ? 'not-allowed' : 'pointer',
            opacity: !canResumeLatest ? 0.65 : 1
          }}
        >
          Resume Last Run
        </button>
      </div>

      <div style={footnoteStyle}>
        Once a run starts, fresh launches stay locked. Resume is only available after an interruption.
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

const lockCardStyle: CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  background: 'linear-gradient(180deg, rgba(45,19,15,0.94) 0%, rgba(23,12,11,0.98) 100%)',
  border: '1px solid rgba(176, 75, 54, 0.28)'
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
