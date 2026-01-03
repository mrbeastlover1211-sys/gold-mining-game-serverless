// ✅ COMPLETE REFERRAL - Neon Serverless Version (NO CONNECTION LEAKS!)
import { sql, getUserOptimized, saveUserOptimized } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🎁 ========================================');
    console.log('🎁 REFERRAL COMPLETION ENDPOINT CALLED');
    console.log('🎁 ========================================');
    
    const { method, body, headers } = req;
    
    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { address } = body;
    
    if (!address) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }
    
    console.log('👤 User address:', address.slice(0, 8) + '...');
    console.log('🌐 Request headers:', JSON.stringify(headers, null, 2));
    
    // 🔧 CRITICAL: Get session from cookies
    const cookies = headers.cookie || '';
    console.log('🍪 Raw cookie header:', cookies || 'EMPTY');
    
    const sessionMatch = cookies.match(/referral_session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;
    
    console.log('🍪 Parsed session ID:', sessionId ? sessionId.slice(0, 20) + '...' : '❌ NOT FOUND');
    
    if (!sessionId) {
      console.log('⚠️ No referral session cookie found - cannot complete referral');
      console.log('   This means either:');
      console.log('   1. User did not come from referral link');
      console.log('   2. Cookie was not forwarded from buy-with-gold.js');
      console.log('   3. Cookie expired or was deleted');
    }
    
    // 1. Find referral for this address using session cookie OR converted address
    let pendingReferral;
    
    if (sessionId) {
      // Try with session cookie first (most reliable)
      pendingReferral = await sql`
        SELECT * FROM referral_visits 
        WHERE session_id = ${sessionId}
        AND expires_at > CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM referrals 
          WHERE referrals.referred_address = ${address}
          AND referrals.status IN ('completed', 'active', 'completed_referral')
        )
      `;
      
      console.log('🔍 Found referral by session cookie:', pendingReferral.length > 0);
    } else {
      // Fallback: try with converted address
      pendingReferral = await sql`
        SELECT * FROM referral_visits 
        WHERE converted_address = ${address}
        AND converted = true
        AND expires_at > CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM referrals 
          WHERE referrals.referred_address = ${address}
          AND referrals.status IN ('completed', 'active', 'completed_referral')
        )
      `;
      
      console.log('🔍 Found referral by converted address:', pendingReferral.length > 0);
    }
    
    if (pendingReferral.length === 0) {
      // Check if referral was already completed
      const alreadyCompleted = await sql`
        SELECT * FROM referrals 
        WHERE referred_address = ${address}
        AND status IN ('completed', 'active', 'completed_referral')
      `;
      
      if (alreadyCompleted.length > 0) {
        console.log('✅ Referral already completed for this user');
        return res.json({
          success: true,
          referral_completed: true,
          already_rewarded: true,
          message: 'Referral was already completed and rewarded',
          referrer_address: alreadyCompleted[0].referrer_address
        });
      }
      
      console.log('ℹ️ No pending referral found - user may not have used a referral link');
      return res.json({
        success: true,
        referral_completed: false,
        message: 'No pending referral found - user did not use a referral link'
      });
    }
    
    const referralVisit = pendingReferral[0];
    const referrerAddress = referralVisit.referrer_address;
    
    console.log('🔍 Found pending referral:', {
      referrer: referrerAddress.slice(0, 8) + '...',
      referred: address.slice(0, 8) + '...',
      sessionId: referralVisit.session_id.slice(0, 20) + '...'
    });
    
    // 🔥 CHECK: Did this user just get a Netherite bonus?
    // If yes, skip regular reward to avoid double rewards
    if (referralVisit.netherite_challenge_id && referralVisit.purchased_netherite === true) {
      console.log('🔥 User purchased Netherite within challenge - checking if bonus was awarded...');
      
      // Check if this purchase triggered the Netherite bonus
      const netheriteCheck = await sql`
        SELECT nc.challenge_started_at,
               EXTRACT(EPOCH FROM (rv.netherite_purchase_time - nc.challenge_started_at)) as seconds_elapsed
        FROM referral_visits rv
        INNER JOIN netherite_challenges nc ON rv.netherite_challenge_id = nc.id
        WHERE rv.session_id = ${referralVisit.session_id}
          AND rv.purchased_netherite = true
      `;
      
      if (netheriteCheck.length > 0) {
        const secondsElapsed = parseFloat(netheriteCheck[0].seconds_elapsed);
        const wasWithinOneHour = secondsElapsed <= 3600;
        
        console.log('⏰ Netherite purchase timing:', {
          secondsElapsed,
          wasWithinOneHour,
          oneHour: 3600
        });
        
        if (wasWithinOneHour) {
          console.log('🔥 Netherite bonus was awarded - SKIPPING regular referral reward to avoid double rewards!');
          
          return res.status(200).json({
            success: true,
            referral_completed: false,
            already_rewarded: true,
            message: 'Netherite Challenge bonus was awarded instead of regular reward',
            netherite_bonus: true
          });
        } else {
          console.log('⏰ Netherite purchased after 1 hour - proceeding with regular reward');
        }
      }
    }
    
    // 2. Check if referred user has both land and pickaxe
    const userCheck = await sql`
      SELECT 
        address, 
        has_land, 
        silver_pickaxes, 
        gold_pickaxes, 
        diamond_pickaxes, 
        netherite_pickaxes,
        total_mining_power
      FROM users 
      WHERE address = ${address}
    `;
    
    if (userCheck.length === 0) {
      console.log('ℹ️ Referred user has not purchased land yet');
      return res.json({
        success: true,
        referral_completed: false,
        message: 'Referral pending - user needs to purchase land and pickaxe first',
        requirements_met: false
      });
    }
    
    const userData = userCheck[0];
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
    
    // 3. Check if referrer exists using same system as status API
    console.log('🔍 Looking for referrer in database:', referrerAddress.slice(0, 8) + '...');
    
    let referrerData;
    try {
      referrerData = await getUserOptimized(referrerAddress, false);
      
      console.log('📊 Referrer lookup result:', {
        found: !!referrerData,
        address: referrerData?.address?.slice(0, 8),
        has_land: referrerData?.has_land,
        pickaxes: {
          silver: referrerData?.silver_pickaxes,
          gold: referrerData?.gold_pickaxes,
          diamond: referrerData?.diamond_pickaxes,
          netherite: referrerData?.netherite_pickaxes
        }
      });
    } catch (dbError) {
      console.error('❌ Error looking up referrer:', dbError.message);
      return res.json({
        success: false,
        error: 'Database error finding referrer'
      });
    }
    
    if (!referrerData) {
      console.log('⚠️ Referrer not found in database - creating new account...');
      
      // Create referrer account automatically
      referrerData = {
        address: referrerAddress,
        has_land: false,
        silver_pickaxes: 0,
        gold_pickaxes: 0,
        diamond_pickaxes: 0,
        netherite_pickaxes: 0,
        total_mining_power: 0,
        last_checkpoint_gold: 0,
        checkpoint_timestamp: Math.floor(Date.now() / 1000),
        total_referrals: 0,
        created_at: new Date().toISOString()
      };
      
      try {
        await saveUserOptimized(referrerAddress, referrerData);
        console.log('✅ Created new referrer account successfully');
      } catch (createError) {
        console.error('❌ Error creating referrer account:', createError.message);
        return res.json({
          success: false,
          error: 'Failed to create referrer account'
        });
      }
    }
    
    const currentReferrals = referrerData.total_referrals || 0;
    const newReferralCount = currentReferrals + 1;
    
    // 4. Determine tier reward based on total referrals
    let rewardPickaxeType = '';
    let rewardPickaxeCount = 1;
    const goldReward = 100; // Gold reward for referrer
    
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
    const pickaxeMiningPower = {
      silver: 1,
      gold: 10,
      diamond: 100,
      netherite: 1000
    };
    const additionalMiningPower = pickaxeMiningPower[rewardPickaxeType] || 0;
    
    // Update referrer using same system as status API
    console.log('🎁 Distributing rewards to referrer...');
    
    // Update referrer data (ensure numeric conversion) - NO SOL REWARD
    referrerData.total_referrals = currentReferrals + 1;
    referrerData[`${rewardPickaxeType}_pickaxes`] = parseInt(referrerData[`${rewardPickaxeType}_pickaxes`] || 0) + rewardPickaxeCount;
    referrerData.last_checkpoint_gold = parseFloat(referrerData.last_checkpoint_gold || 0) + goldReward;
    referrerData.total_mining_power = parseInt(referrerData.total_mining_power || 0) + additionalMiningPower;
    
    // Save updated referrer data
    try {
      await saveUserOptimized(referrerAddress, referrerData);
      console.log('✅ Referrer rewards distributed successfully');
    } catch (saveError) {
      console.error('❌ Error saving referrer rewards:', saveError.message);
      throw saveError;
    }
    
    // NOTE: 1000 gold bonus for new user is now given in confirm-land-purchase.js
    // This ensures they get it immediately when buying land, not when buying pickaxe
    console.log('ℹ️ New user already received 1000 gold bonus when they purchased land');
    
    // 6. Mark referral as completed (use only existing columns)
    await sql`
      UPDATE referral_visits 
      SET 
        converted = true, 
        converted_timestamp = CURRENT_TIMESTAMP
      WHERE session_id = ${referralVisit.session_id}
    `;
    
    // 7. Create referral record for tracking (use 'completed' or 'active' based on schema constraint)
    try {
      await sql`
        INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
        VALUES (${referrerAddress}, ${address}, ${0}, ${'gold'}, ${'completed'})
      `;
      console.log('✅ Referral record created');
    } catch (referralRecordError) {
      // Check if it's a unique constraint violation (23505 = duplicate key)
      if (referralRecordError.code === '23505') {
        console.log('ℹ️ Referral already completed for this user (duplicate prevented by database)');
        return res.json({
          success: true,
          referral_completed: true,
          already_rewarded: true,
          message: 'This user already received referral reward',
          note: 'No duplicate reward given - database constraint prevented it'
        });
      }
      
      // Try with 'active' if 'completed' fails for other reasons
      try {
        await sql`
          INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
          VALUES (${referrerAddress}, ${address}, ${0}, ${'gold'}, ${'active'})
        `;
        console.log('✅ Referral record created with active status');
      } catch (retryError) {
        // Check again for duplicate
        if (retryError.code === '23505') {
          console.log('ℹ️ Referral already completed (duplicate prevented)');
          return res.json({
            success: true,
            referral_completed: true,
            already_rewarded: true,
            message: 'This user already received referral reward'
          });
        }
        console.log('ℹ️ Referral record creation failed:', retryError.message);
      }
    }
    
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
        new_referral_count: referrerData.total_referrals,
        note: 'New user received 1000 gold bonus when they purchased land'
      },
      session_id: referralVisit.session_id
    });
    
  } catch (error) {
    console.error('❌ Complete referral error:', error);
    return res.json({
      success: false,
      error: error.message,
      message: 'Failed to complete referral'
    });
  }
}
