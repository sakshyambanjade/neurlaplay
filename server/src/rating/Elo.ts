/**
 * Elo rating system for LLMArena
 * Standard chess Elo calculation
 */

import { config } from '../config';

const K_FACTOR = config.ELO_K_FACTOR;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloResult {
  white: number;
  black: number;
  whiteChange: number;
  blackChange: number;
}

export function newRatings(
  whiteElo: number,
  blackElo: number,
  result: '1-0' | '0-1' | '1/2-1/2'
): EloResult {
  const expectedWhite = expectedScore(whiteElo, blackElo);
  const expectedBlack = expectedScore(blackElo, whiteElo);

  const actualWhite = result === '1-0' ? 1 : result === '1/2-1/2' ? 0.5 : 0;
  const actualBlack = 1 - actualWhite;

  const whiteChange = Math.round(K_FACTOR * (actualWhite - expectedWhite));
  const blackChange = Math.round(K_FACTOR * (actualBlack - expectedBlack));

  return {
    white: whiteElo + whiteChange,
    black: blackElo + blackChange,
    whiteChange,
    blackChange
  };
}
