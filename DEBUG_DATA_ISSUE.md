# 🔍 DEBUG: Why Data Not Showing

## Quick Debug Steps:

### Step 1: Check Console Messages
1. Open browser developer tools (F12)
2. Go to Console tab
3. Connect your wallet
4. Look for these messages:

**GOOD SIGNS:**
```
✅ Wallet connected: abc12345...
📊 Refreshing status for: abc12345...
📈 Raw server data: {gold: 123, inventory: {silver: 2}}
📊 Checkpoint data: {total_mining_power: 2}
🔄 Forcing display update with loaded data...
```

**BAD SIGNS:**
```
❌ Status refresh failed: [error]
❌ Database error for abc12345...
⚠️ No mining power found on refresh
```

### Step 2: Test Database Connection
Visit this URL (replace with your wallet address):
```
https://your-app.vercel.app/api/debug-user?address=YOUR_WALLET_ADDRESS
```

### Step 3: Test Status API
Visit this URL:
```
https://your-app.vercel.app/api/status?address=YOUR_WALLET_ADDRESS
```

## Common Issues:

1. **Wrong Wallet** - Using different wallet than before
2. **Database Error** - Connection issues
3. **Cache Problem** - Stale data
4. **API Failure** - Status endpoint not working
5. **UI Update Issue** - Data loads but doesn't display

## Need Help?

Share your:
1. Console messages
2. Wallet address (first 8 characters)
3. Debug API response