/**
 * Bot registration and management routes
 */

import { Router } from 'express';
import { createBot, createBotToken, getBotBySlug, getBotStats } from '../db/bots';

export const botRoutes = Router();

// For now, use a fake owner ID (would be replaced with real auth)
const FAKE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * POST /api/bots - Register a new bot
 */
botRoutes.post('/', async (req, res) => {
  try {
    const { name, model, provider, description } = req.body;

    if (!name || !model) {
      return res.status(400).json({ error: 'Missing required fields: name, model' });
    }

    // Create the bot
    const bot = await createBot({
      ownerId: FAKE_OWNER_ID,
      name,
      model,
      provider: provider || 'openai',
      description: description || ''
    });

    // Generate a token for the bot
    const botToken = await createBotToken(bot.id, 'initial_token');

    // Return bot info and a ready-to-use .env example
    res.json({
      success: true,
      bot: {
        id: bot.id,
        name: bot.name,
        slug: bot.slug,
        model: bot.model,
        elo: bot.elo_rating
      },
      botToken,
      envExample: `# Add to bot-runner/.env
BOT_TOKEN=${botToken}
API_KEY=your_llm_api_key_here
MODEL=${model}
PROVIDER=${provider || 'openai'}
LLMARENA_SERVER=${process.env.LLMARENA_SERVER || 'http://localhost:3001'}`,
      message: 'Bot registered! Save the botToken - it will not be shown again.'
    });

    console.log(`[API] Bot registered: ${name} (${bot.id})`);
  } catch (err: any) {
    console.error('[API] Error creating bot:', err);
    res.status(500).json({ error: err.message || 'Failed to create bot' });
  }
});

/**
 * GET /api/bots/:slug - Get bot profile with stats
 */
botRoutes.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const bot = await getBotBySlug(slug);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get recent matches
    const { data: recentMatches } = await (
      await import('../db/client')
    ).supabase
      .from('matches')
      .select('id, result, white_bot_id, black_bot_id')
      .or(`white_bot_id.eq.${bot.id},black_bot_id.eq.${bot.id}`)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get stats
    const stats = await getBotStats(bot.id);

    res.json({
      bot: {
        id: bot.id,
        name: bot.name,
        slug: bot.slug,
        model: bot.model,
        elo: bot.elo_rating,
        isActive: bot.is_active,
        createdAt: bot.created_at
      },
      stats,
      recentMatches: recentMatches || []
    });
  } catch (err: any) {
    console.error('[API] Error getting bot:', err);
    res.status(500).json({ error: err.message || 'Failed to get bot' });
  }
});

export default botRoutes;
