export type ProviderKind = 'groq' | 'ollama' | 'unknown';

export type ExperimentMode = 'free_generation' | 'constrained_index' | 'move_scoring';

export type FallbackPolicyName =
  | 'deterministic_first'
  | 'stockfish_best'
  | 'random_seeded';

export function inferProviderFromModel(model: string): ProviderKind {
  if (model.startsWith('groq:')) {
    return 'groq';
  }
  if (model.trim().length > 0) {
    return 'ollama';
  }
  return 'unknown';
}
