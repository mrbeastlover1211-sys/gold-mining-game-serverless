// ✅ COMPLETE REFERRAL - Trigger reward when land + pickaxe purchased
export default async function handler(req, res) {
  try {
    console.log('🎁 Processing referral completion...');
    
    const { method, body } = req;
    
    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { address } = body;
    
    if (!address) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }
    
    console.log('👤 Checking referral completion for:', address.slice(0, 8) + '...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    try {
      // 1. Find referral for this address (converted = true means wallet was linked)
      const pendingReferral = await client.query(`
        SELECT * FROM referral_visits 
        WHERE converted_address = $1 
        AND converted = true
        AND expires_at > CURRENT_TIMESTAMP
      `, [address]);
      
      if (pendingReferral.rows.length === 0) {
        console.log('ℹ️ No pending referral found');
        return res.json({
          success: true,
          referral_completed: false,
          message: 'No pending referral found'
        });
      }
      
      const referralVisit = pendingReferral.rows[0];
      const referrerAddress = referralVisit.referrer_address;
      
      console.log('🔍 Found pending referral:', {
        referrer: referrerAddress.slice(0, 8) + '...',
        referred: address.slice(0, 8) + '...',
        sessionId: referralVisit.session_id.slice(0, 20) + '...'
      });
      
      // 2. Check if referred user has both land and pickaxe
      const userCheck = await client.query(`
        SELECT 
          address, 
          has_land, 
          silver_pickaxes, 
          gold_pickaxes, 
          diamond_pickaxes, 
          netherite_pickaxes,
          total_mining_power
        FROM users 
        WHERE address = $1
      `, [address]);
      
      if (userCheck.rows.length === 0) {
        console.log('ℹ️ Referred user has not purchased land yet');
        return res.json({
          success: true,
          referral_completed: false,
          message: 'Referral pending - user needs to purchase land and pickaxe first',
          requirements_met: false
        });
      }
      
      const userData = userCheck.rows[0];
      const hasLand = userData.has_land;
      
      // 🔧 FIX: Read pickaxes from correct database columns (not inventory JSON)
      const inventory = {
        silver: userData.silver_pickaxes || 0,
        gold: userData.gold_pickaxes || 0,
        diamond: userData.diamond_pickaxes || 0,
        netherite: userData.netherite_pickaxes || 0
      };
      const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
      const hasPickaxe = totalPickaxes > 0;
      
      console.log('📊 User completion status:', {
        hasLand: hasLand,
        hasPickaxe: hasPickaxe,
        inventory: inventory,
        both_requirements_met: hasLand && hasPickaxe
      });
      
      if (!hasLand || !hasPickaxe) {
        console.log('⏳ User hasn\'t completed both requirements yet');
        return res.json({
          success: true,
          referral_completed: false,
          message: 'User needs both land and pickaxe to complete referral',
          requirements: {
            hasLand: hasLand,
            hasPickaxe: hasPickaxe,
            needed: hasLand ? 'pickaxe' : (hasPickaxe ? 'land' : 'both land and pickaxe')
          }
        });
      }
      
      // 3. Check if referrer exists and get their current stats
      const referrerCheck = await client.query(`
        SELECT 
          address, 
          total_referrals, 
          referral_rewards_earned, 
          silver_pickaxes, 
          gold_pickaxes, 
          diamond_pickaxes, 
          netherite_pickaxes,
          last_checkpoint_gold,
          checkpoint_timestamp,
          total_mining_power
        FROM users 
        WHERE address = $1
      `, [referrerAddress]);
      
      if (referrerCheck.rows.length === 0) {
        console.log('❌ Referrer not found in database');
        return res.json({
          success: false,
          error: 'Referrer not found in database'
        });
      }
      
      const referrerData = referrerCheck.rows[0];
      const currentReferrals = referrerData.total_referrals || 0;
      const newReferralCount = currentReferrals + 1;
      
      // 4. Determine tier reward based on total referrals
      let rewardPickaxeType = '';
      let rewardPickaxeCount = 1;
      const goldReward = 100;
      
      if (newReferralCount >= 1 && newReferralCount <= 10) {
        rewardPickaxeType = 'silver';
      } else if (newReferralCount >= 11 && newReferralCount <= 17) {
        rewardPickaxeType = 'gold';
      } else if (newReferralCount >= 18 && newReferralCount <= 24) {
        rewardPickaxeType = 'diamond';
      } else if (newReferralCount >= 25) {
        rewardPickaxeType = 'netherite';
      }
      
      console.log('🏆 Referral tier reward:', {
        currentReferrals: currentReferrals,
        newTotal: newReferralCount,
        rewardPickaxe: rewardPickaxeType,
        goldReward: goldReward
      });
      
      // 5. Update referrer with reward
      const referrerInventory = referrerData.inventory || {};
      const updatedInventory = {
        ...referrerInventory,
        [rewardPickaxeType]: (referrerInventory[rewardPickaxeType] || 0) + rewardPickaxeCount
      };
      
      const pickaxeMiningPower = {
        silver: 1,
        gold: 10,
        diamond: 100,
        netherite: 1000
      };
      const additionalMiningPower = pickaxeMiningPower[rewardPickaxeType] || 0;
      
      const updateReferrerResult = await client.query(`
        UPDATE users 
        SET 
          total_referrals = COALESCE(total_referrals, 0) + 1,
          referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + $1,
          ${rewardPickaxeType}_pickaxes = COALESCE(${rewardPickaxeType}_pickaxes, 0) + $2,
          last_checkpoint_gold = COALESCE(last_checkpoint_gold, 0) + $3,
          total_mining_power = COALESCE(total_mining_power, 0) + $4
        WHERE address = $5
        RETURNING total_referrals, referral_rewards_earned, last_checkpoint_gold, total_mining_power
      `, [
        0.01, // SOL reward amount
        rewardPickaxeCount, // Number of pickaxes to add
        goldReward, // Gold reward amount
        additionalMiningPower, // Mining power from new pickaxes
        referrerAddress
      ]);
      
      console.log('✅ Referrer updated:', updateReferrerResult.rows[0]);
      
      // 6. Mark referral as completed (set completed flag)
      await client.query(`
        UPDATE referral_visits 
        SET completed = true, completed_timestamp = CURRENT_TIMESTAMP
        WHERE session_id = $1
      `, [referralVisit.session_id]);
      
      // 7. Create referral record for tracking
      try {
        await client.query(`
          INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
          VALUES ($1, $2, $3, $4, $5)
        `, [referrerAddress, address, 0.01, 'sol', 'completed']);
        console.log('✅ Referral record created');
      } catch (referralRecordError) {
        console.log('ℹ️ Referral record creation info:', referralRecordError.message);
      }
      
      client.release();
      await pool.end();
      
      return res.json({
        success: true,
        referral_completed: true,
        message: 'Referral completed successfully!',
        referrer_address: referrerAddress,
        referred_address: address,
        reward_details: {
          pickaxe_type: rewardPickaxeType,
          pickaxe_count: rewardPickaxeCount,
          gold_reward: goldReward,
          sol_reward: 0.01,
          new_referral_count: newReferralCount
        },
        session_id: referralVisit.session_id
      });
      
    } catch (queryError) {
      console.error('❌ Database query error:', queryError.message);
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ Complete referral error:', error);
    return res.json({
      success: false,
      error: error.message,
      message: 'Failed to complete referral'
    });
  }
}