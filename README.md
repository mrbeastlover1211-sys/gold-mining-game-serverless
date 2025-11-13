# 🎮 Gold Mining Game - Serverless v1.1

A Solana-based idle mining game built for serverless deployment on Vercel.

## 🚀 Features

- **Solana Wallet Integration** - Connect with Phantom wallet
- **Idle Mining System** - Mine gold even when offline
- **4 Pickaxe Types** - Silver, Gold, Diamond, Netherite
- **Land Ownership** - Purchase land to start mining
- **Serverless Architecture** - Scales automatically from 0 to millions of users

## 📦 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Click "Deploy with Vercel" 
2. Connect your GitHub account
3. Add environment variables:

```
DATABASE_URL=your_neon_database_url
TREASURY_PUBLIC_KEY=your_solana_wallet_public_key
SOLANA_CLUSTER_URL=https://api.devnet.solana.com
GOLD_PRICE_SOL=0.000001
MIN_SELL_GOLD=10000
ADMIN_TOKEN=your_admin_token
```

4. Deploy!

## 🧪 Test Endpoints

After deployment:

- `/api/test` - Health check
- `/api/config` - Game configuration  
- `/` - Play the game!

## 💡 Architecture

- **Frontend**: Static files served from Vercel CDN
- **Backend**: Serverless functions in `/api` folder  
- **Database**: PostgreSQL (Neon) with in-memory fallback
- **Blockchain**: Solana Devnet/Mainnet

## 🎯 Built for Scale

This serverless architecture can handle:
- **0-100K users**: Free tier
- **100K+ users**: Auto-scaling with minimal costs
- **Global performance**: Edge functions worldwide