// server/src/routes/leaderboard.ts
import { Router } from 'express';
import { supabase } from '../db/client';

export const leaderboardRoutes = Router();

// GET /api/leaderboard
leaderboardRoutes.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('bots')
      .select('name, slug, elo, games_played, wins, losses, draws')
      .eq('is_public', true)
      .order('elo', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ bots: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default leaderboardRoutes;
