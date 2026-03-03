// server/src/routes/leaderboard.ts
import { Router } from 'express';
import { supabase } from '../db/client';
import { isDatabaseAvailable } from '../db/client';

export const leaderboardRoutes = Router();

// GET /api/leaderboard
leaderboardRoutes.get('/', async (_req, res) => {
  try {
    if (!isDatabaseAvailable() || !supabase) {
      return res.json({ bots: [] }); // Return empty leaderboard in offline mode
    }

    const { data, error } = await supabase
      .from('bots')
      .select('name, slug, elo, games_played, wins, losses, draws')
      .eq('is_public', true)
      .order('elo', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ bots: data || [] });
  } catch (err: any) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default leaderboardRoutes;
