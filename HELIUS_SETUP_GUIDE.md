# 🚀 Helius RPC Setup Guide

## Why Use Helius?

The public Solana RPC endpoints are often rate-limited and unreliable. Helius provides:
- ✅ **Faster transaction verification** - Better uptime and response times
- ✅ **Higher rate limits** - 100+ requests/second on free tier
- ✅ **Better reliability** - No random 429 errors or timeouts
- ✅ **Free tier available** - Perfect for testing and small projects

## 📝 Step-by-Step Setup

### 1️⃣ Create Helius Account

1. Go to: https://www.helius.dev
2. Click **"Sign Up"** or **"Get Started"**
3. Sign up with your email or GitHub account
4. Verify your email

### 2️⃣ Get Your API Key

1. Log in to your Helius dashboard
2. Navigate to **"API Keys"** section
3. Click **"Create New API Key"**
4. Give it a name (e.g., "Gold Mining Game - Devnet")
5. Select **"Devnet"** as the network
6. Copy your API key (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3️⃣ Add to Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add/Update the variable:
   - **Key**: `SOLANA_CLUSTER_URL`
   - **Value**: `https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY_HERE`
   - **Environments**: ✅ Check all three (Production, Preview, Development)
4. Click **Save**

### 4️⃣ Redeploy Your App

After setting the environment variable, you MUST redeploy:

**Option A - Git Push:**
```bash
git commit --allow-empty -m "Update to Helius RPC"
git push origin main
```

**Option B - Vercel Dashboard:**
1. Go to **Deployments** tab
2. Click **⋯** on latest deployment
3. Click **Redeploy**

### 5️⃣ Verify It's Working

After deployment completes:

1. Visit: `https://your-domain.com/api/config`
2. Check the `clusterUrl` field
3. It should show your Helius URL with the API key

## 🎯 Example URLs

### Devnet (Testing):
```
https://devnet.helius-rpc.com/?api-key=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Mainnet (Production):
```
https://mainnet.helius-rpc.com/?api-key=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## ⚠️ Important Notes

1. **Keep your API key secret** - Don't commit it to git
2. **Use different keys** for devnet and mainnet
3. **Monitor your usage** in the Helius dashboard
4. **Free tier limits**:
   - 100 requests/second
   - 1M credits/month
   - Plenty for most games!

## 🔧 Troubleshooting

### Still getting rate limit errors?

**Check your usage:**
1. Log in to Helius dashboard
2. Check **Usage** tab
3. Make sure you haven't exceeded free tier

**Need more?**
- Upgrade to paid plan ($29/month for 10M credits)
- Or use multiple API keys for different features

### Transaction verification failing?

**Make sure:**
- API key is correct (no extra spaces)
- URL format is exactly: `https://devnet.helius-rpc.com/?api-key=YOUR_KEY`
- Environment variable is set for all environments
- You've redeployed after setting it

## 📊 What Gets Better?

After switching to Helius:
- ✅ Land purchases verify faster
- ✅ Pickaxe purchases more reliable
- ✅ No more "transaction not found" errors
- ✅ Better user experience overall

---

**Need help?** Check the Helius docs: https://docs.helius.dev
