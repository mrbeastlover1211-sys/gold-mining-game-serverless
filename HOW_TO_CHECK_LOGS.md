# 📊 HOW TO CHECK VERCEL LOGS - Step by Step

## 🎯 Quick Guide

### **Step 1: Open Vercel Dashboard**
1. Go to: https://vercel.com/jaspals-team/gold-mining-game-serverless
2. Login if needed

### **Step 2: View Function Logs**
1. Click on "Deployments" tab
2. Click on the latest deployment (top one)
3. Click on "Functions" tab
4. You'll see a list of all API functions

### **Step 3: Test Your Referral**
1. Open your game: https://www.thegoldmining.com
2. Copy your referral link
3. Open incognito window
4. Click referral link
5. Buy land
6. Buy a pickaxe

### **Step 4: Check Logs in Real-Time**
1. Go back to Vercel dashboard
2. Click "Functions" → "Logs" (or refresh the page)
3. Look for these functions:
   - `api/confirm-land-purchase.js`
   - `api/buy-with-gold.js`
   - `api/complete-referral.js`

### **Step 5: Look for These Messages**

**When you buy land, look for:**
```
🍪 Checking for referral bonus...
  Session ID: [SHOULD SEE A VALUE HERE]
  Address: [YOUR ADDRESS]
  Current gold before bonus: 0
  
🔍 Referral check by session cookie:
  Found: [YES or NO]
  Referrer: [REFERRER ADDRESS]
```

**When you buy pickaxe, look for:**
```
🎁 ========================================
🎁 REFERRAL COMPLETION ENDPOINT CALLED
🎁 ========================================
👤 User address: [YOUR ADDRESS]
🍪 Raw cookie header: [SHOULD SEE referral_session=...]
🍪 Parsed session ID: [SHOULD SEE A VALUE]
```

---

## 🎯 WHAT TO REPORT BACK

After testing, tell me:

1. **For land purchase:**
   - Did you see "Session ID: NONE" or an actual session ID?
   - Did you see "Found: YES" or "Found: NO"?
   - Did you see "Gave 1000 gold bonus" message?

2. **For pickaxe purchase:**
   - Did you see "REFERRAL COMPLETION ENDPOINT CALLED"?
   - Did you see "Raw cookie header" with actual content?
   - Did you see "Parsed session ID" with a value?

3. **In the game:**
   - Did you receive 1000 gold when buying land?
   - Did your main account receive a pickaxe after new user bought one?

---

## 📸 EVEN BETTER

If possible, take screenshots of:
- The Vercel logs for `confirm-land-purchase`
- The Vercel logs for `complete-referral`
- Your game UI showing gold amount

This will help me see exactly what's happening!

---

## ⏱️ TIMING

Wait ~2 minutes for deployment to complete, then test.

The logs will show in real-time in Vercel dashboard.
