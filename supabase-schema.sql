-- Gold Mining Game Database Schema
-- Run this in Supabase SQL Editor

-- Users table (main player data)
CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Land ownership
  has_land BOOLEAN DEFAULT FALSE,
  land_purchase_date BIGINT,
  
  -- Pickaxe inventory
  silver_pickaxes INTEGER DEFAULT 0,
  gold_pickaxes INTEGER DEFAULT 0,
  diamond_pickaxes INTEGER DEFAULT 0,
  netherite_pickaxes INTEGER DEFAULT 0,
  
  -- Mining system
  total_mining_power INTEGER DEFAULT 0,
  checkpoint_timestamp BIGINT DEFAULT EXTRACT(epoch FROM NOW()),
  last_checkpoint_gold NUMERIC(20, 2) DEFAULT 0,
  
  -- Activity tracking
  last_activity BIGINT DEFAULT EXTRACT(epoch FROM NOW()),
  
  -- Constraints
  CONSTRAINT valid_pickaxes CHECK (
    silver_pickaxes >= 0 AND 
    gold_pickaxes >= 0 AND 
    diamond_pickaxes >= 0 AND 
    netherite_pickaxes >= 0
  ),
  CONSTRAINT valid_mining_power CHECK (total_mining_power >= 0),
  CONSTRAINT valid_gold CHECK (last_checkpoint_gold >= 0)
);

-- Transactions table (audit trail)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_address TEXT REFERENCES users(address),
  transaction_type TEXT NOT NULL, -- 'land_purchase', 'pickaxe_purchase', 'gold_sale'
  item_type TEXT, -- 'silver', 'gold', 'diamond', 'netherite', 'land'
  quantity INTEGER DEFAULT 1,
  sol_amount NUMERIC(20, 8),
  gold_amount NUMERIC(20, 2),
  signature TEXT,
  status TEXT DEFAULT 'confirmed' -- 'pending', 'confirmed', 'failed'
);

-- Referrals table (future feature)
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  referrer_address TEXT REFERENCES users(address),
  referred_address TEXT REFERENCES users(address) UNIQUE,
  rewards_claimed BOOLEAN DEFAULT FALSE,
  CONSTRAINT no_self_referral CHECK (referrer_address != referred_address)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);
CREATE INDEX IF NOT EXISTS idx_users_has_land ON users(has_land);
CREATE INDEX IF NOT EXISTS idx_users_mining_power ON users(total_mining_power);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

-- Views for analytics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN has_land = true THEN 1 END) as land_owners,
  SUM(silver_pickaxes + gold_pickaxes + diamond_pickaxes + netherite_pickaxes) as total_pickaxes,
  SUM(total_mining_power) as total_mining_power,
  AVG(last_checkpoint_gold) as avg_gold
FROM users;

CREATE OR REPLACE VIEW active_miners AS
SELECT 
  address,
  silver_pickaxes,
  gold_pickaxes, 
  diamond_pickaxes,
  netherite_pickaxes,
  total_mining_power,
  last_checkpoint_gold,
  last_activity,
  created_at
FROM users 
WHERE total_mining_power > 0 
  AND last_activity > EXTRACT(epoch FROM NOW() - INTERVAL '7 days')
ORDER BY total_mining_power DESC;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data (optional - for testing)
-- INSERT INTO users (address, has_land, silver_pickaxes, total_mining_power, checkpoint_timestamp, last_checkpoint_gold) 
-- VALUES ('SAMPLE123...', true, 2, 120, EXTRACT(epoch FROM NOW()), 1000.50);

COMMENT ON TABLE users IS 'Main player data including land ownership and pickaxe inventory';
COMMENT ON TABLE transactions IS 'Audit trail of all game transactions';
COMMENT ON TABLE referrals IS 'Player referral relationships';