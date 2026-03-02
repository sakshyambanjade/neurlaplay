/**
 * Shared types for LLMArena
 * Used by both client and server
 */

export type GameStatus = 'waiting' | 'ready' | 'in_progress' | 'completed' | 'aborted';
export type PlayerColor = 'white' | 'black';
export type EndpointType = 'openai' | 'anthropic' | 'groq' | 'custom';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';
export type Termination = 'checkmate' | 'stalemate' | 'draw' | 'timeout' | 'forfeit' | 'disconnect' | 'move_cap' | 'in_progress';
export type MoveQuality = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface BotConfig {
  botName: string;
  model: string;
  endpointType: EndpointType;
  endpointUrl: string;
  apiKey: string;
}

export interface PlayerConfig extends BotConfig {
  socketId?: string;
  userId?: string;
  isReady?: boolean;
}

export interface MoveRecord {
  id?: string;
  matchId?: string;
  moveNumber: number;
  playerColor: PlayerColor;
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
  reasoning: string;
  timeTakenMs: number;
  sfEvalBefore?: number;
  sfEvalAfter?: number;
  sfBestMove?: string;
  cpLoss?: number;
  quality?: MoveQuality;
  createdAt?: Date;
}

export interface Match {
  id: string;
  status: GameStatus;
  whiteBotName: string;
  whiteModel: string;
  blackBotName: string;
  blackModel: string;
  result?: GameResult;
  termination?: Termination;
  winnerColor?: PlayerColor;
  finalFen?: string;
  finalPgn?: string;
  totalMoves: number;
  moveTimeoutSeconds: number;
  isPublic: boolean;
  researchMode: boolean;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

// Socket.io Event Payloads

export interface CreateMatchPayload {
  timeoutSeconds?: number;
  isPublic?: boolean;
  researchMode?: boolean;
}

export interface JoinMatchPayload {
  matchId: string;
  userId?: string;
}

export interface SetConfigPayload {
  matchId: string;
  botName: string;
  model: string;
  endpointType: EndpointType;
  endpointUrl: string;
}

export interface SetReadyPayload {
  matchId: string;
}

export interface MovePayload {
  matchId: string;
  uci: string;
  reasoning: string;
  timeTakenMs: number;
}

export interface ForfeitPayload {
  matchId: string;
  reason: string;
}

export interface AnalysisCompletePayload {
  matchId: string;
  analyzedMoves: MoveRecord[];
}

// Server→Client events

export interface MatchCreatedEvent {
  matchId: string;
  color: PlayerColor;
}

export interface OpponentJoinedEvent {
  botName: string;
  model: string;
  endpointType: EndpointType;
}

export interface GameStartEvent {
  matchId: string;
  whiteBotName: string;
  blackBotName: string;
  fen: string;
  legalMoves: string[];
  timeoutSeconds: number;
}

export interface TurnStartEvent {
  color: PlayerColor;
  fen: string;
  legalMoves: string[];
  pgn: string;
  timeoutSeconds: number;
}

export interface MoveMadeEvent extends MoveRecord {
  fen: string;
  isCheck: boolean;
  legalMoves: string[];
  pgn: string;
}

export interface ForfeitEvent {
  loserColor: PlayerColor;
  reason: string;
  message?: string;
}

export interface GameOverEvent {
  result: GameResult;
  winner?: PlayerColor;
  termination: Termination;
  finalFen: string;
  pgn: string;
  totalMoves: number;
}

export interface ErrorEvent {
  code: string;
  message: string;
}

export interface OpponentDisconnectedEvent {
  color: PlayerColor;
  waitSeconds: number;
}
