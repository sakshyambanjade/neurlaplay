import { create } from 'zustand';
import { MoveRecord, PlayerColor, BotConfig, GameStatus } from '../types';

/**
 * Game store - Zustand store for global game state
 */
interface GameStore {
  // Match info
  matchId: string | null;
  status: GameStatus;
  userColor: PlayerColor | null;
  whiteBot: { botName: string; model: string; eloRating?: number } | null;
  blackBot: { botName: string; model: string; eloRating?: number } | null;

  // Game state
  fen: string;
  pgn: string;
  legalMoves: string[];
  moves: MoveRecord[];
  isCheck: boolean;
  lastMove: string | null;

  // UI state
  isThinking: boolean;
  selectedMove: string | null;
  analysisMode: boolean;

  // Bot configs
  userBotConfig: BotConfig | null;

  // Actions
  setMatchId: (id: string) => void;
  setUserColor: (color: PlayerColor) => void;
  setWhiteBot: (name: string, model: string) => void;
  setBlackBot: (name: string, model: string) => void;
  setGameState: (fen: string, pgn: string, legalMoves: string[], moves: MoveRecord[], isCheck: boolean) => void;
  setThinking: (thinking: boolean) => void;
  addMove: (move: MoveRecord) => void;
  setStatus: (status: GameStatus) => void;
  setBotConfig: (config: BotConfig) => void;
  reset: () => void;
}

const initialState = {
  matchId: null,
  status: 'waiting' as GameStatus,
  userColor: null,
  whiteBot: null,
  blackBot: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '',
  legalMoves: [],
  moves: [],
  isCheck: false,
  lastMove: null,
  isThinking: false,
  selectedMove: null,
  analysisMode: false,
  userBotConfig: null
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setMatchId: (id) => set({ matchId: id }),

  setUserColor: (color) => set({ userColor: color }),

  setWhiteBot: (botName, model) =>
    set({ whiteBot: { botName, model } }),

  setBlackBot: (botName, model) =>
    set({ blackBot: { botName, model } }),

  setGameState: (fen, pgn, legalMoves, moves, isCheck) =>
    set({
      fen,
      pgn,
      legalMoves,
      moves,
      isCheck,
      lastMove: moves.length > 0 ? moves[moves.length - 1].uci : null
    }),

  setThinking: (thinking) => set({ isThinking: thinking }),

  addMove: (move) =>
    set((state) => ({
      moves: [...state.moves, move],
      lastMove: move.uci
    })),

  setStatus: (status) => set({ status }),

  setBotConfig: (config) => set({ userBotConfig: config }),

  reset: () => set(initialState)
}));
