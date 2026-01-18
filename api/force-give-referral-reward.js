// 🎁 FORCE GIVE REFERRAL REWARD - Direct reward for main account
export default async function handler(req, res) {
  try {
    console.log('🎁 Force giving referral reward...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('👤 Processing reward for:', mainAccount.slice(0, 8) + '...');
    
    // Get current user data
    const userQuery = await client.query('SELECT * FROM users WHERE address = $1', [mainAccount]);
    
    if (userQuery.rows.length === 0) {
      throw new Error('Main account not found in database');
    }
    
    const user = userQuery.rows[0];
    console.log('📊 Current user state:', {
      has_land: user.has_land,
      inventory: user.inventory,
      total_referrals: user.total_referrals || 0,
      gold: user.gold || 0
    });
    
    // Force give first referral reward: Silver Pickaxe + 100 Gold
    const currentInventory = user.inventory || {};
    const updatedInventory = {
      ...currentInventory,
      silver: (currentInventory.silver || 0) + 1  // +1 Silver Pickaxe
    };
    
    const newGold = parseFloat(user.gold || 0) + 100;  // +100 Gold
    const newReferrals = (user.total_referrals || 0) + 1;  // +1 Referral
    const newMiningPower = (user.total_mining_power || 0) + 1;  // +1 Mining power
    const newReferralRewards = (user.referral_rewards_earned || 0) + 0.01;  // +0.01 SOL
    
    const updateResult = await client.query(`
      UPDATE users 
      SET 
        inventory = $1,
        gold = $2,
        total_referrals = $3,
        total_mining_power = $4,
        referral_rewards_earned = $5
      WHERE address = $6
      RETURNING *
    `, [
      JSON.stringify(updatedInventory),
      newGold,
      newReferrals,
      newMiningPower,
      newReferralRewards,
      mainAccount
    ]);
    
    const updatedUser = updateResult.rows[0];
    
    console.log('✅ Referral reward given:', {
      old_inventory: user.inventory,
      new_inventory: updatedUser.inventory,
      old_gold: user.gold,
      new_gold: updatedUser.gold,
      old_referrals: user.total_referrals || 0,
      new_referrals: updatedUser.total_referrals,
      mining_power_added: 1
    });
    
    // Create referral record for tracking
    try {
      await client.query(`
        INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [mainAccount, 'FORCE_REWARD_TEST_USER', 0.01, 'sol', 'completed']);
      console.log('✅ Referral record created');
    } catch (e) {
      console.log('ℹ️ Referral record info:', e.message);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Referral reward forcefully given!',
      reward_details: {
        silver_pickaxe_added: 1,
        gold_added: 100,
        sol_reward_added: 0.01,
        new_total_referrals: updatedUser.total_referrals,
        new_mining_power: updatedUser.total_mining_power
      },
      user_address: mainAccount.slice(0, 8) + '...',
      before: {
        inventory: user.inventory,
        gold: user.gold,
        referrals: user.total_referrals || 0
      },
      after: {
        inventory: updatedUser.inventory,
        gold: updatedUser.gold,
        referrals: updatedUser.total_referrals
      }
    });
    
  } catch (error) {
    console.error('❌ Force reward error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
}