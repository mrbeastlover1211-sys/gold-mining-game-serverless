-- =====================================================
-- GOLD MINING GAME - COMPLETE DATABASE SCHEMA
-- Run this in your Neon SQL Editor
-- =====================================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS referral_rewards CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table (main player data)
CREATE TABLE users (
    address TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Land ownership
    has_land BOOLEAN DEFAULT FALSE NOT NULL,
    land_purchase_date BIGINT,
    land_type TEXT DEFAULT 'basic' CHECK (land_type IN ('basic', 'premium', 'legendary')),
    
    -- Pickaxe inventory
    silver_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (silver_pickaxes >= 0),
    gold_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (gold_pickaxes >= 0),
    diamond_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (diamond_pickaxes >= 0),
    netherite_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (netherite_pickaxes >= 0),
    
    -- Mining system
    total_mining_power INTEGER DEFAULT 0 NOT NULL CHECK (total_mining_power >= 0),
    checkpoint_timestamp BIGINT DEFAULT EXTRACT(epoch FROM NOW()) NOT NULL,
    last_checkpoint_gold NUMERIC(20, 4) DEFAULT 0 NOT NULL CHECK (last_checkpoint_gold >= 0),
    total_gold_mined NUMERIC(20, 4) DEFAULT 0 NOT NULL CHECK (total_gold_mined >= 0),
    
    -- Player statistics
    total_sol_spent NUMERIC(20, 8) DEFAULT 0 NOT NULL CHECK (total_sol_spent >= 0),
    total_sol_earned NUMERIC(20, 8) DEFAULT 0 NOT NULL CHECK (total_sol_earned >= 0),
    total_pickaxes_bought INTEGER DEFAULT 0 NOT NULL CHECK (total_pickaxes_bought >= 0),
    play_time_minutes INTEGER DEFAULT 0 NOT NULL CHECK (play_time_minutes >= 0),
    
    -- Activity tracking
    last_activity BIGINT DEFAULT EXTRACT(epoch FROM NOW()) NOT NULL,
    login_streak INTEGER DEFAULT 0 NOT NULL CHECK (login_streak >= 0),
    last_login_date DATE DEFAULT CURRENT_DATE,
    total_logins INTEGER DEFAULT 0 NOT NULL,
    
    -- Player level system
    player_level INTEGER DEFAULT 1 NOT NULL CHECK (player_level >= 1 AND player_level <= 100),
    experience_points INTEGER DEFAULT 0 NOT NULL CHECK (experience_points >= 0),
    
    -- Referral system
    referred_by TEXT REFERENCES users(address),
    referral_code TEXT UNIQUE,
    total_referrals INTEGER DEFAULT 0 NOT NULL CHECK (total_referrals >= 0),
    
    -- Settings
    auto_sell_enabled BOOLEAN DEFAULT FALSE,
    auto_sell_threshold NUMERIC(20, 4) DEFAULT 100000,
    notification_enabled BOOLEAN DEFAULT TRUE,
    
    -- Premium features
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP,
    
    -- Anti-cheat
    suspicious_activity_count INTEGER DEFAULT 0 NOT NULL CHECK (suspicious_activity_count >= 0),
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires_at TIMESTAMP
);

-- User sessions (track active sessions)
CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    session_start TIMESTAMP DEFAULT NOW(),
    session_end TIMESTAMP,
    duration_minutes INTEGER,
    gold_mined_session NUMERIC(20, 4) DEFAULT 0,
    pickaxes_bought_session INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table (comprehensive audit trail)
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- User info
    user_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('land_purchase', 'pickaxe_purchase', 'gold_sale', 'referral_reward', 'level_bonus', 'achievement_reward')),
    item_type TEXT CHECK (item_type IN ('silver', 'gold', 'diamond', 'netherite', 'land', 'premium')),
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    
    -- Financial data
    sol_amount NUMERIC(20, 8),
    gold_amount NUMERIC(20, 4),
    price_per_unit NUMERIC(20, 8),
    
    -- Blockchain data
    signature TEXT,
    block_hash TEXT,
    slot_number BIGINT,
    
    -- Status and validation
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    validation_score INTEGER DEFAULT 100 CHECK (validation_score >= 0 AND validation_score <= 100),
    
    -- Additional context
    source TEXT DEFAULT 'game' CHECK (source IN ('game', 'admin', 'referral', 'bonus')),
    notes TEXT
);

-- Referrals table (referral system)
CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    referrer_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    referred_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE UNIQUE,
    
    -- Referral tracking
    referral_code_used TEXT,
    registration_date TIMESTAMP DEFAULT NOW(),
    first_purchase_date TIMESTAMP,
    
    -- Reward tracking
    rewards_earned NUMERIC(20, 8) DEFAULT 0,
    total_referred_purchases NUMERIC(20, 8) DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT no_self_referral CHECK (referrer_address != referred_address)
);

-- Referral rewards (detailed reward history)
CREATE TABLE referral_rewards (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    referral_id BIGINT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    triggered_by_transaction BIGINT REFERENCES transactions(id),
    
    reward_type TEXT NOT NULL CHECK (reward_type IN ('signup', 'first_purchase', 'milestone', 'percentage')),
    reward_amount NUMERIC(20, 8) NOT NULL,
    reward_currency TEXT DEFAULT 'SOL' CHECK (reward_currency IN ('SOL', 'GOLD')),
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMP,
    payment_signature TEXT
);

-- Achievements system
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('mining', 'purchasing', 'social', 'time', 'special')),
    
    -- Requirements
    requirement_type TEXT NOT NULL CHECK (requirement_type IN ('total_gold', 'total_pickaxes', 'mining_power', 'referrals', 'login_streak', 'play_time')),
    requirement_value INTEGER NOT NULL,
    
    -- Rewards
    reward_gold NUMERIC(20, 4) DEFAULT 0,
    reward_sol NUMERIC(20, 8) DEFAULT 0,
    reward_experience INTEGER DEFAULT 0,
    reward_title TEXT,
    
    -- Display
    icon_url TEXT,
    difficulty TEXT DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard', 'legendary')),
    is_hidden BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- User achievements (tracking what users have earned)
CREATE TABLE user_achievements (
    id BIGSERIAL PRIMARY KEY,
    user_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT NOW(),
    progress_value INTEGER NOT NULL,
    rewards_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP,
    
    UNIQUE(user_address, achievement_id)
);

-- Leaderboard (for competition features)
CREATE TABLE leaderboard (
    id BIGSERIAL PRIMARY KEY,
    user_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    
    -- Leaderboard categories
    category TEXT NOT NULL CHECK (category IN ('total_gold', 'mining_power', 'total_spent', 'referrals', 'play_time')),
    score NUMERIC(20, 4) NOT NULL,
    rank_position INTEGER,
    
    -- Time periods
    period_type TEXT NOT NULL CHECK (period_type IN ('all_time', 'monthly', 'weekly', 'daily')),
    period_start DATE NOT NULL,
    period_end DATE,
    
    last_updated TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_address, category, period_type, period_start)
);

-- Game events (special events and bonuses)
CREATE TABLE game_events (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('double_mining', 'discount_pickaxes', 'bonus_gold', 'special_achievement')),
    
    -- Event timing
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    
    -- Event parameters
    multiplier NUMERIC(5, 2) DEFAULT 1.0,
    discount_percentage INTEGER DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    bonus_amount NUMERIC(20, 4) DEFAULT 0,
    
    -- Targeting
    target_users TEXT DEFAULT 'all' CHECK (target_users IN ('all', 'new', 'premium', 'active')),
    min_level INTEGER DEFAULT 1,
    
    is_active BOOLEAN DEFAULT TRUE
);

-- Admin logs (for administrative actions)
CREATE TABLE admin_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    
    admin_address TEXT NOT NULL,
    action TEXT NOT NULL,
    target_user TEXT REFERENCES users(address),
    
    -- Action details
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    
    -- Context
    ip_address INET,
    user_agent TEXT
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users table indexes
CREATE INDEX idx_users_last_activity ON users(last_activity);
CREATE INDEX idx_users_has_land ON users(has_land) WHERE has_land = true;
CREATE INDEX idx_users_mining_power ON users(total_mining_power) WHERE total_mining_power > 0;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_player_level ON users(player_level);
CREATE INDEX idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_users_premium ON users(is_premium) WHERE is_premium = true;

-- Transactions table indexes
CREATE INDEX idx_transactions_user ON transactions(user_address);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_signature ON transactions(signature) WHERE signature IS NOT NULL;

-- User sessions indexes
CREATE INDEX idx_sessions_user ON user_sessions(user_address);
CREATE INDEX idx_sessions_start ON user_sessions(session_start);
CREATE INDEX idx_sessions_duration ON user_sessions(duration_minutes) WHERE duration_minutes IS NOT NULL;

-- Referrals indexes
CREATE INDEX idx_referrals_referrer ON referrals(referrer_address);
CREATE INDEX idx_referrals_referred ON referrals(referred_address);
CREATE INDEX idx_referrals_active ON referrals(is_active) WHERE is_active = true;

-- Achievements indexes
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_active ON achievements(is_active) WHERE is_active = true;
CREATE INDEX idx_user_achievements_user ON user_achievements(user_address);
CREATE INDEX idx_user_achievements_earned ON user_achievements(earned_at);

-- Leaderboard indexes
CREATE INDEX idx_leaderboard_category ON leaderboard(category);
CREATE INDEX idx_leaderboard_period ON leaderboard(period_type, period_start);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank_position);
CREATE UNIQUE INDEX idx_leaderboard_unique ON leaderboard(user_address, category, period_type, period_start);

-- Game events indexes
CREATE INDEX idx_events_active ON game_events(is_active, start_time, end_time) WHERE is_active = true;
CREATE INDEX idx_events_type ON game_events(event_type);

-- =====================================================
-- VIEWS FOR ANALYTICS AND REPORTING
-- =====================================================

-- User statistics view
CREATE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN has_land = true THEN 1 END) as land_owners,
    COUNT(CASE WHEN is_premium = true THEN 1 END) as premium_users,
    SUM(silver_pickaxes + gold_pickaxes + diamond_pickaxes + netherite_pickaxes) as total_pickaxes,
    SUM(total_mining_power) as total_mining_power,
    AVG(last_checkpoint_gold) as avg_gold,
    AVG(player_level) as avg_level,
    COUNT(CASE WHEN last_activity > EXTRACT(epoch FROM NOW() - INTERVAL '24 hours') THEN 1 END) as active_24h,
    COUNT(CASE WHEN last_activity > EXTRACT(epoch FROM NOW() - INTERVAL '7 days') THEN 1 END) as active_7d
FROM users;

-- Active miners view
CREATE VIEW active_miners AS
SELECT 
    u.address,
    u.silver_pickaxes,
    u.gold_pickaxes, 
    u.diamond_pickaxes,
    u.netherite_pickaxes,
    u.total_mining_power,
    u.last_checkpoint_gold,
    u.player_level,
    u.total_gold_mined,
    u.last_activity,
    u.created_at,
    CASE 
        WHEN u.last_activity > EXTRACT(epoch FROM NOW() - INTERVAL '1 hour') THEN 'online'
        WHEN u.last_activity > EXTRACT(epoch FROM NOW() - INTERVAL '24 hours') THEN 'recent'
        ELSE 'inactive'
    END as status
FROM users u
WHERE u.total_mining_power > 0 
ORDER BY u.total_mining_power DESC;

-- Revenue analytics view
CREATE VIEW revenue_stats AS
SELECT 
    DATE(t.created_at) as date,
    COUNT(*) as total_transactions,
    SUM(t.sol_amount) as daily_revenue_sol,
    AVG(t.sol_amount) as avg_transaction_sol,
    COUNT(DISTINCT t.user_address) as unique_buyers,
    COUNT(CASE WHEN t.transaction_type = 'land_purchase' THEN 1 END) as land_sales,
    COUNT(CASE WHEN t.transaction_type = 'pickaxe_purchase' THEN 1 END) as pickaxe_sales
FROM transactions t
WHERE t.status = 'confirmed'
  AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(t.created_at)
ORDER BY date DESC;

-- Top referrers view
CREATE VIEW top_referrers AS
SELECT 
    r.referrer_address,
    COUNT(*) as total_referrals,
    SUM(rr.reward_amount) as total_rewards_earned,
    AVG(r.total_referred_purchases) as avg_referred_spending,
    MAX(r.created_at) as last_referral_date
FROM referrals r
LEFT JOIN referral_rewards rr ON r.id = rr.referral_id
WHERE r.is_active = true
GROUP BY r.referrer_address
HAVING COUNT(*) > 0
ORDER BY total_referrals DESC;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate referral codes
CREATE OR REPLACE FUNCTION generate_referral_code(user_addr TEXT)
RETURNS TEXT AS $$
DECLARE
    code TEXT;
BEGIN
    -- Generate a referral code based on address
    code := 'GM' || UPPER(SUBSTRING(MD5(user_addr || EXTRACT(epoch FROM NOW())), 1, 6));
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM users WHERE referral_code = code) LOOP
        code := 'GM' || UPPER(SUBSTRING(MD5(user_addr || EXTRACT(epoch FROM NOW()) || RANDOM()), 1, 6));
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate mining rewards
CREATE OR REPLACE FUNCTION calculate_mining_reward(
    mining_power INTEGER,
    last_checkpoint BIGINT,
    current_time BIGINT DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    time_diff BIGINT;
    reward NUMERIC;
BEGIN
    IF current_time IS NULL THEN
        current_time := EXTRACT(epoch FROM NOW());
    END IF;
    
    time_diff := current_time - last_checkpoint;
    
    -- Mining power is per minute, time_diff is in seconds
    reward := (mining_power::NUMERIC / 60.0) * time_diff;
    
    RETURN GREATEST(reward, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA (FOR TESTING)
-- =====================================================

-- Insert sample achievements
INSERT INTO achievements (name, description, category, requirement_type, requirement_value, reward_gold, reward_experience, difficulty) VALUES
('First Steps', 'Purchase your first pickaxe', 'purchasing', 'total_pickaxes', 1, 1000, 100, 'easy'),
('Land Owner', 'Purchase your first land', 'purchasing', 'total_pickaxes', 0, 5000, 200, 'easy'),
('Silver Miner', 'Mine 10,000 gold', 'mining', 'total_gold', 10000, 2000, 300, 'normal'),
('Gold Rush', 'Mine 100,000 gold', 'mining', 'total_gold', 100000, 10000, 500, 'normal'),
('Diamond Hands', 'Mine 1,000,000 gold', 'mining', 'total_gold', 1000000, 50000, 1000, 'hard'),
('Pickaxe Collector', 'Own 10 pickaxes total', 'purchasing', 'total_pickaxes', 10, 5000, 400, 'normal'),
('Social Butterfly', 'Refer 5 friends', 'social', 'referrals', 5, 25000, 600, 'normal'),
('Dedication', 'Login for 7 days straight', 'time', 'login_streak', 7, 15000, 500, 'normal'),
('Mining Legend', 'Reach 10,000 mining power', 'mining', 'mining_power', 10000, 100000, 2000, 'legendary');

-- Insert sample game event
INSERT INTO game_events (name, description, event_type, start_time, end_time, multiplier) VALUES
('Launch Week Bonus', 'Double mining rewards for the first week!', 'double_mining', NOW(), NOW() + INTERVAL '7 days', 2.0);

-- Create test user (you can delete this later)
INSERT INTO users (address, has_land, referral_code) 
VALUES ('TEST_USER_12345', true, generate_referral_code('TEST_USER_12345'));

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check sample data
SELECT 'Schema creation completed successfully!' as status;
SELECT COUNT(*) as achievement_count FROM achievements;
SELECT COUNT(*) as user_count FROM users;

-- Final success message
SELECT 'Gold Mining Game database schema is ready!' as result;