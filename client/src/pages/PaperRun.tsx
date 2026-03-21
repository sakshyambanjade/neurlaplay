import { ArtifactsPanel } from '../components/paper/ArtifactsPanel';
import { LiveBoard } from '../components/paper/LiveBoard';
import { RunConfigForm } from '../components/paper/RunConfigForm';
import { RunProgress } from '../components/paper/RunProgress';
import { usePaperRun } from '../hooks/usePaperRun';

export default function PaperRun() {
  const {
    runId,
    status,
    artifacts,
    artifactZipUrl,
    currentFen,
    gameInfo,
    quality,
    eta,
    etaText,
    incompleteRuns,
    health,
    launchMainExperiment,
    launchPilotExperiment,
    resumeLatestRun,
    artifactUrl
  } = usePaperRun();

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(92, 122, 255, 0.16), transparent 24%), radial-gradient(circle at top right, rgba(244, 188, 92, 0.10), transparent 20%), linear-gradient(180deg, #050608 0%, #0b0d11 48%, #0f1319 100%)',
        color: '#f3f6fb'
      }}
    >
      <div
        style={{
          padding: '32px 24px 48px',
          maxWidth: 1500,
          margin: '0 auto',
          fontFamily: '"Azeret Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace'
        }}
      >
        <section
          style={{
            marginBottom: 28,
            padding: '28px 30px',
            borderRadius: 24,
            background: 'linear-gradient(180deg, rgba(16,18,23,0.96) 0%, rgba(12,14,18,0.94) 100%)',
            border: '1px solid rgba(147, 163, 184, 0.12)',
            boxShadow: '0 28px 80px rgba(0, 0, 0, 0.34)'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 12px',
              borderRadius: 999,
              background: 'rgba(96, 165, 250, 0.12)',
              color: '#9ecaff',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 16
            }}
          >
            Research Console
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(260px, 0.9fr)',
              gap: 22,
              alignItems: 'start'
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(2.25rem, 4vw, 4.5rem)',
                  lineHeight: 0.92,
                  letterSpacing: '-0.06em',
                  textTransform: 'uppercase'
                }}
              >
                Deterministic
                <br />
                Chess Decision
                <br />
                Benchmark
              </h1>
              <p
                style={{
                  margin: '18px 0 0',
                  maxWidth: 760,
                  color: '#9ea7b6',
                  fontSize: 14,
                  lineHeight: 1.75
                }}
              >
                Constrained-index chess evaluation for language models with resumable execution,
                append-only logs, and paper-grade artifacts. The page is intentionally reduced to
                launch, monitor, resume, and archive.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 12
              }}
            >
              <HeroCard label="Models" value="4" detail="Locked Groq lineup" />
              <HeroCard label="Main Run" value="1200" detail="Color-balanced games" />
              <HeroCard label="Artifacts" value="JSONL" detail="Moves, games, stats, figures" />
            </div>
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 560px) minmax(320px, 1fr)',
            gap: 24,
            alignItems: 'start',
            marginBottom: 28
          }}
        >
          <LiveBoard
            currentFen={currentFen}
            gameInfo={gameInfo}
            quality={quality}
            eta={eta}
            etaText={etaText}
          />

          <RunConfigForm
            incompleteRuns={incompleteRuns}
            onLaunchMainExperiment={launchMainExperiment}
            onLaunchPilotExperiment={launchPilotExperiment}
            onResumeLatestRun={resumeLatestRun}
          />
        </div>

        <RunProgress
          status={status}
          health={health}
          artifactReady={artifacts.length > 0 || Boolean(artifactZipUrl)}
        />

        <ArtifactsPanel
          runId={runId}
          artifacts={artifacts}
          artifactUrl={artifactUrl}
          artifactZipUrl={artifactZipUrl}
        />
      </div>
    </div>
  );
}

function HeroCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 18,
        background: 'linear-gradient(180deg, rgba(20,22,29,0.96) 0%, rgba(13,15,20,0.98) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.12)'
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8b95a5' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#f4f7fb' }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#9aa3b2' }}>{detail}</div>
    </div>
  );
}
