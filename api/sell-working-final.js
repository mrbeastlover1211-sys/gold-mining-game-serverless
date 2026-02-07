// Complete sell API using Neon Serverless (HTTP-based, no TCP connections)
import { sql, getUserOptimized, saveUserOptimized } from '../database.js';

const MIN_SELL_GOLD = 10000;
const GOLD_PRICE_SOL = parseFloat(process.env.GOLD_PRICE_SOL || '0.000001');

// 🛡️ RATE LIMIT: Prevent spam selling
const MIN_SELL_INTERVAL = 15; // seconds between sells
const MAX_SELLS_PER_HOUR = 100; // maximum sells per hour per user

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('💰 Neon Serverless sell API - HTTP-based');
    
    const { address, amountGold } = req.body || {};

    // Validation
    if (!address || !amountGold) {
      return res.status(400).json({ error: 'Address and amountGold required' });
    }

    if (typeof amountGold !== 'number' || amountGold <= 0) {
      return res.status(400).json({ error: 'Invalid gold amount' });
    }

    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ 
        error: `Minimum sell amount is ${MIN_SELL_GOLD.toLocaleString()} gold` 
      });
    }

    console.log(`💰 Processing sell: ${amountGold} gold from ${address.slice(0, 8)}...`);

    // 🛡️ RATE LIMIT CHECK: Prevent spam selling
    // Check recent sells from this address
    const recentSells = await sql`
      SELECT created_at 
      FROM gold_sales 
      WHERE user_address = ${address}
      AND created_at > NOW() - INTERVAL '15 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (recentSells.length > 0) {
      const lastSellTime = new Date(recentSells[0].created_at);
      const secondsSinceLastSell = Math.floor((Date.now() - lastSellTime.getTime()) / 1000);
      const waitTime = MIN_SELL_INTERVAL - secondsSinceLastSell;
      
      console.log(`⚠️ Rate limit: User sold ${secondsSinceLastSell} seconds ago`);
      return res.status(429).json({ 
        error: 'Please wait before selling again',
        message: `You can sell again in ${waitTime} seconds`,
        waitTime: waitTime,
        rateLimitType: 'cooldown'
      });
    }

    // Check hourly rate limit
    const sellsLastHour = await sql`
      SELECT COUNT(*) as count 
      FROM gold_sales 
      WHERE user_address = ${address}
      AND created_at > NOW() - INTERVAL '1 hour'
    `;

    if (sellsLastHour[0].count >= MAX_SELLS_PER_HOUR) {
      console.log(`⚠️ Hourly rate limit: User has ${sellsLastHour[0].count} sells in last hour`);
      return res.status(429).json({ 
        error: 'Hourly sell limit reached',
        message: `You can only sell ${MAX_SELLS_PER_HOUR} times per hour. Please try again later.`,
        currentCount: parseInt(sellsLastHour[0].count),
        maxAllowed: MAX_SELLS_PER_HOUR,
        rateLimitType: 'hourly'
      });
    }

    console.log(`✅ Rate limit check passed`);

    // Get current user data using optimized function
    const user = await getUserOptimized(address, false); // Don't use cache for transactions
    
    if (!user) {
      return res.status(400).json({ error: 'User not found. Please connect wallet and refresh.' });
    }

    // Calculate current gold based on mining
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - (user.checkpoint_timestamp || currentTime);
    const goldPerSecond = (user.total_mining_power || 0) / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const totalGold = parseFloat(user.last_checkpoint_gold || 0) + goldMined;

    console.log(`💰 Gold calculation:`, {
      baseGold: user.last_checkpoint_gold,
      goldMined: goldMined.toFixed(2),
      totalGold: totalGold.toFixed(2),
      requestedSell: amountGold
    });

    // Check if user has enough gold
    if (totalGold < amountGold) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${Math.floor(totalGold).toLocaleString()} gold but need ${amountGold.toLocaleString()} gold.`,
        currentGold: Math.floor(totalGold)
      });
    }

    // Calculate new gold amount after sale
    const newGoldAmount = totalGold - amountGold;
    const payoutSol = amountGold * GOLD_PRICE_SOL;

    console.log(`✅ Sale approved - Deducting ${amountGold} gold, remaining: ${newGoldAmount.toFixed(2)}`);

    // Neon Serverless transactions using BEGIN/COMMIT
    // Note: gold_sales table must exist (created by schema migration)
    try {
      // BEGIN transaction
      await sql`BEGIN`;

      // Update user's gold and timestamp
      await sql`
        UPDATE users 
        SET 
          last_checkpoint_gold = ${newGoldAmount},
          checkpoint_timestamp = ${currentTime},
          last_activity = ${currentTime}
        WHERE address = ${address}
      `;

      // Record the sale for admin processing
      await sql`
        INSERT INTO gold_sales (user_address, gold_amount, payout_sol, status)
        VALUES (${address}, ${amountGold}, ${payoutSol}, 'pending')
      `;

      // COMMIT transaction
      await sql`COMMIT`;

      console.log(`✅ Gold sale completed successfully - ${address.slice(0, 8)}... sold ${amountGold} gold`);

      return res.status(200).json({
        success: true,
        payoutSol: payoutSol.toFixed(6),
        newGold: Math.floor(newGoldAmount),
        oldGold: Math.floor(totalGold),
        goldDeducted: amountGold,
        mode: 'pending',
        message: `Successfully sold ${amountGold.toLocaleString()} gold for ${payoutSol.toFixed(6)} SOL!`,
        note: 'Gold has been deducted from your account. Sale pending admin approval.',
        timestamp: currentTime
      });

    } catch (transactionError) {
      // Rollback on error
      try {
        await sql`ROLLBACK`;
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('❌ Rollback error:', rollbackError.message);
      }
      throw transactionError;
    }

  } catch (e) {
    console.error('❌ Neon Serverless sell error:', e.message);
    console.error('❌ Stack:', e.stack);
    
    return res.status(500).json({
      error: 'Sell transaction failed',
      message: e.message,
      details: 'Transaction has been rolled back, no gold was deducted'
    });
  }
}
