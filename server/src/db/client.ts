/**
 * Supabase client for database operations
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Validate required environment variables
if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Database operations will be disabled.');
}

export const supabase = config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
  : null;

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return supabase !== null;
}
