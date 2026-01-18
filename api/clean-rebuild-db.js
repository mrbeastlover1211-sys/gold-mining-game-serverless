// 🧹 CLEAN REBUILD DB - Simple clean rebuild with full address support
import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  const results = [];
  
  try {
    // Drop old tables
    await client.query('DROP TABLE IF EXISTS referral_visits CASCADE');
    results.push('✅ Dropped old referral_visits');
    
    // Create new clean table
    await client.query(`
      CREATE TABLE referral_visits (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(150) UNIQUE NOT NULL,
        referrer_address VARCHAR(150) NOT NULL,
        referred_address VARCHAR(150),
        visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        wallet_connected BOOLEAN DEFAULT false,
        land_purchased BOOLEAN DEFAULT false,
        pickaxe_purchased BOOLEAN DEFAULT false,
        reward_delivered BOOLEAN DEFAULT false,
        expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '48 hours'
      )
    `);
    results.push('✅ Created clean referral_visits table');
    
    // Add test data with FULL addresses
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const testUser = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    
    await client.query(`
      INSERT INTO referral_visits (
        session_id, 
        referrer_address, 
        referred_address,
        wallet_connected,
        land_purchased,
        pickaxe_purchased
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'clean_test_' + Date.now(),
      mainAccount,
      testUser,
      true,
      true, 
      true
    ]);
    results.push('✅ Added test referral with FULL addresses');
    
    // Update main account with reward
    try {
      await client.query(`
        UPDATE users 
        SET 
          inventory = COALESCE(inventory, '{}')::jsonb || '{"silver": 1}'::jsonb,
          total_referrals = COALESCE(total_referrals, 0) + 1,
          total_mining_power = COALESCE(total_mining_power, 0) + 1
        WHERE address = $1
      `, [mainAccount]);
      results.push('🎁 Gave referral reward to main account');
    } catch (e) {
      results.push(`⚠️ Reward error: ${e.message}`);
    }
    
    return res.json({ success: true, results });
    
  } catch (error) {
    return res.json({ success: false, error: error.message });
  } finally {
    client.release();
    
  }
}