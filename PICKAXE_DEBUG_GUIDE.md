# 🐛 PICKAXE INVENTORY DEBUG GUIDE

## **Problem:** Pickaxes not updating after purchase

Your issue: After buying multiple pickaxes, the inventory and mining operation don't update properly in the UI.

---

## **Step 1: Check Database Storage**

### **Test the debug endpoint:**
```
GET https://your-app.vercel.app/api/debug-user?address=YOUR_WALLET_ADDRESS
```

**What to look for:**
```json
{
  "database_data": {
    "raw_inventory": {
      "silver": 4,    // Should show your actual pickaxe count
      "gold": 0,
      "diamond": 0, 
      "netherite": 0
    },
    "total_mining_power": 4,  // Should match your pickaxes × rates
    "checkpoint_timestamp": 1234567890,
    "last_checkpoint_gold": 100.50
  },
  "calculated_data": {
    "total_pickaxes": 4,      // Total count
    "calculated_mining_power": 4  // 4 silver × 1 = 4 power
  },
  "debug_checks": {
    "mining_power_matches": true  // Should be TRUE
  }
}
```

---

## **Step 2: Identify the Issue**

### **Scenario A: Database is CORRECT**
If debug shows pickaxes stored properly:
- ✅ Database has: `"silver": 4, "total_mining_power": 4`
- ❌ Frontend shows: `0 pickaxes, 0 mining rate`
- **Issue**: Frontend not updating from server data

### **Scenario B: Database is WRONG**
If debug shows missing pickaxes:
- ❌ Database has: `"silver": 0` (but you bought 4)
- **Issue**: Purchase confirmation not saving to database

### **Scenario C: Cache Issue**
If debug shows old data:
- ❌ Database shows old count even after recent purchase
- **Issue**: Caching system not invalidating properly

---

## **Step 3: Test Purchase Flow**

### **Buy 1 pickaxe and watch console:**
1. Open browser developer tools (F12)
2. Go to Console tab
3. Buy 1 silver pickaxe
4. Look for these messages:

**Expected Success Messages:**
```
🔄 Processing purchase response: {inventory: {silver: 1}, checkpoint: {...}}
✅ Updated state inventory: {silver: 1, gold: 0, diamond: 0, netherite: 0}
📊 Updated checkpoint after purchase: {total_mining_power: 1}
💾 Immediately saved user [address]...
```

**Problem Indicators:**
```
❌ Immediate save failed for [address]: [error message]
📝 Queued user [address]... for batch update  // Should be immediate, not batched
⚠️ No mining power after purchase, something went wrong
```

---

## **Step 4: Check Status Endpoint**

### **Test status after purchase:**
```
GET https://your-app.vercel.app/api/status?address=YOUR_WALLET_ADDRESS
```

**Expected Response:**
```json
{
  "inventory": {"silver": 4, "gold": 0, "diamond": 0, "netherite": 0},
  "totalRate": 4,
  "checkpoint": {
    "total_mining_power": 4,
    "checkpoint_timestamp": 1234567890,
    "last_checkpoint_gold": 100.50
  }
}
```

---

## **Step 5: Common Issues & Fixes**

### **Issue 1: Batch Update Delay**
**Symptom**: Pickaxes save 5-10 seconds after purchase
**Cause**: Using `saveUser()` instead of `saveUserImmediate()`
**Fix**: Purchase confirmation should use immediate save

### **Issue 2: Cache Not Invalidating**
**Symptom**: Old data persists for 30 seconds
**Cause**: Cache not updating after purchase
**Fix**: Clear cache on successful purchase

### **Issue 3: Frontend Not Refreshing**
**Symptom**: Database correct, UI wrong
**Cause**: Frontend state not updating
**Fix**: Force UI refresh after purchase

### **Issue 4: Database Connection Error**
**Symptom**: Purchases fail silently
**Cause**: Database connection issues
**Fix**: Check error logs in Vercel

---

## **Step 6: Quick Test Commands**

### **Test 1: Buy and immediately check**
```bash
# Buy pickaxe, then immediately:
curl "https://your-app.vercel.app/api/debug-user?address=YOUR_ADDRESS"
```

### **Test 2: Check if batch is pending**
```bash
# Wait 10 seconds after purchase, then:
curl "https://your-app.vercel.app/api/debug-user?address=YOUR_ADDRESS"
```

### **Test 3: Force cache miss**
```bash
# Wait 35 seconds (cache expires), then:
curl "https://your-app.vercel.app/api/status?address=YOUR_ADDRESS"
```

---

## **Expected Behavior:**

1. **Buy Pickaxe** → Transaction confirms
2. **Server Updates** → Inventory saved to database IMMEDIATELY
3. **Cache Updates** → New data cached for fast access
4. **Frontend Updates** → UI shows new pickaxe count
5. **Mining Starts** → Gold starts accumulating

**Timeline:** Should complete in 2-3 seconds, not 5-10 seconds.

---

## **Next Steps:**

1. **Run the debug endpoint** with your wallet address
2. **Check what the database actually contains**
3. **Share the debug output** so I can identify the exact issue
4. **Test purchase flow** with browser console open

The debug endpoint will tell us exactly what's happening!