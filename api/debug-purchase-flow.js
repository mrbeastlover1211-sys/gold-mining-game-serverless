// Debug the actual purchase flow to see what's happening
import { OptimizedDatabase } from '../database-optimized.js';

export default async function handler(req, res) {
  try {
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('🔍 DEBUGGING ACTUAL PURCHASE FLOW...');
    
    // 1. Check current state
    console.log('📊 Step 1: Getting current user data...');
    const userBefore = await OptimizedDatabase.getUser(address, true);
    console.log('Current state:', {
      inventory: userBefore.inventory,
      mining_power: userBefore.total_mining_power,
      last_activity: new Date(userBefore.lastActivity * 1000).toLocaleString(),
      checkpoint_gold: userBefore.last_checkpoint_gold
    });
    
    // 2. Check recent transactions
    console.log('📊 Step 2: Checking recent transactions...');
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get recent transactions for this user
    const recentTx = await client.query(`
      SELECT * FROM transactions 
      WHERE user_address = $1 
      ORDER BY timestamp DESC 
      LIMIT 10
    `, [address]);
    
    console.log('Recent transactions:', recentTx.rows);
    
    // Get user record directly from database
    const dbUser = await client.query(`
      SELECT * FROM users WHERE address = $1
    `, [address]);
    
    console.log('Direct DB user record:', dbUser.rows[0]);
    
    client.release();
    await pool.end();
    
    return res.json({
      debug: 'purchase_flow_analysis',
      current_user_data: {
        inventory: userBefore.inventory,
        mining_power: userBefore.total_mining_power,
        last_activity: userBefore.lastActivity,
        checkpoint_gold: userBefore.last_checkpoint_gold
      },
      recent_transactions: recentTx.rows,
      database_record: dbUser.rows[0],
      analysis: {
        transactions_exist: recentTx.rows.length > 0,
        inventory_matches: JSON.stringify(userBefore.inventory) === JSON.stringify(dbUser.rows[0] || {}),
        suggestions: [
          'Check if purchases are calling the right endpoint',
          'Verify if transaction signatures are being processed',
          'Check if there are multiple user records',
          'Verify the purchase flow in the frontend'
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Debug flow error:', error);
    return res.json({
      error: error.message,
      stack: error.stack
    });
  }
}