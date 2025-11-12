# 🗄️ Complete Database Setup Guide - Step by Step

## 🚀 **Phase 1: Create Fresh Supabase Project**

### **Step 1: Clean Slate**
1. **Go to:** https://app.supabase.com/
2. **Sign in** with your account
3. **Delete old projects** if any (to avoid confusion)
4. **Click "New Project"**

### **Step 2: Project Configuration**
- **Organization:** Choose your organization
- **Name:** `gold-mining-production`
- **Database Password:** `GoldMining2024!` (copy this exactly)
- **Region:** `US East (N. Virginia)` (recommended for stability)
- **Plan:** Free tier

### **Step 3: Wait for Initialization**
- **Wait 5-10 minutes** for project to be fully ready
- **Status should show "Active"** before proceeding

---

## 🗄️ **Phase 2: Database Schema Creation**

### **Step 1: Open SQL Editor**
1. **In your Supabase project** → Click **"SQL Editor"** (left sidebar)
2. **Click "New Query"**
3. **Delete any existing content**

### **Step 2: Create Complete Schema**
**Copy and paste this ENTIRE script:**

```sql
-- =====================================================
-- GOLD MINING GAME DATABASE SCHEMA
-- =====================================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with all required columns
CREATE TABLE users (
    address TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Land ownership
    has_land BOOLEAN DEFAULT FALSE NOT NULL,
    land_purchase_date BIGINT,
    
    -- Pickaxe inventory (individual columns for clarity)
    silver_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (silver_pickaxes >= 0),
    gold_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (gold_pickaxes >= 0),
    diamond_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (diamond_pickaxes >= 0),
    netherite_pickaxes INTEGER DEFAULT 0 NOT NULL CHECK (netherite_pickaxes >= 0),
    
    -- Mining system
    total_mining_power INTEGER DEFAULT 0 NOT NULL CHECK (total_mining_power >= 0),
    checkpoint_timestamp BIGINT DEFAULT EXTRACT(epoch FROM NOW()) NOT NULL,
    last_checkpoint_gold NUMERIC(20, 2) DEFAULT 0 NOT NULL CHECK (last_checkpoint_gold >= 0),
    
    -- Activity tracking
    last_activity BIGINT DEFAULT EXTRACT(epoch FROM NOW()) NOT NULL
);

-- Create transactions table for audit trail
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('land_purchase', 'pickaxe_purchase', 'gold_sale')),
    item_type TEXT CHECK (item_type IN ('silver', 'gold', 'diamond', 'netherite', 'land')),
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    sol_amount NUMERIC(20, 8),
    gold_amount NUMERIC(20, 2),
    signature TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed'))
);

-- Create referrals table for future features
CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    referrer_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
    referred_address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE UNIQUE,
    rewards_claimed BOOLEAN DEFAULT FALSE,
    CONSTRAINT no_self_referral CHECK (referrer_address != referred_address)
);

-- Create performance indexes
CREATE INDEX idx_users_last_activity ON users(last_activity);
CREATE INDEX idx_users_has_land ON users(has_land) WHERE has_land = true;
CREATE INDEX idx_users_mining_power ON users(total_mining_power) WHERE total_mining_power > 0;
CREATE INDEX idx_transactions_user ON transactions(user_address);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_address);

-- Create views for analytics
CREATE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN has_land = true THEN 1 END) as land_owners,
    SUM(silver_pickaxes + gold_pickaxes + diamond_pickaxes + netherite_pickaxes) as total_pickaxes,
    SUM(total_mining_power) as total_mining_power,
    AVG(last_checkpoint_gold) as avg_gold
FROM users;

CREATE VIEW active_miners AS
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

-- Create trigger for automatic updated_at
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

-- Insert test data to verify everything works
INSERT INTO users (
    address, 
    has_land, 
    silver_pickaxes, 
    total_mining_power, 
    checkpoint_timestamp, 
    last_checkpoint_gold
) VALUES (
    'TEST_WALLET_123', 
    true, 
    2, 
    120, 
    EXTRACT(epoch FROM NOW()), 
    1000.50
);

-- Verify the setup
SELECT 'Schema created successfully!' as status;
SELECT * FROM user_stats;
SELECT * FROM users WHERE address = 'TEST_WALLET_123';

-- Clean up test data
DELETE FROM users WHERE address = 'TEST_WALLET_123';

-- Final verification
SELECT 'Database setup complete!' as final_status;
```

### **Step 3: Execute Schema**
1. **Click "Run"** button
2. **Wait for completion** (should see "Success" and no errors)
3. **Verify** you see tables in the left sidebar: users, transactions, referrals

---

## 🔗 **Phase 3: Connection Setup**

### **Step 1: Get Connection String**
1. **In Supabase** → **Settings** → **Database**
2. **Find "Connection string"** section
3. **Copy the EXACT string** (should look like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
   ```
4. **Replace `[YOUR-PASSWORD]`** with: `GoldMining2024!`

### **Step 2: Update Vercel Environment**
1. **Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables
2. **Edit DATABASE_URL**
3. **Paste the complete connection string** (with password replaced)
4. **Should look like:**
   ```
   postgresql://postgres:GoldMining2024!@db.[PROJECT-ID].supabase.co:5432/postgres
   ```
5. **Save and redeploy**

---

## 🧪 **Phase 4: Testing & Verification**

### **Test 1: Basic Connection**
After deployment:
```
https://your-app.vercel.app/api/test
```
**Expected:** `"database_connected": true, "total_users": 0`

### **Test 2: Create Test User**
In Supabase SQL Editor:
```sql
INSERT INTO users (address, has_land, silver_pickaxes, total_mining_power) 
VALUES ('TEST123', true, 1, 60);

SELECT * FROM users WHERE address = 'TEST123';
```

### **Test 3: Game Functionality**
1. **Connect wallet** to your game
2. **Buy land** → Should save to database
3. **Buy pickaxes** → Should update inventory
4. **Refresh page** → Data should persist

### **Test 4: Database Verification**
In Supabase:
```sql
-- See all users
SELECT address, has_land, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes FROM users;

-- Check transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

-- View stats
SELECT * FROM user_stats;
```

---

## 🚨 **Troubleshooting**

### **If Connection Fails:**
1. **Check project status** → Must be "Active"
2. **Verify password** → Exactly `GoldMining2024!`
3. **Check connection string** → No typos in URL
4. **Wait longer** → New projects can take 15 minutes

### **If Schema Fails:**
1. **Run sections separately** → One table at a time
2. **Check error messages** → Fix syntax issues
3. **Start fresh** → Drop all tables and retry

### **If Game Doesn't Work:**
1. **Check `/api/test`** → Database connection first
2. **Check Vercel logs** → Function errors
3. **Verify environment variable** → Correct DATABASE_URL

---

## ✅ **Success Checklist**

- [ ] Supabase project created and active
- [ ] Complete schema executed successfully  
- [ ] Tables visible in Supabase dashboard
- [ ] Test data insert/select works
- [ ] DATABASE_URL updated in Vercel
- [ ] `/api/test` shows database_connected: true
- [ ] Game can save land purchases
- [ ] Pickaxe inventory persists after refresh
- [ ] Mining calculations work correctly

---

**Follow this guide step by step and your database will work perfectly!** 🎯