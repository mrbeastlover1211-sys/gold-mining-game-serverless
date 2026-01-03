// Complete sell API using Neon Serverless (HTTP-based, no TCP connections)
import { sql, getUserOptimized, saveUserOptimized } from '../database.js';

const MIN_SELL_GOLD = 10000;
const GOLD_PRICE_SOL = parseFloat(process.env.GOLD_PRICE_SOL || '0.000001');

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
    // Note: Neon Serverless supports transactions via multiple queries
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

      // Create gold_sales table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS gold_sales (
          id SERIAL PRIMARY KEY,
          user_address TEXT NOT NULL REFERENCES users(address),
          gold_amount INTEGER NOT NULL,
          payout_sol NUMERIC NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          processed_at TIMESTAMP NULL,
          transaction_signature TEXT NULL,
          admin_notes TEXT NULL,
          admin_approved_by VARCHAR(255),
          admin_approved_at TIMESTAMP,
          completed_by VARCHAR(255),
          rejected_by VARCHAR(255),
          rejected_at TIMESTAMP,
          reject_reason TEXT,
          tx_signature TEXT
        )
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
