// 🔒 SECURE GOLD-BASED PICKAXE PURCHASES
// Prevents exploitation with rate limiting and purchase tracking

import { getUserOptimized, saveUserOptimized } from '../database.js';
import { sql } from '../database.js';

const PICKAXES = {
  silver: { name: 'Silver', costGold: 1000, ratePerSec: 1/60 },
  gold: { name: 'Gold', costGold: 25000, ratePerSec: 10/60 },
  diamond: { name: 'Diamond', costGold: 500000, ratePerSec: 100/60 },
  netherite: { name: 'Netherite', costGold: 10000000, ratePerSec: 1000/60 },
};

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
    console.log('🔒 SECURE gold-based pickaxe purchase...');
    
    const { address, pickaxeType, quantity } = req.body || {};
    
    if (!address || !pickaxeType || !PICKAXES[pickaxeType]) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));
    const pickaxe = PICKAXES[pickaxeType];
    const totalCost = pickaxe.costGold * qty;

    console.log(`🔒 Purchase request: ${qty}x ${pickaxeType} for ${totalCost.toLocaleString()} gold`);

    // 🔒 FIX #3: RATE LIMITING - Prevent purchase spam
    const MAX_PURCHASES_PER_HOUR = 100;
    const MAX_PURCHASES_PER_MINUTE = 10;
    
    try {
      // Create tracking table if not exists
      await sql`
        CREATE TABLE IF NOT EXISTS gold_purchases (
          id SERIAL PRIMARY KEY,
          user_address TEXT NOT NULL,
          pickaxe_type TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          gold_spent BIGINT NOT NULL,
          purchased_at TIMESTAMP DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_gold_purchases_user_time 
        ON gold_purchases(user_address, purchased_at)
      `;

      // Check hourly rate limit
      const hourlyPurchases = await sql`
        SELECT COUNT(*) as count 
        FROM gold_purchases 
        WHERE user_address = ${address}
          AND purchased_at > NOW() - INTERVAL '1 hour'
      `;

      if (parseInt(hourlyPurchases[0].count) >= MAX_PURCHASES_PER_HOUR) {
        console.log(`❌ RATE LIMIT: ${address.slice(0, 8)} exceeded hourly purchase limit`);
        return res.status(429).json({ 
          error: 'Purchase limit reached',
          message: `Maximum ${MAX_PURCHASES_PER_HOUR} purchases per hour allowed. Please try again later.`,
          retryAfter: 3600
        });
      }

      // Check per-minute rate limit
      const minutePurchases = await sql`
        SELECT COUNT(*) as count 
        FROM gold_purchases 
        WHERE user_address = ${address}
          AND purchased_at > NOW() - INTERVAL '1 minute'
      `;

      if (parseInt(minutePurchases[0].count) >= MAX_PURCHASES_PER_MINUTE) {
        console.log(`❌ RATE LIMIT: ${address.slice(0, 8)} exceeded per-minute purchase limit`);
        return res.status(429).json({ 
          error: 'Too many purchases',
          message: `Maximum ${MAX_PURCHASES_PER_MINUTE} purchases per minute. Please slow down.`,
          retryAfter: 60
        });
      }

    } catch (rateLimitError) {
      console.error('⚠️ Rate limit check error:', rateLimitError.message);
      // Continue anyway, don't block purchase if rate limit check fails
    }

    // Get user and validate gold balance
    const user = await getUserOptimized(address, false);
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please connect your wallet first.' });
    }

    // Calculate current gold (includes mined gold since last checkpoint)
    const now = nowSec();
    const timeSinceCheckpoint = now - (user.checkpoint_timestamp || now);
    const goldMined = (user.total_mining_power || 0) / 60 * timeSinceCheckpoint;
    const totalGold = parseFloat((user.last_checkpoint_gold || 0)) + parseFloat(goldMined);

    console.log('🔒 Gold validation:', {
      address: address.slice(0, 8) + '...',
      checkpointGold: user.last_checkpoint_gold || 0,
      minedGold: parseFloat(goldMined).toFixed(2),
      totalGold: parseFloat(totalGold).toFixed(2),
      requiredGold: totalCost,
      hasEnough: totalGold >= totalCost
    });

    // 🔒 Strict gold validation
    if (totalGold < totalCost) {
      return res.status(400).json({ 
        error: 'Insufficient gold',
        required: totalCost,
        available: Math.floor(totalGold),
        missing: Math.floor(totalCost - totalGold)
      });
    }

    // 🔒 Additional validation: Check if this is suspiciously fast accumulation
    const accountAge = now - (user.checkpoint_timestamp || now);
    if (accountAge < 3600 && totalGold > 1000000) { // Less than 1 hour old with >1M gold
      console.log('⚠️ SUSPICIOUS: New account with high gold');
      
      try {
        await sql`
          INSERT INTO suspicious_activity (
            user_address, 
            activity_type, 
            claimed_value, 
            max_allowed_value, 
            details,
            detected_at
          ) VALUES (
            ${address},
            'rapid_gold_accumulation',
            ${totalGold},
            ${1000000},
            ${JSON.stringify({ accountAge, pickaxeType, quantity })},
            NOW()
          )
        `;
      } catch (logError) {
        console.error('⚠️ Failed to log suspicious activity:', logError.message);
      }
    }

    // Deduct gold and add pickaxes
    const newGold = totalGold - totalCost;
    user.last_checkpoint_gold = newGold;
    user.checkpoint_timestamp = now;
    
    const pickaxeKey = `${pickaxeType}_pickaxes`;
    user[pickaxeKey] = (user[pickaxeKey] || 0) + qty;

    // Update mining power
    const oldPower = user.total_mining_power || 0;
    const addedPower = pickaxe.ratePerSec * 60 * qty;
    // Round to avoid floating-point precision errors
    user.total_mining_power = Math.round((oldPower + addedPower) * 100) / 100;
    user.last_activity = now;

    console.log(`⛏️ Adding ${qty}x ${pickaxeType} - Power: ${oldPower.toFixed(2)} → ${user.total_mining_power.toFixed(2)}`);

    // Save user
    const savedUser = await saveUserOptimized(address, user);
    if (!savedUser) {
      throw new Error('Failed to save user data');
    }
    // Update user object with saved data
    user = savedUser;

    // 🔒 Log the purchase for rate limiting and audit trail
    try {
      await sql`
        INSERT INTO gold_purchases (user_address, pickaxe_type, quantity, gold_spent)
        VALUES (${address}, ${pickaxeType}, ${qty}, ${totalCost})
      `;
    } catch (logError) {
      console.error('⚠️ Failed to log purchase:', logError.message);
      // Don't fail the purchase if logging fails
    }

    console.log(`✅ SECURE purchase completed: ${qty}x ${pickaxeType} for ${totalCost.toLocaleString()} gold`);

    return res.status(200).json({
      success: true,
      message: `Successfully purchased ${qty}x ${pickaxeType} pickaxe(s) with gold!`,
      pickaxeType,
      quantity: qty,
      goldSpent: totalCost,
      goldRemaining: Math.floor(newGold),
      newInventory: {
        silver: user.silver_pickaxes || 0,
        gold: user.gold_pickaxes || 0,
        diamond: user.diamond_pickaxes || 0,
        netherite: user.netherite_pickaxes || 0,
      },
      miningPower: user.total_mining_power,
      validated: true
    });

  } catch (e) {
    console.error('❌ Secure gold purchase error:', e);
    console.error('Error stack:', e.stack);
    return res.status(500).json({
      error: 'Purchase failed',
      message: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}
