import { create } from 'zustand';
const initialState = {
    matchId: null,
    playerSessionId: null,
    status: 'waiting',
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
export const useGameStore = create((set) => ({
    ...initialState,
    setMatchId: (id) => set({ matchId: id }),
    setPlayerSessionId: (id) => set({ playerSessionId: id }),
    setUserColor: (color) => set({ userColor: color }),
    setWhiteBot: (botName, model) => set({ whiteBot: { botName, model } }),
    setBlackBot: (botName, model) => set({ blackBot: { botName, model } }),
    setGameState: (fen, pgn, legalMoves, moves, isCheck) => set({
        fen,
        pgn,
        legalMoves,
        moves,
        isCheck,
        lastMove: moves.length > 0 ? moves[moves.length - 1].uci : null
    }),
    setThinking: (thinking) => set({ isThinking: thinking }),
    addMove: (move) => set((state) => ({
        moves: [...state.moves, move],
        lastMove: move.uci
    })),
    setStatus: (status) => set({ status }),
    setBotConfig: (config) => set({ userBotConfig: config }),
    reset: () => set(initialState)
}));
