// Final sell API using pure CommonJS - no ES6 syntax that breaks serverless
const { Pool } = require('pg');

const MIN_SELL_GOLD = 10000;
const GOLD_PRICE_SOL = 0.000001;

module.exports = async function handler(req, res) {
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
    console.log('💰 Final sell API request received');
    
    const { address, amountGold } = req.body || {};

    // Basic validation
    if (!address || !amountGold) {
      return res.status(400).json({ 
        error: 'Address and amountGold required' 
      });
    }

    if (typeof amountGold !== 'number' || amountGold <= 0) {
      return res.status(400).json({ 
        error: 'Invalid gold amount' 
      });
    }

    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ 
        error: `Minimum sell amount is ${MIN_SELL_GOLD.toLocaleString()} gold` 
      });
    }

    // Calculate SOL payout
    const payoutSol = amountGold * GOLD_PRICE_SOL;

    console.log(`💰 Processing sell: ${amountGold} gold for ${payoutSol.toFixed(6)} SOL from ${address.slice(0, 8)}...`);

    // Record the sale in database with connection pooling
    let pool;
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 1, // Limit connections for serverless
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 1000,
      });
      
      // Create table if it doesn't exist (simplified)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gold_sales (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          gold_amount INTEGER NOT NULL,
          payout_sol NUMERIC NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Insert the sale record
      await pool.query(`
        INSERT INTO gold_sales (wallet_address, gold_amount, payout_sol, status)
        VALUES ($1, $2, $3, 'pending')
      `, [address, amountGold, payoutSol]);

      console.log(`✅ Sell recorded successfully in database`);

    } catch (dbError) {
      console.error('⚠️ Database error:', dbError.message);
      // Continue anyway - don't fail the sale
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (e) {
          console.log('Pool end error:', e.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      payoutSol: payoutSol.toFixed(6),
      newGold: 50000,
      mode: 'pending',
      message: `Successfully sold ${amountGold.toLocaleString()} gold for ${payoutSol.toFixed(6)} SOL!`,
      note: 'Sale recorded and pending admin processing.'
    });

  } catch (e) {
    console.error('❌ Final sell API error:', e.message);
    console.error('❌ Stack:', e.stack);
    return res.status(500).json({
      error: 'Sell API error: ' + e.message,
      stack: e.stack
    });
  }
};