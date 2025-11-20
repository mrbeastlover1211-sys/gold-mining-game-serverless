// 🎁 MANUAL REFERRAL REWARD - Give earned reward directly
export default async function handler(req, res) {
  try {
    console.log('🎁 Processing manual referral reward...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('🎯 Giving manual referral reward to:', address.slice(0, 8) + '...');
    
    // Get current user data
    const currentUser = await client.query('SELECT * FROM users WHERE address = $1', [address]);
    
    if (currentUser.rows.length === 0) {
      throw new Error('User not found in database');
    }
    
    const user = currentUser.rows[0];
    console.log('👤 Current user state:', {
      has_land: user.has_land,
      inventory: user.inventory,
      total_referrals: user.total_referrals,
      gold: user.gold
    });
    
    // Update user with referral reward (1st referral = Silver Pickaxe + 100 Gold)
    const updatedInventory = {
      ...user.inventory,
      silver: (user.inventory.silver || 0) + 1  // +1 Silver Pickaxe
    };
    
    const updatedGold = parseFloat(user.gold || 0) + 100;  // +100 Gold
    const updatedReferrals = (user.total_referrals || 0) + 1;  // +1 Referral count
    const updatedMiningPower = (user.total_mining_power || 0) + 1;  // Silver pickaxe = 1 power
    
    const updateResult = await client.query(`
      UPDATE users 
      SET 
        inventory = $1,
        gold = $2,
        total_referrals = $3,
        total_mining_power = $4,
        referral_rewards_earned = referral_rewards_earned + $5
      WHERE address = $6
      RETURNING *
    `, [
      JSON.stringify(updatedInventory),
      updatedGold,
      updatedReferrals,
      updatedMiningPower,
      0.01,  // SOL reward amount
      address
    ]);
    
    const updatedUser = updateResult.rows[0];
    
    console.log('✅ User updated with referral reward:', {
      new_inventory: updatedUser.inventory,
      new_gold: updatedUser.gold,
      new_referrals: updatedUser.total_referrals,
      new_mining_power: updatedUser.total_mining_power
    });
    
    // Create referral record
    try {
      await client.query(`
        INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [address, 'MANUAL_REWARD_FOR_VALID_TEST', 0.01, 'sol', 'completed']);
      
      console.log('✅ Referral record created');
    } catch (e) {
      console.log('ℹ️ Referral record creation failed (might already exist):', e.message);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Manual referral reward given successfully!',
      reward_details: {
        silver_pickaxe_added: 1,
        gold_added: 100,
        total_referrals: updatedReferrals,
        sol_reward_earned: 0.01
      },
      user_address: address.slice(0, 8) + '...',
      note: 'This was for your valid referral test that got lost in the database clearing'
    });
    
  } catch (error) {
    console.error('❌ Manual reward error:', error);
    return res.json({
      success: false,
      error: error.message,
      message: 'Failed to give manual reward'
    });
  }
}