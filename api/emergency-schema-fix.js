// 🚨 EMERGENCY SCHEMA FIX - Direct SQL execution
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    const fixes = [];
    
    // Add missing columns one by one
    const columns = [
      { name: 'inventory', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT \'{}\'::jsonb' },
      { name: 'total_referrals', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0' },
      { name: 'referral_rewards_earned', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewards_earned DECIMAL(20,8) DEFAULT 0' },
      { name: 'total_mining_power', sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS total_mining_power INTEGER DEFAULT 0' }
    ];
    
    for (const col of columns) {
      try {
        await client.query(col.sql);
        fixes.push(`✅ ${col.name}`);
      } catch (e) {
        fixes.push(`❌ ${col.name}: ${e.message}`);
      }
    }
    
    // Now try the referral completion
    try {
      const referredUser = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
      const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
      
      // Update main account with referral reward
      const rewardResult = await client.query(`
        UPDATE users 
        SET 
          inventory = COALESCE(inventory, '{}')::jsonb || '{"silver": 1}'::jsonb,
          total_referrals = COALESCE(total_referrals, 0) + 1,
          referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + 0.01,
          gold = gold + 100,
          total_mining_power = COALESCE(total_mining_power, 0) + 1
        WHERE address = $1
        RETURNING *
      `, [mainAccount]);
      
      fixes.push('🎁 Referral reward given!');
      
    } catch (rewardError) {
      fixes.push(`❌ Reward error: ${rewardError.message}`);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Emergency schema fix completed',
      fixes: fixes
    });
    
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
    });
  }
}