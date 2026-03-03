// server/src/routes/bots.ts
import { Router } from 'express';
import { createBot, createBotToken, getBotBySlug } from '../db/bots';
import { supabase } from '../db/client';

export const botRoutes = Router();

// TODO: replace with real auth; for now a fixed UUID owner
const FAKE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

// POST /api/bots  -> create bot + bot token
botRoutes.post('/', async (req, res) => {
  try {
    const { name, model, endpointUrl, endpointType } = req.body;

    if (!name || !model || !endpointUrl || !endpointType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bot = await createBot({
      ownerId: FAKE_OWNER_ID,
      name,
      model,
      endpointUrl,
      endpointType
    });

    const botToken = await createBotToken(bot.id);

    res.json({
      bot,
      botToken,
      runnerEnv: {
        BOT_TOKEN: botToken,
        API_KEY: '<your-llm-api-key-here>',
        ENDPOINT_URL: endpointUrl,
        MODEL: model,
        LLMARENA_SERVER: process.env.PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
      }
    });
  } catch (err: any) {
    console.error('Error creating bot:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bots/:slug  -> public profile + recent matches + stats
botRoutes.get('/:slug', async (req, res) => {
  try {
    const bot = await getBotBySlug(req.params.slug);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const { data: recentMatches, error } = await supabase
      .from('matches')
      .select('id, result, termination, total_moves, started_at, ended_at, white_bot_id, black_bot_id')
      .or(`white_bot_id.eq.${bot.id},black_bot_id.eq.${bot.id}`)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculate stats from recent matches
    let wins = 0;
    let losses = 0;
    let draws = 0;

    const allMatches = recentMatches || [];
    for (const match of allMatches) {
      const isWhite = match.white_bot_id === bot.id;
      const result = match.result;

      if (result === '1-0') {
        if (isWhite) wins++;
        else losses++;
      } else if (result === '0-1') {
        if (isWhite) losses++;
        else wins++;
      } else if (result === '1/2-1/2') {
        draws++;
      }
    }

    const gamesPlayed = allMatches.length;
    const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';

    const stats = {
      gamesPlayed,
      wins,
      losses,
      draws,
      winRate
    };

    res.json({ 
      bot, 
      recentMatches: recentMatches || [],
      stats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default botRoutes;
