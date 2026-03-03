/**
 * Database helpers for bot creation and token management
 */

import { supabase } from './client';
import { randomBytes } from 'crypto';
import crypto from 'crypto';

export interface CreateBotInput {
  ownerId: string;
  name: string;
  model: string;
  provider?: string;
  description?: string;
}

/**
 * Create a new bot
 */
export async function createBot(input: CreateBotInput) {
  const slug = input.name.toLowerCase().replace(/\s+/g, '-');

  const { data, error } = await supabase
    .from('bots')
    .insert({
      user_id: input.ownerId,
      name: input.name,
      slug,
      model: input.model,
      provider: input.provider || 'openai',
      description: input.description || '',
      elo_rating: 1500,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a bot token (plaintext + hash for storage)
 */
export async function createBotToken(botId: string, name: string = 'default') {
  // Generate a secure random token
  const plainToken = randomBytes(32).toString('hex');
  
  // Create a hash for storage (using sha256 for simplicity; bcrypt is overkill for API tokens)
  const tokenHash = crypto
    .createHash('sha256')
    .update(plainToken)
    .digest('hex');

  // Store in database
  const { error } = await supabase
    .from('bot_tokens')
    .insert({
      bot_id: botId,
      token_hash: tokenHash,
      name,
      last_used_at: null
    });

  if (error) throw error;

  // Return the plaintext token (only shown once to the user)
  return plainToken;
}

/**
 * Get bot by slug
 */
export async function getBotBySlug(slug: string) {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Verify a bot token (for authentication)
 */
export async function verifyBotToken(token: string): Promise<string | null> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const { data, error } = await supabase
    .from('bot_tokens')
    .select('bot_id')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !data) return null;

  return data.bot_id;
}

/**
 * Get bot stats for leaderboard/profile
 */
export async function getBotStats(botId: string) {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('result, white_bot_id, black_bot_id')
    .or(`white_bot_id.eq.${botId},black_bot_id.eq.${botId}`);

  if (error) throw error;

  let wins = 0;
  let losses = 0;
  let draws = 0;

  if (matches) {
    for (const match of matches) {
      if (match.result === '1/2-1/2') {
        draws++;
      } else if (
        (match.result === '1-0' && match.white_bot_id === botId) ||
        (match.result === '0-1' && match.black_bot_id === botId)
      ) {
        wins++;
      } else {
        losses++;
      }
    }
  }

  return {
    gamesPlayed: wins + losses + draws,
    wins,
    losses,
    draws,
    winRate: wins + losses + draws > 0 ? (wins / (wins + losses + draws) * 100).toFixed(1) : '0.0'
  };
}
