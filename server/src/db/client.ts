import { createClient } from '@supabase/supabase-js';

const hasEnv = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY;

export const supabase = hasEnv
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  : null;

export function isDatabaseAvailable(): boolean {
  return !!supabase;
}
