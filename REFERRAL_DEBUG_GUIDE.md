# 🔍 REFERRAL SYSTEM DEBUG - Your Specific Issue

## 🎯 **YOUR SCENARIO:**
1. ✅ Sign up (main account)
2. ✅ Refer someone (created referral link)  
3. ✅ Second account used referral link
4. ✅ Second account bought land
5. ✅ Second account bought pickaxe
6. ❌ **Main account didn't get referral reward**

## 🕵️ **DEBUG STEPS:**

### **Step 1: Use the Testing Tool**
Visit: https://gold-mining-serverless-43phdtnl7-james-projects-c1b8b251.vercel.app/test-referral-system.html

### **Step 2: Test Your Specific Scenario**
Enter your actual wallet addresses:
- **Referrer Address**: Your main account wallet address
- **Referee Address**: The second account that bought land + pickaxe

### **Step 3: Run All 4 Tests**
1. **Manual Referral Test** - Test your exact scenario
2. **Database State** - See if the referral session was created
3. **Old API Test** - Check if completion API works
4. **New System Test** - Test our improved system

## 🔍 **LIKELY ISSUES:**

### **Issue 1: Referral Session Not Created**
- **Problem**: Referral link didn't create session in database
- **Check**: Database State test will show if sessions exist
- **Fix**: Need to ensure `track-referral.js` is working

### **Issue 2: Session Not Linked to Wallet**
- **Problem**: Session created but not linked when wallet connects
- **Check**: Database will show `converted = false`
- **Fix**: Need to ensure `check-referral-session.js` runs

### **Issue 3: Requirements Not Detected**
- **Problem**: System doesn't see land + pickaxe ownership
- **Check**: Manual test will show user requirements status
- **Fix**: Database query for `has_land` and `inventory`

### **Issue 4: Completion API Not Triggered**
- **Problem**: Frontend doesn't call completion API after purchases
- **Check**: Browser console logs during purchases
- **Fix**: Ensure referral completion runs after land/pickaxe purchase

### **Issue 5: API Endpoint Wrong**
- **Problem**: Calling wrong API or wrong method
- **Check**: Compare old vs new API test results
- **Fix**: Update frontend to use correct endpoint

## 🎯 **EXPECTED TEST RESULTS:**

### **If Working Correctly:**
```
Manual Test: ✅ Referral completed, rewards given
Database: Shows converted session + completion record
Old API: Returns success with reward details
New API: Returns success with reward details
```

### **If Broken (Your Current State):**
```
Manual Test: ❌ Requirements not met or no session found
Database: Missing sessions or unconverted sessions
Old API: Error or "no referral found"
New API: Error or requirements not met
```

## 🔧 **QUICK FIXES:**

### **Fix 1: Force Complete Your Referral**
Use the Manual Test to force complete your specific referral

### **Fix 2: Check Browser Console**
Open developer tools → Console during land/pickaxe purchase to see errors

### **Fix 3: Verify Referral Link Format**
Ensure your referral link was: `https://your-game.com/?ref=YOUR_WALLET_ADDRESS`

### **Fix 4: Check Timing**
Make sure you bought both land AND pickaxe after using referral link

## 📋 **NEXT STEPS:**

1. **Run the testing tool** with your exact wallet addresses
2. **Share the results** - tell me what each test shows
3. **Based on results**, I'll fix the specific broken component
4. **Test again** to verify the fix works
5. **Deploy the fix** so future referrals work

**Let's debug this step by step! Run the testing tool and tell me what results you get for each test.** 🔍🎁