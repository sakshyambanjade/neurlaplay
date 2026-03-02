/**
 * Chess prompts for the bot runner
 * Building the strict prompts that go to the LLM
 */

export function buildPrompt({
  fen,
  legalMoves,
  pgn,
  color
}: {
  fen: string;
  legalMoves: string[];
  pgn: string;
  color: 'white' | 'black';
}): string {
  return `You are playing competitive chess as ${color.toUpperCase()} in a rated arena match.

Current position (FEN): ${fen}
Move history: ${pgn || 'Game just started'}
Legal moves available (UCI format, ${legalMoves.length} total): ${legalMoves.join(', ')}

STRICT RULES:
1. Your "move" MUST be exactly one of the legal moves listed above. This is critical.
2. Use UCI format only — "e2e4" not "e4". Promotions: "e7e8q".
3. Respond ONLY with valid JSON. No text before or after it.
4. If unsure, pick the first move from the legal list.
5. Include a 1-2 sentence strategic explanation.

Response format (ONLY this JSON, nothing else):
{"move": "e2e4", "reasoning": "Occupies the center and opens lines for development"}`;
}

export function buildRetryPrompt({
  fen,
  legalMoves,
  pgn,
  color,
  badMove
}: {
  fen: string;
  legalMoves: string[];
  pgn: string;
  color: 'white' | 'black';
  badMove: string;
}): string {
  return `ERROR - Your previous suggestion "${badMove}" is NOT in the chess rule-legal moves list. This is your ONLY retry.

Position (FEN): ${fen}
Game history: ${pgn || 'Start'}
ONLY these moves are legal — choose exactly one: ${legalMoves.join(', ')}

You MUST pick one. Respond ONLY with JSON:
{"move": "<exactly one from the list>", "reasoning": "why you're moving there"}`;
}
