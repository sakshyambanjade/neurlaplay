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
        padding: 32,
        maxWidth: 1600,
        margin: '0 auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        background: '#0a0a0a',
        minHeight: '100vh',
        color: '#fff'
      }}
    >
      <h1 style={{ fontSize: 34, marginBottom: 24, textAlign: 'center' }}>
        Deterministic Chess Decision Benchmark
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '600px 1fr', gap: 32, marginBottom: 32 }}>
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
  );
}
