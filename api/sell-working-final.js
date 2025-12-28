// Complete sell API using WORKING export default syntax
import { pool } from '../database.js';

const MIN_SELL_GOLD = 5000;
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

  let client;
  
  try {
    console.log('💰 Working sell API - with gold deduction');
    
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

    // Get database client from shared pool
    client = await pool.connect();

    // Start transaction for atomic operation
    await client.query('BEGIN');

    // Get current user data
    const userResult = await client.query('SELECT * FROM users WHERE address = $1', [address]);
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'User not found. Please connect wallet and refresh.' });
    }

    const user = userResult.rows[0];

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
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${Math.floor(totalGold).toLocaleString()} gold but need ${amountGold.toLocaleString()} gold.`,
        currentGold: Math.floor(totalGold)
      });
    }

    // Calculate new gold amount after sale
    const newGoldAmount = totalGold - amountGold;
    const payoutSol = amountGold * GOLD_PRICE_SOL;

    console.log(`✅ Sale approved - Deducting ${amountGold} gold, remaining: ${newGoldAmount.toFixed(2)}`);

    // Update user's gold and timestamp in database
    await client.query(`
      UPDATE users 
      SET 
        last_checkpoint_gold = $1,
        checkpoint_timestamp = $2,
        last_activity = $2
      WHERE address = $3
    `, [newGoldAmount, currentTime, address]);

    // Create gold_sales table if it doesn't exist (with admin audit columns)
    await client.query(`
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
    `);

    // Record the sale for admin processing
    await client.query(`
      INSERT INTO gold_sales (user_address, gold_amount, payout_sol, status)
      VALUES ($1, $2, $3, 'pending')
    `, [address, amountGold, payoutSol]);

    // Commit transaction
    await client.query('COMMIT');

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

  } catch (e) {
    // Rollback transaction on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError.message);
      }
    }
    
    console.error('❌ Working sell error:', e.message);
    console.error('❌ Stack:', e.stack);
    
    return res.status(500).json({
      error: 'Sell transaction failed',
      message: e.message,
      details: 'Transaction has been rolled back, no gold was deducted'
    });
    
  } finally {
    // Always release database client back to pool
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Client release error:', releaseError.message);
      }
    }
  }
}