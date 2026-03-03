/**
 * Leaderboard routes - ranking and statistics
 */

import { Router } from 'express';
import { supabase } from '../db/client';

export const leaderboardRoutes = Router();

/**
 * GET /api/leaderboard - Get top bots by Elo
 */
leaderboardRoutes.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const { data, error } = await supabase
      .from('bots')
      .select('id, name, slug, model, elo_rating, is_active')
      .eq('is_active', true)
      .order('elo_rating', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Leaderboard] Error:', error);
      return res.status(500).json({ error: error.message });
    }

    const formattedData = data?.map(bot => ({
      ...bot,
      elo: bot.elo_rating
    })) || [];

    res.json({
      bots: formattedData,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Leaderboard] Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/leaderboard/stats - Get aggregate statistics
 */
leaderboardRoutes.get('/stats', async (req, res) => {
  try {
    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('id')
      .eq('is_active', true);

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id');

    if (botsError || matchesError) {
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    res.json({
      totalBots: (bots || []).length,
      totalMatches: (matches || []).length,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default leaderboardRoutes;
