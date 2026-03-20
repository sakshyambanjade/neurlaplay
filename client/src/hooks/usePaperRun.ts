import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const API = 'http://localhost:3001';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type MatchupConfig = {
  white: string;
  black: string;
  games: number;
  label: string;
};

export type RunConfig = {
  paperAngle: 'option_a_tension' | 'option_b_capability';
  mode: 'free_generation' | 'constrained_index' | 'move_scoring';
  matchups: MatchupConfig[];
  seed: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  contextPolicy: 'full_pgn_history' | 'last_10_moves' | 'fen_only';
  stockfishEvalDepth: number;
  blunderThresholdCp: number;
  settings: {
    maxMoves: number;
    moveTimeoutMs: number;
    gameTimeoutMs: number;
    moveDelayMs: number;
    interGameDelayMs: number;
    exportInterval: number;
    seed: number;
    openingRandomMoves: number;
    retryCount: number;
    fallbackPolicy: 'deterministic_first' | 'stockfish_best' | 'random_seeded';
  };
  logging: {
    logEveryMove: boolean;
    schemaVersion: string;
  };
};

export type RunStatus = {
  runId: string;
  step: string;
  progress: number;
  total: number;
  done: boolean;
  error?: string;
  startedAt: string;
  finishedAt?: string;
};

type AcceptedConfigResponse = {
  config: RunConfig;
};

type PresetInfo = {
  id: string;
  name: string;
  category: string;
};

const MAIN_1200_PRESET_ID = 'main/main_1200_full_study.json';

type ArtifactIndex = {
  files: string[];
  zipPath: string | null;
};

type IncompleteRun = {
  runId: string;
  startedAt: string;
  step: string;
  progress: number;
  total: number;
};

type GameInfo = {
  white: string;
  black: string;
  moveNumber: number;
  gameNum: number;
  totalGames: number;
};

type QualityState = {
  illegalSuggestions: number;
  correctionsApplied: number;
  lastMove: string;
  lastModel: string;
  lastSide: string;
};

type EtaState = {
  completedGames: number;
  totalGames: number;
  gamesPerHour: number;
  etaSec: number | null;
};

type HealthState = {
  ok: boolean;
  warnings: string[];
  completedGames: number;
  totalMoves: number;
  matchupLabel: string;
};

const FALLBACK_CONFIG: RunConfig = {
  paperAngle: 'option_b_capability',
  mode: 'constrained_index',
  matchups: [
    {
      white: 'groq:llama-3.1-8b-instant',
      black: 'groq:llama-3.1-8b-instant',
      games: 20,
      label: 'llama31_8b_mirror'
    }
  ],
  seed: 42,
  temperature: 0,
  topP: 1,
  maxTokens: 8,
  contextPolicy: 'fen_only',
  stockfishEvalDepth: 8,
  blunderThresholdCp: 200,
  settings: {
    maxMoves: 120,
    moveTimeoutMs: 10000,
    gameTimeoutMs: 3600000,
    moveDelayMs: 100,
    interGameDelayMs: 100,
    exportInterval: 1,
    seed: 42,
    openingRandomMoves: 4,
    retryCount: 1,
    fallbackPolicy: 'deterministic_first'
  },
  logging: {
    logEveryMove: true,
    schemaVersion: 'paper-run-v2'
  }
};

export function matchupKey(white: string, black: string): string {
  return `${white}__vs__${black}`;
}

export function usePaperRun() {
  const [config, setConfig] = useState<RunConfig>(FALLBACK_CONFIG);
  const [acceptedConfig, setAcceptedConfig] = useState<RunConfig | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [artifactZip, setArtifactZip] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentFen, setCurrentFen] = useState(START_FEN);
  const [gameInfo, setGameInfo] = useState<GameInfo>({
    white: '',
    black: '',
    moveNumber: 0,
    gameNum: 0,
    totalGames: 0
  });
  const [quality, setQuality] = useState<QualityState>({
    illegalSuggestions: 0,
    correctionsApplied: 0,
    lastMove: '',
    lastModel: '',
    lastSide: ''
  });
  const [eta, setEta] = useState<EtaState>({
    completedGames: 0,
    totalGames: 0,
    gamesPerHour: 0,
    etaSec: null
  });
  const [completedByMatchup, setCompletedByMatchup] = useState<Record<string, number>>({});
  const [incompleteRuns, setIncompleteRuns] = useState<IncompleteRun[]>([]);
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [health, setHealth] = useState<HealthState>({
    ok: true,
    warnings: [],
    completedGames: 0,
    totalMoves: 0,
    matchupLabel: ''
  });

  function resetUiState(): void {
    setRunId(null);
    setStatus(null);
    setLogs([]);
    setArtifacts([]);
    setArtifactZip(null);
    setCurrentFen(START_FEN);
    setGameInfo({ white: '', black: '', moveNumber: 0, gameNum: 0, totalGames: 0 });
    setQuality({
      illegalSuggestions: 0,
      correctionsApplied: 0,
      lastMove: '',
      lastModel: '',
      lastSide: ''
    });
    setEta({
      completedGames: 0,
      totalGames: 0,
      gamesPerHour: 0,
      etaSec: null
    });
    setHealth({
      ok: true,
      warnings: [],
      completedGames: 0,
      totalMoves: 0,
      matchupLabel: ''
    });
  }

  async function loadDefaultConfig(): Promise<void> {
    try {
      const response = await fetch(`${API}/api/paper/config/default`);
      const data = (await response.json()) as AcceptedConfigResponse;
      if (data.config) {
        setConfig(data.config);
      }
    } catch {
      setConfig(FALLBACK_CONFIG);
    }
  }

  async function loadPresets(): Promise<PresetInfo[]> {
    const response = await fetch(`${API}/api/paper/presets`);
    const data = (await response.json()) as { presets?: PresetInfo[] };
    const nextPresets = data.presets ?? [];
    setPresets(nextPresets);
    if (!selectedPresetId && nextPresets.length > 0) {
      setSelectedPresetId(nextPresets[0]!.id);
    }
    return nextPresets;
  }

  async function loadPreset(id: string): Promise<void> {
    const response = await fetch(`${API}/api/paper/config/preset?id=${encodeURIComponent(id)}`);
    const data = (await response.json()) as { config?: RunConfig; error?: string };
    if (!response.ok || !data.config) {
      throw new Error(data.error ?? 'Failed to load preset.');
    }
    setSelectedPresetId(id);
    setConfig(data.config);
  }

  async function startPresetRun(id: string): Promise<void> {
    const response = await fetch(`${API}/api/paper/config/preset?id=${encodeURIComponent(id)}`);
    const data = (await response.json()) as { config?: RunConfig; error?: string };
    if (!response.ok || !data.config) {
      throw new Error(data.error ?? 'Failed to load preset.');
    }
    setSelectedPresetId(id);
    setConfig(data.config);
    await startRun(data.config);
  }

  async function loadProgress(): Promise<Record<string, number>> {
    const response = await fetch(`${API}/api/paper/progress`);
    const data = (await response.json()) as { completedByMatchup?: Record<string, number> };
    const progressMap = data.completedByMatchup ?? {};
    setCompletedByMatchup(progressMap);
    return progressMap;
  }

  async function loadIncompleteRuns(): Promise<IncompleteRun[]> {
    const response = await fetch(`${API}/api/paper/incomplete`);
    const data = (await response.json()) as { runs?: IncompleteRun[] };
    const runs = data.runs ?? [];
    setIncompleteRuns(runs);
    return runs;
  }

  async function fetchStatus(id: string): Promise<void> {
    const response = await fetch(`${API}/api/paper/status/${id}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as RunStatus;
    setStatus(data);
  }

  async function fetchArtifacts(id: string): Promise<void> {
    const response = await fetch(`${API}/api/paper/artifacts/${id}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as ArtifactIndex;
    setArtifacts(data.files ?? []);
    setArtifactZip(data.zipPath ?? null);
  }

  useEffect(() => {
    void loadDefaultConfig();
    void loadProgress();
    void loadPresets();
    void loadIncompleteRuns().then((runs) => {
      const savedRunId = localStorage.getItem('paper_run_id');
      if (!savedRunId && runs.length > 0) {
        const latest = runs[0]!;
        setRunId(latest.runId);
        void fetchStatus(latest.runId);
        void fetchArtifacts(latest.runId);
      }
    });

    const savedRunId = localStorage.getItem('paper_run_id');
    if (savedRunId) {
      setRunId(savedRunId);
      void fetchStatus(savedRunId);
      void fetchArtifacts(savedRunId);
    }
  }, []);

  useEffect(() => {
    if (!runId) {
      return;
    }

    const s = io(API);
    s.emit('join:paper', runId);

    s.on('paper:status', (payload: RunStatus) => {
      setStatus(payload);
      if (payload.done) {
        void fetchArtifacts(runId);
      }
    });
    s.on('paper:log', (message: string) => {
      setLogs((current) => [...current.slice(-199), message]);
    });
    s.on('paper:done', (payload: RunStatus) => {
      setStatus(payload);
      void fetchArtifacts(runId);
    });
    s.on('paper:eta', (payload: EtaState) => {
      setEta({
        completedGames: payload.completedGames ?? 0,
        totalGames: payload.totalGames ?? 0,
        gamesPerHour: payload.gamesPerHour ?? 0,
        etaSec: payload.etaSec ?? null
      });
    });
    s.on('paper:accepted_config', (payload: { config?: RunConfig }) => {
      if (payload.config) {
        setAcceptedConfig(payload.config);
      }
    });
    s.on('paper:health', (payload: Partial<HealthState>) => {
      setHealth({
        ok: payload.ok ?? true,
        warnings: payload.warnings ?? [],
        completedGames: payload.completedGames ?? 0,
        totalMoves: payload.totalMoves ?? 0,
        matchupLabel: payload.matchupLabel ?? ''
      });
    });
    s.on('game:start', (payload: { gameInfo?: GameInfo; quality?: Partial<QualityState> }) => {
      setCurrentFen(START_FEN);
      if (payload.gameInfo) {
        setGameInfo(payload.gameInfo);
      }
      const qualityUpdate = payload.quality;
      if (qualityUpdate) {
        setQuality((current) => ({
          ...current,
          illegalSuggestions: qualityUpdate.illegalSuggestions ?? current.illegalSuggestions,
          correctionsApplied: qualityUpdate.correctionsApplied ?? current.correctionsApplied
        }));
      }
    });
    s.on(
      'game:move',
      (payload: {
        fen?: string;
        move?: string;
        side?: string;
        model?: string;
        gameInfo?: GameInfo;
        quality?: Partial<QualityState> & {
          correctionApplied?: boolean;
        };
      }) => {
        if (payload.fen) {
          setCurrentFen(payload.fen);
        }
        if (payload.gameInfo) {
          setGameInfo(payload.gameInfo);
        }
        setQuality((current) => ({
          ...current,
          illegalSuggestions: payload.quality?.illegalSuggestions ?? current.illegalSuggestions,
          correctionsApplied: payload.quality?.correctionsApplied ?? current.correctionsApplied,
          lastMove: payload.move ?? current.lastMove,
          lastModel: payload.model ?? current.lastModel,
          lastSide: payload.side ?? current.lastSide
        }));

        if (payload.move) {
          const correctionTag = payload.quality?.correctionApplied ? ' [corrected]' : '';
          const moveLine = `G${payload.gameInfo?.gameNum ?? '?'} M${payload.gameInfo?.moveNumber ?? '?'}: ${payload.side ?? '?'} ${payload.model ?? '?'} -> ${payload.move}${correctionTag}`;
          setLogs((current) => [...current.slice(-199), moveLine]);
        }
      }
    );
    s.on(
      'game:complete',
      (payload: {
        result?: string;
        termination?: string;
        moveCount?: number;
        gameInfo?: GameInfo;
      }) => {
        const summaryLine = `G${payload.gameInfo?.gameNum ?? '?'} finished: ${payload.result ?? '?'} (${payload.termination ?? 'unknown'}), moves=${payload.moveCount ?? '?'}`;
        setLogs((current) => [...current.slice(-199), summaryLine]);
      }
    );

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [runId]);

  async function startRun(submittedConfig: RunConfig = config): Promise<void> {
    const response = await fetch(`${API}/api/paper/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submittedConfig)
    });
    const data = (await response.json()) as { runId?: string; acceptedConfig?: RunConfig; error?: string };
    if (!response.ok || !data.runId || !data.acceptedConfig) {
      throw new Error(data.error ?? 'Failed to start run.');
    }

    resetUiState();
    setConfig(submittedConfig);
    setAcceptedConfig(data.acceptedConfig);
    setRunId(data.runId);
    localStorage.setItem('paper_run_id', data.runId);
    setLogs([`Accepted config received from server. Run ${data.runId} started.`]);
    await fetchStatus(data.runId);
    await loadIncompleteRuns();
  }

  async function continueRemaining(): Promise<void> {
    const latestCompletedByMatchup = await loadProgress();
    const remainingMatchups = config.matchups
      .map((matchup) => {
        const completed = latestCompletedByMatchup[matchupKey(matchup.white, matchup.black)] ?? 0;
        return {
          ...matchup,
          games: Math.max(0, matchup.games - completed)
        };
      })
      .filter((matchup) => matchup.games > 0);

    if (remainingMatchups.length === 0) {
      setLogs((current) => [...current.slice(-199), 'All configured matchup targets already reached.']);
      return;
    }

    const nextConfig = { ...config, matchups: remainingMatchups };
    await startRun(nextConfig);
  }

  async function resetResearch(): Promise<void> {
    await fetch(`${API}/api/paper/reset`, { method: 'POST' });
    localStorage.removeItem('paper_run_id');
    resetUiState();
    await loadProgress();
    await loadIncompleteRuns();
  }

  async function resumeRun(targetRunId: string): Promise<void> {
    const response = await fetch(`${API}/api/paper/resume/${targetRunId}`, {
      method: 'POST'
    });
    const data = (await response.json()) as {
      runId: string;
      restarted: boolean;
      state?: { done?: boolean };
    };
    if (!response.ok) {
      throw new Error('Failed to resume run.');
    }

    setRunId(data.runId);
    localStorage.setItem('paper_run_id', data.runId);
    setLogs((current) => [
      ...current.slice(-199),
      data.restarted ? `Resumed run ${data.runId}.` : `Run ${data.runId} is not resumable.`
    ]);
    await fetchStatus(data.runId);
    await fetchArtifacts(data.runId);
    await loadIncompleteRuns();
  }

  async function launchMainExperiment(): Promise<void> {
    if (incompleteRuns.length > 0) {
      await resumeRun(incompleteRuns[0]!.runId);
      return;
    }
    await startPresetRun(MAIN_1200_PRESET_ID);
  }

  const totalGames = useMemo(
    () => config.matchups.reduce((sum, matchup) => sum + matchup.games, 0),
    [config.matchups]
  );

  const etaText = useMemo(() => {
    if (eta.etaSec === null) {
      return 'Calculating...';
    }
    const etaHours = eta.etaSec / 3600;
    return etaHours >= 1 ? `${etaHours.toFixed(2)} h` : `${Math.ceil(eta.etaSec / 60)} min`;
  }, [eta.etaSec]);

  function updateMatchup(index: number, patch: Partial<MatchupConfig>): void {
    setConfig((current) => {
      const nextMatchups = [...current.matchups];
      nextMatchups[index] = { ...nextMatchups[index], ...patch };
      return { ...current, matchups: nextMatchups };
    });
  }

  function updateConfig<K extends keyof RunConfig>(key: K, value: RunConfig[K]): void {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateSettings<K extends keyof RunConfig['settings']>(
    key: K,
    value: RunConfig['settings'][K]
  ): void {
    setConfig((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value
      }
    }));
  }

  function artifactUrl(file: string): string {
    if (!runId) {
      return '#';
    }
    return `${API}/artifacts/runs/${runId}/${file}`;
  }

  const artifactZipUrl =
    runId && artifactZip !== null ? `${API}/artifacts/runs/${runId}/artifacts.zip` : null;

  return {
    apiBase: API,
    socket,
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
    totalGames,
    completedByMatchup,
    incompleteRuns,
    presets,
    selectedPresetId,
    health,
    updateConfig,
    updateSettings,
    updateMatchup,
    loadProgress,
    fetchStatus,
    fetchArtifacts,
    loadPreset,
    loadPresets,
    setSelectedPresetId,
    startRun,
    continueRemaining,
    resetResearch,
    resumeRun,
    launchMainExperiment,
    startPresetRun,
    main1200PresetId: MAIN_1200_PRESET_ID,
    artifactUrl
  };
}
