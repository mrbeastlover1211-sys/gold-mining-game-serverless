// 🔍 DEBUG REFERRAL SYSTEM - Find what's wrong
import { getPool } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🔍 Debugging referral system...');
    
    const pool = await getPool();
    const client = await pool.connect();
    
    console.log('📊 Checking referrals table...');
    
    // Check if referrals table exists
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'referrals'
        )
      `);
      
      const tableExists = tableCheck.rows[0].exists;
      console.log('🗂️ Referrals table exists:', tableExists);
      
      if (!tableExists) {
        // Create the referrals table
        console.log('🛠️ Creating referrals table...');
        await client.query(`
          CREATE TABLE referrals (
            id SERIAL PRIMARY KEY,
            referrer_address VARCHAR(100) NOT NULL,
            referred_address VARCHAR(100) NOT NULL,
            reward_amount DECIMAL(10, 8) DEFAULT 0.01,
            reward_type VARCHAR(20) DEFAULT 'sol',
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(referrer_address, referred_address)
          )
        `);
        console.log('✅ Referrals table created');
      }
      
      // Check current data
      const countQuery = await client.query('SELECT COUNT(*) as count FROM referrals');
      console.log('📊 Total referrals in table:', countQuery.rows[0].count);
      
      // Check for specific user
      const userReferrals = await client.query(
        'SELECT * FROM referrals WHERE referrer_address = $1', 
        ['67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C']
      );
      console.log('👤 Referrals for main account:', userReferrals.rows);
      
      // Try to create a test referral
      console.log('🧪 Testing referral creation...');
      try {
        const testResult = await client.query(`
          INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [
          '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C',
          'DEBUG_TEST_USER_' + Date.now(),
          0.01,
          'sol'
        ]);
        
        console.log('✅ Test referral created:', testResult.rows[0]);
        
        // Check updated count
        const newCount = await client.query('SELECT COUNT(*) as count FROM referrals WHERE referrer_address = $1', ['67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C']);
        console.log('📊 Referrals for main account after test:', newCount.rows[0].count);
        
      } catch (insertError) {
        console.error('❌ Failed to create test referral:', insertError.message);
      }
      
      // Check users table for referral data
      const userCheck = await client.query(`
        SELECT address, total_referrals, referral_rewards_earned 
        FROM users 
        WHERE address = $1
      `, ['67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C']);
      
      console.log('👤 User table referral data:', userCheck.rows[0] || 'No user found');
      
    } catch (tableError) {
      console.error('❌ Table operation error:', tableError.message);
    }
    
    client.release();
    
    return res.json({
      success: true,
      debug_complete: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Debug referral error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}