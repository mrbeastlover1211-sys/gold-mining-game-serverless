// 🔒 SECURE CHECKPOINT SAVING
// Prevents gold inflation exploits with strict validation and rate limiting

import { getUserOptimized, saveUserOptimized, cache } from '../database.js';
import { sql } from '../database.js';
import { redisDel, isRedisEnabled } from '../utils/redis.js';

function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || req.headers.referer?.split('/').slice(0,3).join('/');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔒 SECURE checkpoint save request...');
    
    const { address, gold, timestamp } = req.body || {};
    
    if (!address || gold === undefined || gold === null) {
      return res.status(400).json({ error: 'Missing address or gold' });
    }

    const user = await getUserOptimized(address, false);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = nowSec();
    const checkpointTimestamp = user.checkpoint_timestamp || now;
    const timeSinceCheckpoint = now - checkpointTimestamp;

    // 🔒 FIX #2: RATE LIMITING - Prevent checkpoint spam
    const MIN_CHECKPOINT_INTERVAL = 10; // seconds
    if (timeSinceCheckpoint < MIN_CHECKPOINT_INTERVAL && timeSinceCheckpoint > 0) {
      console.log(`⚠️ Rate limit: Only ${timeSinceCheckpoint}s since last checkpoint`);
      return res.status(429).json({ 
        error: `Please wait ${MIN_CHECKPOINT_INTERVAL - timeSinceCheckpoint} more seconds before saving`,
        retryAfter: MIN_CHECKPOINT_INTERVAL - timeSinceCheckpoint
      });
    }

    // 🔒 FIX #1: STRICTER VALIDATION - Reduced buffer from 10% to 5%
    const NETWORK_BUFFER = 1.05; // 5% buffer instead of 10%
    
    const miningPower = parseFloat(user.total_mining_power) || 0;
    const lastCheckpointGold = parseFloat(user.last_checkpoint_gold) || 0;
    
    // Calculate maximum possible gold
    let maxPossibleGold = lastCheckpointGold;
    if (timeSinceCheckpoint > 0 && miningPower > 0) {
      const goldPerSecond = miningPower / 60;
      const theoreticalGold = goldPerSecond * timeSinceCheckpoint;
      maxPossibleGold = lastCheckpointGold + (theoreticalGold * NETWORK_BUFFER);
    }

    console.log('🔒 Validation check:', {
      address: address.slice(0, 8) + '...',
      claimedGold: parseFloat(gold).toFixed(2),
      maxPossible: maxPossibleGold.toFixed(2),
      timeSinceCheckpoint,
      miningPower: miningPower.toFixed(2),
      buffer: '5%'
    });

    // 🔒 FIX #1: REJECT instead of capping (stricter enforcement)
    if (parseFloat(gold) > maxPossibleGold && timeSinceCheckpoint > 0) {
      console.log('❌ REJECTED: Gold amount exceeds maximum possible');
      
      // Log suspicious activity (non-blocking - table may not exist)
      try {
        console.warn('⚠️ Suspicious activity detected:', {
          address: address.slice(0, 8) + '...',
          claimed: parseFloat(gold),
          maxAllowed: maxPossibleGold
        });
      } catch (logError) {
        // Silently ignore logging errors
      }

      return res.status(400).json({ 
        error: 'Invalid gold amount detected',
        message: 'The gold amount exceeds what is possible to mine. Please refresh the game.',
        maxAllowed: Math.floor(maxPossibleGold),
        claimed: Math.floor(parseFloat(gold))
      });
    }

    // 🔒 Additional validation for new users
    if (timeSinceCheckpoint > 86400) { // More than 24 hours
      console.log('⚠️ Long time since checkpoint (>24h), extra validation');
      
      // Cap to 24 hours worth of mining to prevent extreme accumulation
      const maxDailyGold = lastCheckpointGold + ((miningPower / 60) * 86400 * NETWORK_BUFFER);
      if (parseFloat(gold) > maxDailyGold) {
        console.log('❌ REJECTED: Gold exceeds 24-hour maximum');
        return res.status(400).json({ 
          error: 'Maximum 24 hours of mining can be claimed at once',
          message: 'Please save checkpoints more frequently.',
          maxAllowed: Math.floor(maxDailyGold)
        });
      }
    }

    // Save the checkpoint
    user.last_checkpoint_gold = parseFloat(gold);
    user.checkpoint_timestamp = now;
    user.last_activity = now;

    const saveSuccess = await saveUserOptimized(address, user);
    if (!saveSuccess) {
      throw new Error('Failed to save checkpoint');
    }
    
    // 🔥 CRITICAL: Clear caches to force fresh data on next status check
    const cacheKey = `user_${address}`;
    cache.delete(cacheKey);
    if (isRedisEnabled()) {
      await redisDel(cacheKey);
    }
    console.log(`🗑️ Cleared caches for ${address.slice(0, 8)}... to force fresh data`);

    console.log(`✅ SECURE checkpoint saved: ${parseFloat(gold).toFixed(2)} gold`);

    return res.status(200).json({
      success: true,
      gold: parseFloat(gold),
      timestamp: now,
      validated: true,
      maxPossible: maxPossibleGold
    });

  } catch (e) {
    console.error('❌ Secure checkpoint error:', e);
    return res.status(500).json({
      error: 'Failed to save checkpoint',
      message: e.message
    });
  }
}
