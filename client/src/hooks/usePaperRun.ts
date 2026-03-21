import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

const API = resolveApiBase();
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
    providerRetryCount?: number;
    providerBackoffMs?: number;
    maxTotalProviderWaitMs?: number;
    antiOscillation?: boolean;
    avoidImmediateRepetition?: boolean;
    recentMoveWindow?: number;
    maxNoProgressPlies?: number;
    enableLiveCpl?: boolean;
    enablePostRunCpl?: boolean;
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
  repeatStateMoves: number;
  oscillationRejected: number;
  oscillationOverrides: number;
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
  fallbackMoves: number;
  repeatStateMoves: number;
  oscillationRejectedCount: number;
  collapseDetectedGames: number;
  noProgressMaxStreak: number;
};

type RunStartResponse = {
  runId?: string;
  acceptedConfig?: RunConfig;
  error?: string;
  existingRunId?: string;
};

export function matchupKey(white: string, black: string): string {
  return `${white}__vs__${black}`;
}

export function usePaperRun() {
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
    repeatStateMoves: 0,
    oscillationRejected: 0,
    oscillationOverrides: 0,
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
  const [incompleteRuns, setIncompleteRuns] = useState<IncompleteRun[]>([]);
  const [health, setHealth] = useState<HealthState>({
    ok: true,
    warnings: [],
    completedGames: 0,
    totalMoves: 0,
    matchupLabel: '',
    fallbackMoves: 0,
    repeatStateMoves: 0,
    oscillationRejectedCount: 0,
    collapseDetectedGames: 0,
    noProgressMaxStreak: 0
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
      repeatStateMoves: 0,
      oscillationRejected: 0,
      oscillationOverrides: 0,
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
      matchupLabel: '',
      fallbackMoves: 0,
      repeatStateMoves: 0,
      oscillationRejectedCount: 0,
      collapseDetectedGames: 0,
      noProgressMaxStreak: 0
    });
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

    const s = API ? io(API) : io();
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
        matchupLabel: payload.matchupLabel ?? '',
        fallbackMoves: payload.fallbackMoves ?? 0,
        repeatStateMoves: payload.repeatStateMoves ?? 0,
        oscillationRejectedCount: payload.oscillationRejectedCount ?? 0,
        collapseDetectedGames: payload.collapseDetectedGames ?? 0,
        noProgressMaxStreak: payload.noProgressMaxStreak ?? 0
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
          correctionsApplied: qualityUpdate.correctionsApplied ?? current.correctionsApplied,
          repeatStateMoves: qualityUpdate.repeatStateMoves ?? current.repeatStateMoves,
          oscillationRejected: qualityUpdate.oscillationRejected ?? current.oscillationRejected,
          oscillationOverrides: qualityUpdate.oscillationOverrides ?? current.oscillationOverrides
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
          repeatStateMoves: payload.quality?.repeatStateMoves ?? current.repeatStateMoves,
          oscillationRejected: payload.quality?.oscillationRejected ?? current.oscillationRejected,
          oscillationOverrides: payload.quality?.oscillationOverrides ?? current.oscillationOverrides,
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
        collapseDetected?: boolean;
        collapseReason?: string | null;
        gameInfo?: GameInfo;
      }) => {
        const collapseTag = payload.collapseDetected
          ? `, collapse=${payload.collapseReason ?? 'detected'}`
          : '';
        const summaryLine = `G${payload.gameInfo?.gameNum ?? '?'} finished: ${payload.result ?? '?'} (${payload.termination ?? 'unknown'}), moves=${payload.moveCount ?? '?'}${collapseTag}`;
        setLogs((current) => [...current.slice(-199), summaryLine]);
      }
    );

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [runId]);

  async function startLockedRun(kind: 'main' | 'pilot'): Promise<void> {
    const response = await fetch(`${API}/api/paper/run/${kind}`, {
      method: 'POST'
    });
    const data = (await response.json()) as RunStartResponse;
    if (response.status === 409) {
      if (data.runId) {
        setRunId(data.runId);
        localStorage.setItem('paper_run_id', data.runId);
        await fetchStatus(data.runId);
        await fetchArtifacts(data.runId);
        await loadIncompleteRuns();
      }
      throw new Error(
        data.error ?? 'An unfinished run already exists. Resume it instead of starting a new one.'
      );
    }
    if (!response.ok || !data.runId || !data.acceptedConfig) {
      throw new Error(data.error ?? `Failed to start ${kind} run.`);
    }

    resetUiState();
    setAcceptedConfig(data.acceptedConfig);
    setRunId(data.runId);
    localStorage.setItem('paper_run_id', data.runId);
    setLogs([`Accepted config received from server. Run ${data.runId} started.`]);
    await fetchStatus(data.runId);
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
    await startLockedRun('main');
  }

  async function launchPilotExperiment(): Promise<void> {
    await startLockedRun('pilot');
  }

  async function resumeLatestRun(): Promise<void> {
    if (incompleteRuns.length === 0) {
      throw new Error('No interrupted run is available to resume.');
    }
    await resumeRun(incompleteRuns[0]!.runId);
  }

  const etaText = useMemo(() => {
    if (eta.etaSec === null) {
      return 'Calculating...';
    }
    const etaHours = eta.etaSec / 3600;
    return etaHours >= 1 ? `${etaHours.toFixed(2)} h` : `${Math.ceil(eta.etaSec / 60)} min`;
  }, [eta.etaSec]);

  function artifactUrl(file: string): string {
    if (!runId) {
      return '#';
    }
    return `${API}/artifacts/runs/${runId}/${file}`;
  }

  const artifactZipUrl =
    runId && artifactZip !== null ? `${API}/artifacts/runs/${runId}/artifacts.zip` : null;

  const latestIncompleteRun = incompleteRuns[0] ?? null;
  const hasActiveRun = Boolean(status && !status.done);
  const runLocked = hasActiveRun || latestIncompleteRun !== null;
  const canStartFresh = !runLocked;
  const canResumeLatest = latestIncompleteRun !== null && !hasActiveRun;

  return {
    apiBase: API,
    socket,
    runId,
    status,
    acceptedConfig,
    logs,
    artifacts,
    artifactZipUrl,
    currentFen,
    gameInfo,
    quality,
    eta,
    etaText,
    incompleteRuns,
    latestIncompleteRun,
    health,
    hasActiveRun,
    runLocked,
    canStartFresh,
    canResumeLatest,
    fetchStatus,
    fetchArtifacts,
    resumeRun,
    resumeLatestRun,
    launchMainExperiment,
    launchPilotExperiment,
    artifactUrl
  };
}
