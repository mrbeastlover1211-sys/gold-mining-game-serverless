# 🗄️ Supabase Database Setup Guide

## 📋 **Step-by-Step Setup:**

### **1. Create Supabase Project**
1. Go to: https://app.supabase.com/
2. Click **"New Project"**
3. Settings:
   - **Name:** `gold-mining-game`
   - **Database Password:** Create strong password (SAVE IT!)
   - **Region:** Choose closest to your users
   - **Plan:** Free tier

### **2. Run Database Schema**
1. **Go to:** SQL Editor (left sidebar)
2. **Click:** "New query"
3. **Copy & paste** the entire content of `supabase-schema.sql`
4. **Click:** "Run" button
5. **Verify:** Tables created successfully

### **3. Get Database URL**
1. **Go to:** Settings → Database
2. **Copy connection string** under "Connection string"
3. **Should look like:**
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
   ```

### **4. Update Vercel Environment**
1. **Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables
2. **Update DATABASE_URL** with new connection string
3. **Click:** "Save"
4. **Redeploy** your project

### **5. Test Connection**
After deployment, test:
```
https://your-app.vercel.app/api/test
```
Should show: `"database_connected": true`

## 🎯 **Expected Schema:**

### **Users Table:**
- `address` (PRIMARY KEY) - Wallet address
- `has_land` - Land ownership status
- `silver_pickaxes`, `gold_pickaxes`, etc. - Pickaxe counts
- `total_mining_power` - Mining rate per minute
- `checkpoint_timestamp`, `last_checkpoint_gold` - Mining checkpoints

### **Transactions Table:**
- Audit trail of all purchases
- Links to user addresses
- Tracks SOL amounts and signatures

### **Performance Features:**
- Indexes on key columns
- Views for analytics
- Auto-updating timestamps
- Data validation constraints

## 🚀 **After Setup:**
1. **Database will handle 100K+ users**
2. **Data persists permanently**
3. **Full audit trail of transactions**
4. **Analytics and user statistics**
5. **Referral system ready**