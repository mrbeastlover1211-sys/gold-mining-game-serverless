# 🎁 REFERRAL SYSTEM DATA FLOW & COMPLETION DETECTION

## 📊 **DATABASE TABLES & STRUCTURE**

### **1. `referral_visits` Table** (Session Tracking)
```sql
CREATE TABLE referral_visits (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) UNIQUE NOT NULL,           -- Unique session identifier
  referrer_address VARCHAR(100) NOT NULL,          -- Who gets the reward
  visitor_ip VARCHAR(50),                          -- Visitor tracking
  user_agent TEXT,                                 -- Browser info
  visit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  converted BOOLEAN DEFAULT false,                 -- Did visitor connect wallet?
  converted_address VARCHAR(100),                  -- Which wallet connected?
  converted_timestamp TIMESTAMP,                   -- When wallet connected?
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '48 hours',
  completion_checked BOOLEAN DEFAULT false,        -- Has completion been checked?
  reward_completed BOOLEAN DEFAULT false           -- Has reward been given?
);
```

### **2. `referrals` Table** (Reward Tracking)
```sql
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_address VARCHAR(100) NOT NULL,          -- Who gets the reward
  referee_address VARCHAR(100) UNIQUE NOT NULL,    -- Who was referred (unique!)
  reward_given BOOLEAN DEFAULT false,              -- Has reward been given?
  gold_rewarded DECIMAL(20,8) DEFAULT 100,        -- How much gold given
  pickaxe_rewarded VARCHAR(20) DEFAULT 'silver',   -- Which pickaxe given
  completion_trigger VARCHAR(50),                  -- What triggered completion
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **3. `users` Table** (User Progress)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  address VARCHAR(44) UNIQUE NOT NULL,
  gold DECIMAL(20,8) DEFAULT 0,
  has_land BOOLEAN DEFAULT false,                  -- REQUIREMENT 1
  inventory JSONB DEFAULT '{"silver":0,"gold":0,"diamond":0,"netherite":0}', -- REQUIREMENT 2
  total_referrals INTEGER DEFAULT 0,               -- Referrer's total count
  referral_gold_earned DECIMAL(20,8) DEFAULT 0,    -- Referrer's total earnings
  last_update BIGINT DEFAULT extract(epoch from now())
);
```

---

## 🔄 **COMPLETE DATA FLOW**

### **PHASE 1: REFERRAL LINK CREATION & CLICK**

#### **Step 1: User Clicks Referral Link**
```
URL: https://your-game.com/?ref=REFERRER_WALLET_ADDRESS
```

#### **Step 2: Session Creation (`api/track-referral.js`)**
```javascript
// When user visits with ?ref= parameter
const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36);

// INSERT into referral_visits
INSERT INTO referral_visits (
  session_id,           // "session_1703123456_abc123"
  referrer_address,     // "67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C"
  visitor_ip,           // "192.168.1.100"
  user_agent,           // "Mozilla/5.0..."
  visit_timestamp,      // "2024-12-20 10:30:00"
  expires_at            // "2024-12-22 10:30:00" (48 hours)
) VALUES (...);

// Set browser cookie
Set-Cookie: referral_session=session_1703123456_abc123; Max-Age=172800
```

**Database State After Step 2:**
```
referral_visits:
session_id: session_1703123456_abc123
referrer_address: 67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C
converted: false
converted_address: null
```

---

### **PHASE 2: WALLET CONNECTION & SESSION LINKING**

#### **Step 3: User Connects Wallet (`api/check-referral-session.js`)**
```javascript
// Frontend calls when wallet connects
await checkReferralSession();

// Backend checks cookie and links to wallet
const sessionId = extractFromCookie('referral_session');
const walletAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

// UPDATE referral_visits - link session to wallet
UPDATE referral_visits 
SET 
  converted = true,
  converted_address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  converted_timestamp = CURRENT_TIMESTAMP
WHERE session_id = 'session_1703123456_abc123';
```

**Database State After Step 3:**
```
referral_visits:
session_id: session_1703123456_abc123
referrer_address: 67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C
converted: true ✅
converted_address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM ✅
converted_timestamp: 2024-12-20 10:35:00 ✅

users:
address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
has_land: false ❌
inventory: {"silver":0,"gold":0,"diamond":0,"netherite":0} ❌
```

---

### **PHASE 3: REQUIREMENT FULFILLMENT**

#### **Step 4: User Buys Land (`api/confirm-land-purchase.js`)**
```javascript
// After successful land purchase
UPDATE users 
SET 
  has_land = true,
  last_update = extract(epoch from now())
WHERE address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
```

**Database State After Step 4:**
```
users:
address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
has_land: true ✅
inventory: {"silver":0,"gold":0,"diamond":0,"netherite":0} ❌
```

#### **Step 5: User Buys Pickaxe (`api/purchase-confirm.js`)**
```javascript
// After successful pickaxe purchase
UPDATE users 
SET 
  inventory = jsonb_set(inventory, '{silver}', '1'),
  last_update = extract(epoch from now())
WHERE address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

// 🎯 CRITICAL: After each purchase, trigger referral completion check
// This is where the magic happens!
```

**Database State After Step 5:**
```
users:
address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
has_land: true ✅
inventory: {"silver":1,"gold":0,"diamond":0,"netherite":0} ✅
```

---

### **PHASE 4: COMPLETION DETECTION & REWARD DISTRIBUTION**

#### **Step 6: Automatic Completion Check (`api/referral-system-complete.js`)**

**🎯 WHEN IT TRIGGERS:**
```javascript
// In main.js - after EVERY successful purchase
try {
  const referralComplete = await fetch('/api/referral-system-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      address: state.address,  // Referee's address
      force: false,
      trigger: 'purchase_completed'
    })
  });
  // ... handle response
} catch (error) {
  console.log('Referral completion check failed:', error);
}
```

**🔍 HOW IT DETECTS COMPLETION:**
```sql
-- 1. Find referral session for this user
SELECT rv.*, u.gold as referrer_gold, u.inventory as referrer_inventory
FROM referral_visits rv
LEFT JOIN users u ON u.address = rv.referrer_address
WHERE rv.converted_address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  AND rv.converted = true
  AND rv.expires_at > CURRENT_TIMESTAMP;

-- 2. Check referee's requirements
SELECT 
  has_land,
  inventory,
  (COALESCE((inventory->>'silver')::int, 0) + 
   COALESCE((inventory->>'gold')::int, 0) + 
   COALESCE((inventory->>'diamond')::int, 0) + 
   COALESCE((inventory->>'netherite')::int, 0)) as total_pickaxes
FROM users 
WHERE address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

-- 3. Check if already rewarded
SELECT * FROM referrals 
WHERE referee_address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
  AND reward_given = true;
```

**✅ COMPLETION LOGIC:**
```javascript
const requirementsMet = userData.has_land && userData.total_pickaxes > 0;
const notAlreadyRewarded = existingReward.rows.length === 0 || !existingReward.rows[0].reward_given;
const sessionExists = sessionCheck.rows.length > 0;

if (requirementsMet && notAlreadyRewarded && sessionExists) {
  // 🎉 COMPLETE THE REFERRAL!
}
```

#### **Step 7: Reward Distribution (Transaction)**
```sql
BEGIN;

-- Give rewards to referrer
UPDATE users 
SET 
  gold = gold + 100,
  inventory = jsonb_set(inventory, '{silver}', 
    ((COALESCE((inventory->>'silver')::int, 0)) + 1)::text::jsonb),
  total_referrals = total_referrals + 1,
  referral_gold_earned = referral_gold_earned + 100
WHERE address = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';

-- Record the referral completion
INSERT INTO referrals (
  referrer_address, 
  referee_address, 
  reward_given, 
  gold_rewarded,
  pickaxe_rewarded,
  completion_trigger
) VALUES (
  '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  true,
  100,
  'silver',
  'purchase_completed'
);

-- Mark session as completed
UPDATE referral_visits
SET 
  completion_checked = true,
  reward_completed = true,
  reward_timestamp = CURRENT_TIMESTAMP
WHERE session_id = 'session_1703123456_abc123';

COMMIT;
```

**Final Database State:**
```
referrals:
referrer_address: 67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C
referee_address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
reward_given: true ✅
gold_rewarded: 100
pickaxe_rewarded: silver

users (referrer):
address: 67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C
gold: 1000 + 100 = 1100 ✅
inventory: {"silver": 5 + 1 = 6, ...} ✅
total_referrals: 0 + 1 = 1 ✅
referral_gold_earned: 0 + 100 = 100 ✅

referral_visits:
completion_checked: true ✅
reward_completed: true ✅
reward_timestamp: 2024-12-20 11:00:00 ✅
```

---

## 🚨 **POTENTIAL FAILURE POINTS**

### **1. Session Not Created**
- User didn't click referral link properly
- Cookie blocked/deleted
- `track-referral.js` failed

### **2. Session Not Linked**
- `checkReferralSession()` not called on wallet connect
- `check-referral-session.js` failed
- Cookie not found

### **3. Requirements Not Met**
- `has_land = false` in database
- `inventory` shows 0 pickaxes
- User data not updated after purchases

### **4. Completion Not Triggered**
- Frontend doesn't call referral completion API after purchases
- API call fails silently
- `referral-system-complete.js` has bugs

### **5. Already Rewarded**
- Duplicate completion attempts
- Race conditions in concurrent requests

---

## ✅ **HOW TO VERIFY EACH STEP**

### **Check Session Creation:**
```sql
SELECT * FROM referral_visits 
WHERE referrer_address = 'REFERRER_ADDRESS'
ORDER BY visit_timestamp DESC;
```

### **Check Session Linking:**
```sql
SELECT * FROM referral_visits 
WHERE converted_address = 'REFEREE_ADDRESS' AND converted = true;
```

### **Check Requirements:**
```sql
SELECT address, has_land, inventory 
FROM users 
WHERE address = 'REFEREE_ADDRESS';
```

### **Check Completion:**
```sql
SELECT * FROM referrals 
WHERE referrer_address = 'REFERRER_ADDRESS' 
  AND referee_address = 'REFEREE_ADDRESS';
```

### **Check Final State:**
```sql
SELECT address, gold, inventory, total_referrals, referral_gold_earned 
FROM users 
WHERE address = 'REFERRER_ADDRESS';
```

This is the complete flow! The key is that completion is checked **after every purchase** and requires **both** land ownership and pickaxe ownership to trigger the reward.