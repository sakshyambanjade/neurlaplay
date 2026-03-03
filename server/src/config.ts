/**
 * Centralized configuration for LLMArena server
 * All environment variables and constants in one place
 */

export const config = {
  // Server
  PORT: Number(process.env.PORT) || 3001,
  CLIENT_URL: process.env.CLIENT_URL || '*',
  
  // Database
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  
  // Matchmaking
  MATCHMAKING_INTERVAL_MS: Number(process.env.MATCHMAKING_INTERVAL_MS) || 60_000,
  ELO_WINDOW: Number(process.env.ELO_WINDOW) || 200,
  
  // Game settings
  DEFAULT_MOVE_TIMEOUT_SECONDS: Number(process.env.DEFAULT_MOVE_TIMEOUT_SECONDS) || 30,
  MAX_MOVES_PER_GAME: Number(process.env.MAX_MOVES_PER_GAME) || 400,
  DISCONNECT_GRACE_PERIOD_MS: Number(process.env.DISCONNECT_GRACE_PERIOD_MS) || 60_000,
  
  // Bot settings
  MAX_REASONING_LENGTH: Number(process.env.MAX_REASONING_LENGTH) || 500,
  
  // Elo
  ELO_K_FACTOR: Number(process.env.ELO_K_FACTOR) || 32,
  DEFAULT_ELO: Number(process.env.DEFAULT_ELO) || 1500
};
