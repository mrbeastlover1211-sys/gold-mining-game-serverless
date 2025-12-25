// 🚀 MANUAL TRIGGER REFERRAL - Force complete a referral
import { pool, getUserOptimized, saveUserOptimized } from '../database.js';

export default async function handler(req, res) {
  try {
    const { referredAddress } = req.query;
    
    if (!referredAddress) {
      return res.status(400).json({ error: 'referredAddress parameter required' });
    }
    
    console.log('🚀 Manually triggering referral for:', referredAddress);
    
    const client = await pool.connect();
    
    try {
      // Find the referral visit
      const visit = await client.query(`
        SELECT * FROM referral_visits 
        WHERE converted_address = $1 
        AND converted = true
        ORDER BY converted_timestamp DESC
        LIMIT 1
      `, [referredAddress]);
      
      if (visit.rows.length === 0) {
        return res.json({
          success: false,
          error: 'No referral visit found for this address'
        });
      }
      
      const referrerAddress = visit.rows[0].referrer_address;
      
      console.log('🔍 Found referrer:', referrerAddress);
      
      // Check if already rewarded
      const alreadyRewarded = await client.query(`
        SELECT * FROM referrals 
        WHERE referred_address = $1 
        AND status IN ('completed', 'active', 'completed_referral')
      `, [referredAddress]);
      
      if (alreadyRewarded.rows.length > 0) {
        return res.json({
          success: false,
          error: 'Referral already completed and rewarded'
        });
      }
      
      // Get referred user data
      const referredUser = await client.query(`
        SELECT has_land, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes
        FROM users WHERE address = $1
      `, [referredAddress]);
      
      if (referredUser.rows.length === 0) {
        return res.json({
          success: false,
          error: 'Referred user not found'
        });
      }
      
      const hasLand = referredUser.rows[0].has_land;
      const totalPickaxes = (referredUser.rows[0].silver_pickaxes || 0) +
                            (referredUser.rows[0].gold_pickaxes || 0) +
                            (referredUser.rows[0].diamond_pickaxes || 0) +
                            (referredUser.rows[0].netherite_pickaxes || 0);
      
      if (!hasLand || totalPickaxes === 0) {
        return res.json({
          success: false,
          error: 'Referred user does not meet requirements (needs land + pickaxe)',
          has_land: hasLand,
          total_pickaxes: totalPickaxes
        });
      }
      
      // Get referrer data
      const referrerData = await getUserOptimized(referrerAddress, false);
      
      if (!referrerData) {
        return res.json({
          success: false,
          error: 'Referrer not found'
        });
      }
      
      // Give reward (ensure numeric conversion)
      const currentReferrals = referrerData.total_referrals || 0;
      const rewardPickaxeType = 'silver';
      const rewardPickaxeCount = 1;
      
      referrerData.total_referrals = currentReferrals + 1;
      referrerData.referral_rewards_earned = parseFloat(referrerData.referral_rewards_earned || 0) + 0.01;
      referrerData.silver_pickaxes = parseInt(referrerData.silver_pickaxes || 0) + rewardPickaxeCount;
      referrerData.total_mining_power = parseInt(referrerData.total_mining_power || 0) + 1;
      
      await saveUserOptimized(referrerAddress, referrerData);
      
      // Create referral record (use 'completed' status)
      await client.query(`
        INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [referrerAddress, referredAddress, 0.01, 'sol', 'completed']);
      
      console.log('✅ Referral manually completed!');
      
      return res.json({
        success: true,
        message: 'Referral manually completed!',
        referrer_address: referrerAddress,
        referred_address: referredAddress,
        reward: {
          pickaxe_type: rewardPickaxeType,
          pickaxe_count: rewardPickaxeCount,
          new_referral_count: referrerData.total_referrals
        }
      });
      
    } catch (queryError) {
      throw queryError;
    } finally {
      if (client) client.release();
    }
    
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    if (client) client.release();
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}
