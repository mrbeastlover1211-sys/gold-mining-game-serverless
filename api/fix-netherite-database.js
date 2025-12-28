// Fix Netherite Challenge Database Schema
import pkg from 'pg';
const { Pool } = pkg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let pool;
  
  try {
    console.log('🔧 Starting Netherite database fix...');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    const results = [];

    // 1. Create netherite_challenges table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS netherite_challenges (
          id SERIAL PRIMARY KEY,
          referrer_address TEXT NOT NULL,
          challenge_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          challenge_expires_at TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT true,
          bonus_claimed BOOLEAN DEFAULT false,
          bonus_awarded BOOLEAN DEFAULT false,
          referred_user_address TEXT,
          referred_purchase_time TIMESTAMP
        )
      `);
      results.push('✅ Created netherite_challenges table');
      console.log('✅ Created netherite_challenges table');
    } catch (e) {
      results.push(`ℹ️ netherite_challenges table: ${e.message}`);
    }

    // 2. Add netherite_challenge_id to referral_visits
    try {
      await pool.query(`
        ALTER TABLE referral_visits 
        ADD COLUMN IF NOT EXISTS netherite_challenge_id INTEGER REFERENCES netherite_challenges(id)
      `);
      results.push('✅ Added netherite_challenge_id to referral_visits');
      console.log('✅ Added netherite_challenge_id to referral_visits');
    } catch (e) {
      results.push(`ℹ️ netherite_challenge_id column: ${e.message}`);
    }

    // 3. Add purchased_netherite to referral_visits
    try {
      await pool.query(`
        ALTER TABLE referral_visits 
        ADD COLUMN IF NOT EXISTS purchased_netherite BOOLEAN DEFAULT false
      `);
      results.push('✅ Added purchased_netherite to referral_visits');
      console.log('✅ Added purchased_netherite to referral_visits');
    } catch (e) {
      results.push(`ℹ️ purchased_netherite column: ${e.message}`);
    }

    // 4. Add netherite_purchase_time to referral_visits
    try {
      await pool.query(`
        ALTER TABLE referral_visits 
        ADD COLUMN IF NOT EXISTS netherite_purchase_time TIMESTAMP
      `);
      results.push('✅ Added netherite_purchase_time to referral_visits');
      console.log('✅ Added netherite_purchase_time to referral_visits');
    } catch (e) {
      results.push(`ℹ️ netherite_purchase_time column: ${e.message}`);
    }

    // 5. Add netherite columns to users table
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS active_netherite_challenge_id INTEGER
      `);
      results.push('✅ Added active_netherite_challenge_id to users');
      console.log('✅ Added active_netherite_challenge_id to users');
    } catch (e) {
      results.push(`ℹ️ active_netherite_challenge_id column: ${e.message}`);
    }

    // 6. Add netherite_pickaxes to users if not exists
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS netherite_pickaxes INTEGER DEFAULT 0
      `);
      results.push('✅ Added netherite_pickaxes to users');
      console.log('✅ Added netherite_pickaxes to users');
    } catch (e) {
      results.push(`ℹ️ netherite_pickaxes column: ${e.message}`);
    }

    // 7. Check current schema
    const schema = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('netherite_challenges', 'referral_visits', 'users')
      ORDER BY table_name, ordinal_position
    `);

    console.log('✅ Database migration complete!');
    
    return res.status(200).json({
      success: true,
      message: 'Netherite Challenge database schema fixed!',
      results,
      currentSchema: schema.rows
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: 'Database migration failed'
    });
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.log('Pool cleanup error:', e.message);
      }
    }
  }
}
