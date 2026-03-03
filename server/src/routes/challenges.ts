// server/src/routes/challenges.ts
import { Router } from 'express';
import { supabase } from '../db/client';
import {
  createChallenge,
  updateChallengeStatus,
  Challenge
} from '../db/challenges';

const router = Router();

// TODO: replace with real auth; for now pass bot IDs directly

// POST /api/challenges
// body: { challengerBotId, challengedBotId }
router.post('/', async (req, res) => {
  const { challengerBotId, challengedBotId } = req.body;
  if (!challengerBotId || !challengedBotId) {
    return res.status(400).json({ error: 'Missing bot IDs' });
  }

  const challenge = await createChallenge(challengerBotId, challengedBotId);
  if (!challenge) {
    return res.status(500).json({ error: 'Failed to create challenge' });
  }
  res.json({ challenge });
});

// POST /api/challenges/:id/accept
router.post('/:id/accept', async (req, res) => {
  const ok = await updateChallengeStatus(req.params.id, 'accepted');
  if (!ok) return res.status(500).json({ error: 'Failed to accept challenge' });
  res.json({ status: 'accepted' });
});

// POST /api/challenges/:id/decline
router.post('/:id/decline', async (req, res) => {
  const ok = await updateChallengeStatus(req.params.id, 'declined');
  if (!ok) return res.status(500).json({ error: 'Failed to decline challenge' });
  res.json({ status: 'declined' });
});

// GET /api/challenges/:botId  -> list challenges for a bot
router.get('/:botId', async (req, res) => {
  const botId = req.params.botId;
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .or(
      `challenger_bot_id.eq.${botId},challenged_bot_id.eq.${botId}`
    )
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ challenges: (data || []) as Challenge[] });
});

export default router;
