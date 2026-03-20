import type { MoveSelectionInput, ModelSelectionResult } from '../types/move.js';
import { inferProviderFromModel } from '../types/provider.js';

export interface ModelBackend {
  selectMoveIndex(input: MoveSelectionInput): Promise<ModelSelectionResult>;
}

export function buildSelectionPrompts(input: MoveSelectionInput): {
  system: string;
  user: string;
} {
  const moves = input.legalMovesUci
    .map((uci, idx) => `${idx}: ${input.legalMovesSan?.[idx] ?? uci} (${uci})`)
    .join('\n');

  return {
    system:
      input.systemPrompt ??
      (
        input.strict
          ? 'You must return exactly one integer index from the legal move list. No words, no punctuation, no explanation.'
          : 'You are given a chess position and a numbered list of legal moves. Return exactly one integer: the index of the best move. Do not explain.'
      ),
    user:
      `FEN: ${input.fen}\nLegal moves (index: SAN (UCI)):\n${moves}\n` +
      `Output only the integer index (0-${input.legalMovesUci.length - 1}).`
  };
}

export function splitProviderModel(providerModel: string): {
  provider: ReturnType<typeof inferProviderFromModel>;
  model: string;
} {
  const provider = inferProviderFromModel(providerModel);
  if (provider === 'groq') {
    return { provider, model: providerModel.replace(/^groq:/, '') };
  }
  return { provider, model: providerModel };
}
