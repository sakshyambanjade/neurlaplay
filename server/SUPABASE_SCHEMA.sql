-- LLMArena Database Schema for Supabase
-- Copy and paste this entire SQL into your Supabase SQL Editor and execute

-- 1. Users table (account owners)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Bots table (LLM bot profiles)
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  model VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  description TEXT,
  elo_rating INT DEFAULT 1600,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  last_played_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Bot tokens (JWT auth for bot runners - bcrypt hashed)
CREATE TABLE IF NOT EXISTS bot_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- 4. Matches table (completed games)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_bot_id UUID NOT NULL REFERENCES bots(id),
  black_bot_id UUID NOT NULL REFERENCES bots(id),
  white_elo_before INT NOT NULL,
  white_elo_after INT NOT NULL,
  black_elo_before INT NOT NULL,
  black_elo_after INT NOT NULL,
  result VARCHAR(20) NOT NULL,
  termination_reason VARCHAR(100),
  total_moves INT DEFAULT 0,
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Moves table (individual move records)
CREATE TABLE IF NOT EXISTS moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  move_number INT NOT NULL,
  color VARCHAR(10) NOT NULL,
  uci VARCHAR(10) NOT NULL,
  san VARCHAR(10),
  fen_before VARCHAR(100) NOT NULL,
  fen_after VARCHAR(100) NOT NULL,
  reasoning TEXT,
  stockfish_eval FLOAT,
  quality VARCHAR(20),
  time_spent_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Challenges table (bot-to-bot challenges queue)
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES bots(id),
  challenged_id UUID NOT NULL REFERENCES bots(id),
  status VARCHAR(20) DEFAULT 'pending',
  color_preference VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- 7. Elo history table (rating progression tracking)
CREATE TABLE IF NOT EXISTS elo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id),
  elo_before INT NOT NULL,
  elo_after INT NOT NULL,
  change INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_elo ON bots(elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_tokens_bot_id ON bot_tokens(bot_id);
CREATE INDEX IF NOT EXISTS idx_matches_white_bot ON matches(white_bot_id);
CREATE INDEX IF NOT EXISTS idx_matches_black_bot ON matches(black_bot_id);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moves_match_id ON moves(match_id);
CREATE INDEX IF NOT EXISTS idx_moves_color ON moves(color);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_elo_history_bot_id ON elo_history(bot_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_created ON elo_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own bot tokens
CREATE POLICY "Users can only manage their own bot tokens" ON bot_tokens
  FOR ALL USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Bots are publicly visible
CREATE POLICY "Bots are publicly viewable" ON bots
  FOR SELECT USING (TRUE);

-- RLS Policy: Users can only update their own bots
CREATE POLICY "Users can only update their own bots" ON bots
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policy: Users can insert bots for themselves
CREATE POLICY "Users can insert their own bots" ON bots
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policy: All matches are viewable
CREATE POLICY "Matches are publicly viewable" ON matches
  FOR SELECT USING (TRUE);

-- RLS Policy: All moves are viewable
CREATE POLICY "Moves are publicly viewable" ON moves
  FOR SELECT USING (TRUE);

-- RLS Policy: All challenges are viewable
CREATE POLICY "Challenges are publicly viewable" ON challenges
  FOR SELECT USING (TRUE);

-- RLS Policy: All Elo history is viewable
CREATE POLICY "Elo history is publicly viewable" ON elo_history
  FOR SELECT USING (TRUE);
