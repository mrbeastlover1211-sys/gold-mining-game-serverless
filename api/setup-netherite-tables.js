// Emergency setup API to create netherite_challenges table
import { pool } from '../database.js';

export default async function handler(req, res) {
  let client;
  
  try {
    client = await pool.connect();
    
    console.log('🔧 Creating netherite_challenges table...');
    
    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS netherite_challenges (
        id SERIAL PRIMARY KEY,
        referrer_address VARCHAR(100) NOT NULL,
        challenge_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        challenge_expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        bonus_claimed BOOLEAN DEFAULT false,
        referred_user_address VARCHAR(100),
        referred_purchase_time TIMESTAMP,
        bonus_awarded BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ netherite_challenges table created');
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_netherite_challenges_referrer 
      ON netherite_challenges(referrer_address, is_active)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_netherite_challenges_expires 
      ON netherite_challenges(challenge_expires_at, is_active)
    `);
    
    console.log('✅ Indexes created');
    
    // Add columns to referral_visits
    await client.query(`
      ALTER TABLE referral_visits 
      ADD COLUMN IF NOT EXISTS netherite_challenge_id INTEGER REFERENCES netherite_challenges(id)
    `);
    
    await client.query(`
      ALTER TABLE referral_visits 
      ADD COLUMN IF NOT EXISTS purchased_netherite BOOLEAN DEFAULT false
    `);
    
    await client.query(`
      ALTER TABLE referral_visits 
      ADD COLUMN IF NOT EXISTS netherite_purchase_time TIMESTAMP
    `);
    
    console.log('✅ referral_visits columns added');
    
    // Add columns to users
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS netherite_challenge_accepted BOOLEAN DEFAULT false
    `);
    
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS netherite_challenge_shown BOOLEAN DEFAULT false
    `);
    
    console.log('✅ users columns added');
    
    return res.json({
      success: true,
      message: '✅ All Netherite Challenge tables and columns created successfully!',
      tables: ['netherite_challenges', 'referral_visits (updated)', 'users (updated)']
    });
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to setup tables',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
