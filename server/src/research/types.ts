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
  };
};

export type GamePhase = 'opening' | 'midgame' | 'endgame';

export type PaperCollectionOptions = {
  enabled: boolean;
  trackReasoning: boolean;
  trackConfidence: boolean;
};

export type PaperDatapoint = {
  gameId: string;
  gameIndex: number;
  moveNumber: number;
  side: 'white' | 'black';
  model: string;
  timestamp: number;
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
