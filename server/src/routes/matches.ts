/**
 * Match routes for viewing match data
 */

import { Router } from 'express';
import { supabase, isDatabaseAvailable } from '../db/client';
import { registry } from '../game/MatchRegistry';

const router = Router();

/**
 * GET /api/matches/active - Get all active matches
 */
router.get('/active', async (req, res) => {
  const activeMatches = registry.getAll()
    .filter(m => m.status === 'in_progress')
    .map(room => ({
      matchId: room.matchId,
      status: room.status,
      whiteBotName: room.white?.botName,
      blackBotName: room.black?.botName,
      moveCount: room.moves.length,
      startedAt: room.startedAt
    }));

  res.json({ matches: activeMatches });
});

/**
 * GET /api/matches/:matchId - Get match details
 */
router.get('/:matchId', async (req, res) => {
  // Check if match is in memory (active)
  const room = registry.get(req.params.matchId);

  if (room) {
    const state = room.getState();
    const summary = room.getSummary();

    return res.json({
      matchId: room.matchId,
      status: room.status,
      gameState: state,
      summary
    });
  }

  // Otherwise check database for completed matches
  if (!isDatabaseAvailable()) {
    return res.status(404).json({ error: 'Match not found' });
  }

  try {
    const { data: match, error } = await supabase!
      .from('matches')
      .select('*')
      .eq('id', req.params.matchId)
      .single();

    if (error || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Get moves
    const { data: moves } = await supabase!
      .from('moves')
      .select('*')
      .eq('match_id', req.params.matchId)
      .order('move_number', { ascending: true });

    res.json({
      matchId: match.id,
      status: match.status,
      match,
      moves: moves || []
    });
  } catch (err: any) {
    console.error('[API] Exception getting match:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
