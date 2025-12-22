# Scaling Recommendations for Gold Mining Game

## Current Capacity: ~500-1,000 concurrent users

## To Scale to 5,000-10,000+ Users:

### 1. Increase Database Pool Size (Quick Win)
```javascript
// database.js
max: 50,  // Increase from 10 to 50
```
**Impact:** 5x capacity → 2,500-5,000 users
**Cost:** Requires Neon paid plan ($19/mo+)

### 2. Add Redis Caching Layer
**Current:** In-memory cache (loses data on cold starts)
**Upgrade:** Redis for persistent cache across all serverless instances

```javascript
// Use Upstash Redis (serverless-friendly)
import Redis from '@upstash/redis';

const redis = Redis.fromEnv();

// Cache user data for 5 minutes
await redis.set(`user:${address}`, userData, { ex: 300 });
```

**Impact:** 95% cache hit rate, reduces DB load by 20x
**Cost:** Upstash free tier: 10,000 requests/day

### 3. Optimize Heavy Endpoints
**Current hotspots:**
- `/api/status` - Called every page load
- Mining gold calculations - Runs frequently

**Optimizations:**
- Move mining calculations to client-side only
- Server only saves checkpoints (already done)
- Batch status updates (every 30 seconds instead of real-time)

### 4. Database Indexing (Already Good)
Your schema likely has indexes, but verify:
```sql
CREATE INDEX idx_users_address ON users(address);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_address);
CREATE INDEX idx_referral_visits_session ON referral_visits(session_id);
```

### 5. CDN for Static Assets
- Move pickaxe images to CDN (Cloudflare, Vercel Edge)
- Enable Vercel Edge caching for `public/` folder

### 6. Connection Pooling Service (PgBouncer)
**Current:** Direct Neon connections
**Upgrade:** Use PgBouncer or Supabase Pooler

**Impact:** Handle 1000+ connections with 10 actual DB connections
**Cost:** Free with Supabase, or run your own

### 7. Horizontal Scaling (Future)
- Multiple Neon read replicas for read-heavy operations
- Separate write DB from read DBs
- Use Prisma Accelerate or similar

## Recommended Immediate Actions (Low Cost):

1. ✅ **Increase pool to 20-30** - Free on Neon paid plan ($19/mo)
2. ✅ **Add Redis caching** - Free tier on Upstash
3. ✅ **Monitor with New Relic/Datadog** - Identify real bottlenecks

## Cost Breakdown for 10,000 Users:

| Service | Current | Needed | Cost |
|---------|---------|--------|------|
| Vercel | Free/Pro | Pro | $20/mo |
| Neon DB | Free | Scale plan | $19-69/mo |
| Redis Cache | None | Upstash | Free-$10/mo |
| Monitoring | None | New Relic | $0-25/mo |
| **Total** | **$0/mo** | **$39-124/mo** | |

## Performance Targets:

- **500 users:** Current setup ✅
- **1,000 users:** Increase pool to 20
- **5,000 users:** Add Redis + increase pool to 50
- **10,000+ users:** Add read replicas + CDN

## Monitoring Recommendations:

```javascript
// Add to database.js
pool.on('error', (err) => {
  console.error('❌ Pool error:', err);
});

pool.on('connect', () => {
  console.log('✅ New DB connection');
});

// Log pool stats
setInterval(() => {
  console.log('📊 Pool stats:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000);
```

## Current System is Good For:

✅ **MVP / Beta Launch** (100-500 users)  
✅ **Early Growth** (500-1,000 users)  
⚠️ **Scale Phase** (1,000-5,000 users) - Need upgrades  
❌ **Viral Growth** (10,000+ users) - Need significant upgrades
