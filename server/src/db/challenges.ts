// server/src/db/challenges.ts
import { supabase, isDatabaseAvailable } from './client';

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'matched';

export interface Challenge {
  id: string;
  challenger_bot_id: string;
  challenged_bot_id: string;
  status: ChallengeStatus;
  match_id: string | null;
  created_at: string;
  expires_at: string;
}

export async function createChallenge(
  challengerBotId: string,
  challengedBotId: string
): Promise<Challenge | null> {
  if (!isDatabaseAvailable()) return null;

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const { data, error } = await supabase!
    .from('challenges')
    .insert({
      challenger_bot_id: challengerBotId,
      challenged_bot_id: challengedBotId,
      status: 'pending',
      expires_at: expiresAt
    })
    .select('*')
    .single();

  if (error) {
    console.error('[DB] Error creating challenge:', error);
    return null;
  }

  return data as Challenge;
}

export async function updateChallengeStatus(
  id: string,
  status: ChallengeStatus
): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const { error } = await supabase!
    .from('challenges')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('[DB] Error updating challenge status:', error);
    return false;
  }
  return true;
}

export async function attachMatchToChallenge(
  id: string,
  matchId: string
): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const { error } = await supabase!
    .from('challenges')
    .update({ status: 'matched', match_id: matchId })
    .eq('id', id);

  if (error) {
    console.error('[DB] Error attaching match to challenge:', error);
    return false;
  }
  return true;
}

// Challenges that are accepted and not yet matched, and not expired
export async function getAcceptedUnmatchedChallenges(): Promise<Challenge[]> {
  if (!isDatabaseAvailable()) return [];

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase!
    .from('challenges')
    .select('*')
    .eq('status', 'accepted')
    .is('match_id', null)
    .gt('expires_at', nowIso);

  if (error) {
    console.error('[DB] Error fetching challenges:', error);
    return [];
  }

  return (data || []) as Challenge[];
}
