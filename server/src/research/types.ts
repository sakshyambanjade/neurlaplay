export type BatchConfig = {
  games: number;
  outputDir: string;
  models: {
    white: string;
    black: string;
  };
  settings: {
    maxMoves: number;
    moveTimeoutMs: number;
    gameTimeoutMs: number;
    moveDelayMs: number;
    interGameDelayMs: number;
    exportInterval: number;
    stockfishEvalDepth?: number;
    blunderThresholdCp?: number;
    seed?: number;
    openingRandomMoves?: number;
  };
};

// NOTE: Python analysis scripts expect these exact strings; keep in sync.
export type GamePhase = 'opening' | 'midgame' | 'endgame';

export type PaperCollectionOptions = {
  enabled: boolean;
  trackReasoning: boolean;
  trackConfidence: boolean;
};

export type IllegalMoveFailureMode =
  | 'empty_output'
  | 'wrong_format'
  | 'non_chess_text'
  | 'pseudo_legal_or_illegal'
  | 'request_failed'
  | 'timeout_or_abort'
  | 'unparseable'
  | 'unknown';

export type BindingProfile = {
  hasPiece: boolean;
  hasOrigin: boolean;
  hasDestination: boolean;
  hasLegalConstraint: boolean;
  boundCount: 0 | 1 | 2 | 3 | 4;
};

export type PaperDatapoint = {
  gameId: string;
  gameIndex: number;
  moveNumber: number;
  side: 'white' | 'black';
  model: string;
  timestamp: number;
  thinkTimeMs?: number;
  moveTimeMs?: number;
  fenBefore: string;
  fenAfter: string;
  move: string;
  legalMoves: string[];
  reasoning: string;
  confidence: number;
  cpl: number;
  gamePhase: GamePhase;
  materialBalance: number;
  isCritical: boolean;
  winProbability: number;
  illegalSuggestion: boolean;
  illegalFailureMode: IllegalMoveFailureMode | null;
  bindingProfile: BindingProfile | null;
  correctionApplied: boolean;
};

export type GamePaperSummary = {
  gameId: string;
  gameIndex: number;
  whiteModel: string;
  blackModel: string;
  result: string;
  termination: string;
  moveCount: number;
  pgn: string;
  startedAt: string;
  endedAt: string;
  averageCplWhite: number;
  averageCplBlack: number;
  ruleAudit: RuleAudit;
};

export type RuleAudit = {
  boardSetupValid: boolean;
  kingPresenceValid: boolean;
  turnAlternationValid: boolean;
  legalMoveOnly: boolean;
  ownKingSafetyMaintained: boolean;
  castlingMoves: number;
  enPassantCaptures: number;
  promotions: number;
  fallbackMovesUsed: number;
  invalidModelMoveAttempts: number;
  invalidMoveFailureModes: Partial<Record<IllegalMoveFailureMode, number>>;
  bindingAttemptCount: number;
  bindingBoundCountTotal: number;
  bindingComponentHits: {
    piece: number;
    origin: number;
    destination: number;
    legalConstraint: number;
  };
};

export type PaperStatsSummary = {
  totalGames: number;
  whiteModel: string;
  blackModel: string;
  whiteWins: number;
  blackWins: number;
  draws: number;
  whiteWinRate: number;
  blackWinRate: number;
  drawRate: number;
  avgCpl: {
    white: number;
    black: number;
    overall: number;
  };
  blunderRate: {
    white: number;
    black: number;
    overall: number;
  };
  phasePerformance: {
    opening: number;
    midgame: number;
    endgame: number;
  };
  effectSizes: {
    winRateGap: number;
  };
  confidenceInterval95: {
    whiteWinRate: [number, number];
    blackWinRate: [number, number];
    drawRate: [number, number];
  };
  pValueWhiteVsBlack: number;
  reliability: {
    illegalSuggestionCount: number;
    correctionCount: number;
    illegalSuggestionRate: number;
    correctionRate: number;
    illegalFailureModes: Partial<Record<IllegalMoveFailureMode, number>>;
  };
  compliance: {
    totalMoves: number;
    llmAcceptedMoves: number;
    fallbackMoves: number;
    llmMoveRate: number;
    fallbackRate: number;
    llmMoveRateBySide: {
      white: number;
      black: number;
    };
    fallbackRateBySide: {
      white: number;
      black: number;
    };
    invalidModelMoveAttempts: number;
    invalidMoveFailureModes: Partial<Record<IllegalMoveFailureMode, number>>;
    gamesWithAnyLlmMove: number;
    gamesWithOnlyFallback: number;
    legalMoveOnlyGames: number;
  };
  binding: {
    illegalAttempts: number;
    meanBoundCount: number;
    meanBoundCountPerGame: number;
    meanBoundCountByPhase: {
      opening: number;
      midgame: number;
      endgame: number;
    };
    meanBoundCountByModel: Record<string, number>;
    bindingCurveByMove: Array<{
      moveNumber: number;
      meanBoundCount: number;
      samples: number;
    }>;
    componentPresenceRate: {
      piece: number;
      origin: number;
      destination: number;
      legalConstraint: number;
    };
  };
};

export type PaperArtifacts = {
  latexTable3: string;
  statsSummary: PaperStatsSummary;
  pgnFile: string;
  visualizations: string[];
  datapointsFile: string;
};

export type GameResult = {
  gameId: string;
  whiteModel: string;
  blackModel: string;
  result: string;
  termination: string;
  moveCount: number;
  pgn: string;
  startedAt: string;
  endedAt: string;
  ruleAudit: RuleAudit;
};
