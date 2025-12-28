-- Create table for tracking Netherite challenges
CREATE TABLE IF NOT EXISTS netherite_challenges (
  id SERIAL PRIMARY KEY,
  referrer_address VARCHAR(100) NOT NULL,
  challenge_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  challenge_expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  bonus_claimed BOOLEAN DEFAULT false,
  referred_user_address VARCHAR(100),
  referred_purchase_time TIMESTAMP,
  bonus_awarded BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_netherite_challenges_referrer ON netherite_challenges(referrer_address, is_active);
CREATE INDEX IF NOT EXISTS idx_netherite_challenges_expires ON netherite_challenges(challenge_expires_at, is_active);

-- Add columns to referral_visits to track Netherite challenge
ALTER TABLE referral_visits 
ADD COLUMN IF NOT EXISTS netherite_challenge_id INTEGER REFERENCES netherite_challenges(id),
ADD COLUMN IF NOT EXISTS purchased_netherite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS netherite_purchase_time TIMESTAMP;

-- Add column to users to track if they've accepted challenge
ALTER TABLE users
ADD COLUMN IF NOT EXISTS netherite_challenge_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS netherite_challenge_shown BOOLEAN DEFAULT false;
