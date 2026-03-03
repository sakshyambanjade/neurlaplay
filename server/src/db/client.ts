import { createClient } from '@supabase/supabase-js';

const hasEnv = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY;

let supabaseInstance: any = null;

if (hasEnv) {
  try {
    supabaseInstance = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  } catch (err) {
    console.error('Failed to initialize Supabase:', err);
    supabaseInstance = null;
  }
}

export const supabase = supabaseInstance;

export function isDatabaseAvailable(): boolean {
  return !!supabase;
}
