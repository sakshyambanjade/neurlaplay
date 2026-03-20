import type { CSSProperties } from 'react';
import type { RunConfig } from '../../hooks/usePaperRun';
import { MatchupEditor } from './MatchupEditor';

type Props = {
  config: RunConfig;
  incompleteRuns: Array<{
    runId: string;
    startedAt: string;
    step: string;
    progress: number;
    total: number;
  }>;
  presets: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  selectedPresetId: string;
  onPresetSelect: (presetId: string) => void;
  onLoadPreset: (presetId: string) => Promise<void>;
  completedByMatchup: Record<string, number>;
  onConfigChange: <K extends keyof RunConfig>(key: K, value: RunConfig[K]) => void;
  onSettingsChange: <K extends keyof RunConfig['settings']>(
    key: K,
    value: RunConfig['settings'][K]
  ) => void;
  onMatchupChange: (index: number, patch: Partial<RunConfig['matchups'][number]>) => void;
  onRefreshProgress: () => Promise<unknown>;
  onStart: () => Promise<void>;
  onContinue: () => Promise<void>;
  onReset: () => Promise<void>;
  onResume: (runId: string) => Promise<void>;
  runInProgress: boolean;
};

export function RunConfigForm({
  config,
  incompleteRuns,
  presets,
  selectedPresetId,
  onPresetSelect,
  onLoadPreset,
  completedByMatchup,
  onConfigChange,
  onSettingsChange,
  onMatchupChange,
  onRefreshProgress,
  onStart,
  onContinue,
  onReset,
  onResume,
  runInProgress
}: Props) {
  return (
    <div>
      <section style={{ background: '#1a1a2e', padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Preset Configs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10, alignItems: 'end' }}>
          <label style={{ fontSize: 14 }}>
            Preset
            <select
              value={selectedPresetId}
              onChange={(event) => onPresetSelect(event.target.value)}
              style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.category} / {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void onLoadPreset(selectedPresetId)}
            disabled={!selectedPresetId}
            style={{
              ...secondaryButtonStyle,
              marginTop: 0,
              opacity: selectedPresetId ? 1 : 0.6
            }}
          >
            Load preset
          </button>
        </div>
      </section>

      <MatchupEditor
        matchups={config.matchups}
        completedByMatchup={completedByMatchup}
        onChange={onMatchupChange}
        onRefresh={onRefreshProgress}
      />

      <section style={{ background: '#1a1a2e', padding: 20, borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Experiment Config</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <LabeledInput
            label="Seed"
            value={config.seed}
            onChange={(value) => onConfigChange('seed', value)}
          />
          <LabeledInput
            label="Temperature"
            value={config.temperature}
            onChange={(value) => onConfigChange('temperature', value)}
          />
          <LabeledInput
            label="Top-P"
            value={config.topP}
            onChange={(value) => onConfigChange('topP', value)}
          />
          <LabeledInput
            label="Max Tokens"
            value={config.maxTokens}
            onChange={(value) => onConfigChange('maxTokens', value)}
          />
          <LabeledInput
            label="Stockfish Depth"
            value={config.stockfishEvalDepth}
            onChange={(value) => onConfigChange('stockfishEvalDepth', value)}
          />
          <LabeledInput
            label="Blunder CP Threshold"
            value={config.blunderThresholdCp}
            onChange={(value) => onConfigChange('blunderThresholdCp', value)}
          />
          <LabeledInput
            label="Max Moves"
            value={config.settings.maxMoves}
            onChange={(value) => onSettingsChange('maxMoves', value)}
          />
          <LabeledInput
            label="Retry Count"
            value={config.settings.retryCount}
            onChange={(value) => onSettingsChange('retryCount', value)}
          />
          <LabeledSelect
            label="Paper Angle"
            value={config.paperAngle}
            options={[
              { value: 'option_b_capability', label: 'Capability / reliability' },
              { value: 'option_a_tension', label: 'Tension / complexity' }
            ]}
            onChange={(value) => onConfigChange('paperAngle', value as RunConfig['paperAngle'])}
          />
          <LabeledSelect
            label="Context Policy"
            value={config.contextPolicy}
            options={[
              { value: 'fen_only', label: 'FEN only' },
              { value: 'last_10_moves', label: 'Last 10 moves' },
              { value: 'full_pgn_history', label: 'Full PGN history' }
            ]}
            onChange={(value) =>
              onConfigChange('contextPolicy', value as RunConfig['contextPolicy'])
            }
          />
          <LabeledSelect
            label="Experiment Mode"
            value={config.mode}
            options={[
              { value: 'constrained_index', label: 'Constrained index' },
              { value: 'free_generation', label: 'Free generation' },
              { value: 'move_scoring', label: 'Move scoring' }
            ]}
            onChange={(value) => onConfigChange('mode', value as RunConfig['mode'])}
          />
          <LabeledSelect
            label="Fallback Policy"
            value={config.settings.fallbackPolicy}
            options={[
              { value: 'deterministic_first', label: 'Deterministic first' },
              { value: 'stockfish_best', label: 'Stockfish best' },
              { value: 'random_seeded', label: 'Random seeded' }
            ]}
            onChange={(value) =>
              onSettingsChange(
                'fallbackPolicy',
                value as RunConfig['settings']['fallbackPolicy']
              )
            }
          />
        </div>

        <button
          onClick={() => void onStart()}
          disabled={runInProgress}
          style={{
            ...primaryButtonStyle,
            marginTop: 24,
            width: '100%',
            background: runInProgress ? '#666' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            cursor: runInProgress ? 'not-allowed' : 'pointer'
          }}
        >
          {runInProgress ? 'Run in progress...' : 'Start paper run'}
        </button>

        <button onClick={() => void onContinue()} style={{ ...secondaryButtonStyle, marginTop: 12 }}>
          Continue remaining games
        </button>

        <button onClick={() => void onReset()} style={{ ...dangerButtonStyle, marginTop: 12 }}>
          Reset paper runs
        </button>

        {incompleteRuns.length > 0 ? (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Interrupted Runs</h3>
            {incompleteRuns.map((run) => (
              <div
                key={run.runId}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: '#111827',
                  marginBottom: 10
                }}
              >
                <div style={{ fontSize: 13, marginBottom: 4 }}>{run.runId}</div>
                <div style={{ fontSize: 12, color: '#9bb0d1', marginBottom: 8 }}>
                  {run.step} | {run.progress} / {run.total}
                </div>
                <button
                  onClick={() => void onResume(run.runId)}
                  style={{
                    ...secondaryButtonStyle,
                    marginTop: 0
                  }}
                >
                  Resume this run
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

type InputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function LabeledInput({ label, value, onChange }: InputProps) {
  return (
    <label style={{ fontSize: 14 }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

function LabeledSelect({ label, value, options, onChange }: SelectProps) {
  return (
    <label style={{ fontSize: 14 }}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const inputStyle: CSSProperties = {
  padding: 8,
  background: '#0a0a0a',
  color: '#fff',
  border: '1px solid #4C72B0',
  borderRadius: 6
};

const primaryButtonStyle: CSSProperties = {
  padding: '14px 24px',
  fontSize: 18,
  fontWeight: 'bold',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)'
};

const secondaryButtonStyle: CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  fontSize: 15,
  fontWeight: 'bold',
  background: '#2e7d32',
  color: 'white',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer'
};

const dangerButtonStyle: CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  fontSize: 15,
  fontWeight: 'bold',
  background: '#b23b3b',
  color: 'white',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer'
};
