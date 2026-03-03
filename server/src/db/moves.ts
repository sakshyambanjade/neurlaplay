/**
 * Database helpers for moves table
 */

import { supabase, isDatabaseAvailable } from './client';
import { MoveRecord } from '../types';

/**
 * Save a move to the database
 */
export async function saveMove(matchId: string, move: MoveRecord): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    console.log('[DB] Skipping saveMove - database not available');
    return false;
  }

  try {
    const { error } = await supabase!
      .from('moves')
      .insert({
        match_id: matchId,
        move_number: move.moveNumber,
        player_color: move.playerColor,
        uci: move.uci,
        san: move.san,
        fen_before: move.fenBefore,
        fen_after: move.fenAfter,
        reasoning: move.reasoning,
        time_taken_ms: move.timeTakenMs,
        sf_eval_before: move.sfEvalBefore,
        sf_eval_after: move.sfEvalAfter,
        sf_best_move: move.sfBestMove,
        cp_loss: move.cpLoss,
        quality: move.quality
      });

    if (error) {
      console.error('[DB] Error saving move:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[DB] Exception saving move:', err);
    return false;
  }
}

/**
 * Get all moves for a match
 */
export async function getMovesForMatch(matchId: string): Promise<MoveRecord[]> {
  if (!isDatabaseAvailable()) {
    return [];
  }

  try {
    const { data, error } = await supabase!
      .from('moves')
      .select('*')
      .eq('match_id', matchId)
      .order('move_number', { ascending: true });

    if (error) {
      console.error('[DB] Error getting moves:', error);
      return [];
    }

    return data as MoveRecord[];
  } catch (err) {
    console.error('[DB] Exception getting moves:', err);
    return [];
  }
}
