import { ArtifactsPanel } from '../components/paper/ArtifactsPanel';
import { LiveBoard } from '../components/paper/LiveBoard';
import { RunConfigForm } from '../components/paper/RunConfigForm';
import { RunProgress } from '../components/paper/RunProgress';
import { usePaperRun } from '../hooks/usePaperRun';

export default function PaperRun() {
  const {
    runId,
    status,
    config,
    acceptedConfig,
    logs,
    artifacts,
    artifactZipUrl,
    currentFen,
    gameInfo,
    quality,
    eta,
    etaText,
    completedByMatchup,
    incompleteRuns,
    presets,
    selectedPresetId,
    health,
    updateConfig,
    updateSettings,
    updateMatchup,
    loadProgress,
    loadPreset,
    setSelectedPresetId,
    startRun,
    continueRemaining,
    resetResearch,
    resumeRun,
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
          config={config}
          incompleteRuns={incompleteRuns}
          presets={presets}
          selectedPresetId={selectedPresetId}
          onPresetSelect={setSelectedPresetId}
          onLoadPreset={loadPreset}
          completedByMatchup={completedByMatchup}
          onConfigChange={updateConfig}
          onSettingsChange={updateSettings}
          onMatchupChange={updateMatchup}
          onRefreshProgress={loadProgress}
          onStart={startRun}
          onContinue={continueRemaining}
          onReset={resetResearch}
          onResume={resumeRun}
          runInProgress={Boolean(runId && !status?.done)}
        />
      </div>

      <RunProgress status={status} acceptedConfig={acceptedConfig} health={health} />

      {logs.length > 0 ? (
        <section style={{ marginTop: 24, marginBottom: 24 }}>
          <h2>Live Activity Log</h2>
          <pre
            style={{
              background: '#000',
              color: '#0f0',
              padding: 20,
              borderRadius: 12,
              height: 320,
              overflowY: 'auto',
              fontSize: 13,
              border: '2px solid #333',
              lineHeight: 1.6
            }}
          >
            {logs.slice(-150).join('\n')}
          </pre>
        </section>
      ) : null}

      <ArtifactsPanel
        runId={runId}
        artifacts={artifacts}
        artifactUrl={artifactUrl}
        artifactZipUrl={artifactZipUrl}
      />
    </div>
  );
}
