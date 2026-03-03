/**
 * Database helpers for matches table
 */

import { supabase, isDatabaseAvailable } from './client';
import { GameResult, Termination, PlayerColor } from '../types';

export interface CreateMatchParams {
  id: string;
  game_type: string;
  white_bot_id: string;
  black_bot_id: string;
  white_elo_before: number;
  black_elo_before: number;
  move_timeout_seconds: number;
}

export interface FinalizeMatchParams {
  id: string;
  result: GameResult;
  termination: Termination;
  winner_bot_id: string | null;
  white_elo_after: number;
  black_elo_after: number;
  final_fen: string;
  pgn: string;
  total_moves: number;
}

/**
 * Create a new match record in the database
 */
export async function createMatch(params: CreateMatchParams): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    console.log('[DB] Skipping createMatch - database not available');
    return false;
  }

  try {
    const { error } = await supabase!
      .from('matches')
      .insert({
        id: params.id,
        game_type: params.game_type,
        white_bot_id: params.white_bot_id,
        black_bot_id: params.black_bot_id,
        white_elo_before: params.white_elo_before,
        black_elo_before: params.black_elo_before,
        move_timeout_seconds: params.move_timeout_seconds,
        status: 'in_progress',
        started_at: new Date().toISOString()
      });

    if (error) {
      console.error('[DB] Error creating match:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[DB] Exception creating match:', err);
    return false;
  }
}

/**
 * Finalize a match with the result
 */
export async function finalizeMatch(params: FinalizeMatchParams): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    console.log('[DB] Skipping finalizeMatch - database not available');
    return false;
  }

  try {
    const { error } = await supabase!
      .from('matches')
      .update({
        status: 'completed',
        result: params.result,
        termination: params.termination,
        winner_bot_id: params.winner_bot_id,
        white_elo_after: params.white_elo_after,
        black_elo_after: params.black_elo_after,
        final_fen: params.final_fen,
        pgn: params.pgn,
        total_moves: params.total_moves,
        ended_at: new Date().toISOString()
      })
      .eq('id', params.id);

    if (error) {
      console.error('[DB] Error finalizing match:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[DB] Exception finalizing match:', err);
    return false;
  }
}

/**
 * Get a match by ID
 */
export async function getMatchById(matchId: string): Promise<any | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    const { data, error } = await supabase!
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) {
      console.error('[DB] Error getting match:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[DB] Exception getting match:', err);
    return null;
  }
}

/**
 * Get bot's current Elo rating
 */
export async function getBotElo(botId: string): Promise<number> {
  if (!isDatabaseAvailable()) {
    return 1500; // Default Elo
  }

  try {
    const { data, error } = await supabase!
      .from('bots')
      .select('current_elo')
      .eq('id', botId)
      .single();

    if (error || !data) {
      console.warn(`[DB] Could not get Elo for bot ${botId}, using default`);
      return 1500;
    }

    return data.current_elo || 1500;
  } catch (err) {
    console.error('[DB] Exception getting bot Elo:', err);
    return 1500;
  }
}

/**
 * Update bot's Elo rating
 */
export async function updateBotElo(botId: string, newElo: number, change: number): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    console.log('[DB] Skipping updateBotElo - database not available');
    return false;
  }

  try {
    // Update bot's current Elo
    const { error: updateError } = await supabase!
      .from('bots')
      .update({ current_elo: newElo })
      .eq('id', botId);

    if (updateError) {
      console.error('[DB] Error updating bot Elo:', updateError);
      return false;
    }

    // Record Elo history
    const { error: historyError } = await supabase!
      .from('elo_history')
      .insert({
        bot_id: botId,
        elo: newElo,
        change: change
      });

    if (historyError) {
      console.error('[DB] Error recording Elo history:', historyError);
      // Don't fail the whole operation if history fails
    }

    return true;
  } catch (err) {
    console.error('[DB] Exception updating bot Elo:', err);
    return false;
  }
}
