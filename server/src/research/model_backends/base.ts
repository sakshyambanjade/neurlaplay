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
    .map((uci, idx) => {
      const repeatRisk = input.repetitionRiskByIndex?.[idx];
      const suffix =
        repeatRisk && (repeatRisk.reversesLastMove || repeatRisk.recreatesPriorFen)
          ? ' [repeat-risk]'
          : '';
      return `${idx}: ${uci}${suffix}`;
    })
    .join('\n');

  const recentMovesBlock =
    input.recentMoves && input.recentMoves.length > 0
      ? `Recent moves:\n${input.recentMoves.join('\n')}\n`
      : '';
  const repetitionHint = input.avoidImmediateRepetition
    ? 'Avoid immediate back-and-forth repetition when reasonable alternatives exist.\n'
    : '';

  return {
    system:
      input.systemPrompt ??
      (
        input.strict
          ? 'Return exactly one integer index from the legal move list. No words. No punctuation.'
          : 'You are given a chess position and a numbered list of legal moves. Return exactly one integer: the index of the best move. No words. No punctuation.'
      ),
    user:
      `FEN: ${input.fen}\n${recentMovesBlock}${repetitionHint}Legal moves:\n${moves}\n` +
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
