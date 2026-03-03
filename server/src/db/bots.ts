import { supabase } from './client';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export interface Bot {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  model: string;
  endpoint_type: string;
  endpoint_url: string;
  elo: number;
}

export async function createBot(input: {
  ownerId: string;
  name: string;
  model: string;
  endpointUrl: string;
  endpointType: string;
}): Promise<Bot> {
  const slug = input.name.toLowerCase().replace(/\s+/g, '-');

  const { data, error } = await supabase
    .from('bots')
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      slug,
      model: input.model,
      endpoint_url: input.endpointUrl,
      endpoint_type: input.endpointType
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create bot: ${error?.message}`);
  }

  return data as Bot;
}

export async function createBotToken(botId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(token, 10);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('bot_tokens')
    .insert({
      bot_id: botId,
      token_hash: hash,
      expires_at: expiresAt
    });

  if (error) {
    throw new Error(`Failed to create bot token: ${error.message}`);
  }

  return token;
}

export async function getBotBySlug(slug: string): Promise<Bot | null> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return data as Bot;
}
