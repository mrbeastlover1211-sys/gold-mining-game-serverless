// Use same working pattern as status.js
import { getUserOptimized, saveUserOptimized } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, pickaxeType, goldCost } = req.body;
    
    console.log(`🛒 Buy request: ${pickaxeType} for ${goldCost} gold from ${address?.slice(0, 8)}...`);
    
    if (!address || !pickaxeType || !goldCost) {
      return res.status(400).json({ error: 'address, pickaxeType, and goldCost required' });
    }

    const validPickaxes = ['silver', 'gold', 'diamond', 'netherite'];
    if (!validPickaxes.includes(pickaxeType)) {
      return res.status(400).json({ error: 'Invalid pickaxe type. Must be silver, gold, diamond, or netherite' });
    }
    
    // Get user data using the same method as status.js
    let user;
    try {
      user = await getUserOptimized(address);
      console.log(`🔍 Buy API getUserOptimized result:`, {
        found: !!user,
        has_land: user?.has_land,
        address: user?.address?.slice(0, 8)
      });
    } catch (dbError) {
      console.error(`❌ Buy API database error:`, dbError.message);
      return res.status(500).json({
        error: 'Database error in buy API',
        details: dbError.message
      });
    }
    
    if (!user) {
      return res.status(400).json({ error: 'User not found. Please connect wallet and refresh.' });
    }

    if (!user.has_land) {
      return res.status(400).json({ error: 'You need to purchase land first!' });
    }
    
    // Calculate current gold using same method as status.js
    const currentTime = Math.floor(Date.now() / 1000);
    const checkpointTime = user.checkpoint_timestamp || currentTime;
    const timeSinceCheckpoint = currentTime - checkpointTime;
    const miningPower = user.total_mining_power || 0;
    const goldPerSecond = miningPower / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const baseGold = parseFloat(user.last_checkpoint_gold || 0);
    const currentGold = baseGold + goldMined;
    
    console.log(`💰 Gold calculation debug:`, {
      baseGold,
      goldMined,
      currentGold,
      timeSinceCheckpoint,
      miningPower,
      goldCost
    });
    
    if (currentGold < goldCost) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${currentGold.toFixed(2)} but need ${goldCost} gold.` 
      });
    }
    
    // Update inventory based on pickaxe type
    const newGold = currentGold - goldCost;
    if (pickaxeType === 'silver') {
      user.silver_pickaxes = (user.silver_pickaxes || 0) + 1;
    } else if (pickaxeType === 'gold') {
      user.gold_pickaxes = (user.gold_pickaxes || 0) + 1;
    } else if (pickaxeType === 'diamond') {
      user.diamond_pickaxes = (user.diamond_pickaxes || 0) + 1;
    } else if (pickaxeType === 'netherite') {
      user.netherite_pickaxes = (user.netherite_pickaxes || 0) + 1;
    }
    
    // Calculate new mining power
    const silverCount = user.silver_pickaxes || 0;
    const goldCount = user.gold_pickaxes || 0;
    const diamondCount = user.diamond_pickaxes || 0;
    const netheriteCount = user.netherite_pickaxes || 0;
    
    const newMiningPower = silverCount * 1 + 
                          goldCount * 10 + 
                          diamondCount * 100 + 
                          netheriteCount * 1000;
    
    // Update user data
    user.total_mining_power = newMiningPower;
    user.checkpoint_timestamp = currentTime;
    user.last_checkpoint_gold = newGold;
    user.last_activity = currentTime;
    
    console.log(`🔄 Updating user after purchase:`, {
      silver: user.silver_pickaxes,
      gold: user.gold_pickaxes,
      newGold: newGold.toFixed(2),
      newMiningPower
    });
    
    // Save user data using same method as status.js
    await saveUserOptimized(address, user);
    
    console.log(`✅ ${address.slice(0, 8)}... bought ${pickaxeType} pickaxe for ${goldCost} gold`);
    
    // 🔥 NETHERITE CHALLENGE: Check if this purchase triggers bonus
    let netheriteChallengeResult = null;
    if (pickaxeType === 'netherite') {
      try {
        console.log('🔥 Netherite purchased! Checking for active challenges...');
        
        const { pool } = await import('../database.js');
        const client = await pool.connect();
        
        try {
          // Get referral session from cookies
          const cookies = req.headers.cookie || '';
          const sessionMatch = cookies.match(/referral_session=([^;]+)/);
          const sessionId = sessionMatch ? sessionMatch[1] : null;
          
          if (sessionId) {
            // Find referral visit with active challenge
            const challengeCheck = await client.query(`
              SELECT 
                rv.referrer_address,
                nc.id as challenge_id,
                nc.challenge_started_at,
                nc.challenge_expires_at,
                nc.bonus_claimed,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - nc.challenge_started_at)) as seconds_elapsed
              FROM referral_visits rv
              INNER JOIN netherite_challenges nc ON rv.netherite_challenge_id = nc.id
              WHERE rv.session_id = $1
                AND nc.is_active = true
                AND nc.bonus_claimed = false
            `, [sessionId]);
            
            if (challengeCheck.rows.length > 0) {
              const challenge = challengeCheck.rows[0];
              const expiresAt = new Date(challenge.challenge_expires_at);
              const now = new Date();
              const withinTimeLimit = now < expiresAt;
              
              console.log('🔥 Challenge found:', {
                referrer: challenge.referrer_address.slice(0, 8) + '...',
                secondsElapsed: challenge.seconds_elapsed,
                withinLimit: withinTimeLimit
              });
              
              if (withinTimeLimit) {
                // 🎉 BONUS! Give referrer FREE Netherite
                console.log('🎉 BONUS TRIGGERED! Giving referrer FREE Netherite!');
                
                const { getUserOptimized, saveUserOptimized } = await import('../database.js');
                const referrerData = await getUserOptimized(challenge.referrer_address);
                
                if (referrerData) {
                  referrerData.netherite_pickaxes = (referrerData.netherite_pickaxes || 0) + 1;
                  referrerData.total_mining_power = (referrerData.total_mining_power || 0) + 1000;
                  
                  await saveUserOptimized(challenge.referrer_address, referrerData);
                  
                  // Mark challenge as claimed
                  await client.query(`
                    UPDATE netherite_challenges
                    SET bonus_claimed = true,
                        bonus_awarded = true,
                        referred_user_address = $1,
                        referred_purchase_time = CURRENT_TIMESTAMP,
                        is_active = false
                    WHERE id = $2
                  `, [address, challenge.challenge_id]);
                  
                  // Update referral visit
                  await client.query(`
                    UPDATE referral_visits
                    SET purchased_netherite = true,
                        netherite_purchase_time = CURRENT_TIMESTAMP
                    WHERE session_id = $1
                  `, [sessionId]);
                  
                  netheriteChallengeResult = {
                    bonus_awarded: true,
                    referrer_address: challenge.referrer_address,
                    seconds_elapsed: Math.floor(challenge.seconds_elapsed),
                    message: '🔥 BONUS! Your referrer received FREE Netherite pickaxe!'
                  };
                  
                  console.log('✅ Netherite bonus awarded to referrer!');
                } else {
                  console.log('⚠️ Referrer data not found');
                }
              } else {
                // ⏰ Too late - regular rewards
                console.log('⏰ Challenge expired - regular rewards will apply');
                
                // Mark as expired
                await client.query(`
                  UPDATE netherite_challenges
                  SET is_active = false,
                      referred_user_address = $1,
                      referred_purchase_time = CURRENT_TIMESTAMP
                  WHERE id = $2
                `, [address, challenge.challenge_id]);
                
                netheriteChallengeResult = {
                  bonus_awarded: false,
                  expired: true,
                  message: '⏰ Challenge time expired - referrer will receive regular rewards'
                };
              }
            }
          }
        } finally {
          client.release();
        }
      } catch (challengeError) {
        console.error('⚠️ Netherite challenge check failed:', challengeError);
      }
    }
    
    // Auto-trigger referral completion after pickaxe purchase
    try {
      // Always use production URL for API-to-API calls (not preview URLs)
      const productionUrl = process.env.PRODUCTION_URL || 'https://gold-mining-game-serverless.vercel.app';
      const baseUrl = process.env.NODE_ENV === 'production' ? productionUrl : 'http://localhost:3000';
      console.log('🎁 Attempting referral completion at:', `${baseUrl}/api/complete-referral`);
      
      const completeReferralResponse = await fetch(`${baseUrl}/api/complete-referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const referralResult = await completeReferralResponse.json();
      console.log('🎁 Auto-referral completion result:', {
        status: completeReferralResponse.status,
        result: referralResult
      });
      
      if (!completeReferralResponse.ok) {
        console.error('⚠️ Referral completion returned non-OK status:', completeReferralResponse.status);
      }
    } catch (referralError) {
      console.error('⚠️ Auto-referral completion failed (non-critical):', referralError);
    }
    
    // Create inventory object for response
    const inventory = {
      silver: user.silver_pickaxes || 0,
      gold: user.gold_pickaxes || 0,
      diamond: user.diamond_pickaxes || 0,
      netherite: user.netherite_pickaxes || 0
    };
    
    const response = {
      success: true,
      newGold: newGold,
      inventory: inventory,
      checkpoint: {
        total_mining_power: newMiningPower,
        checkpoint_timestamp: currentTime,
        last_checkpoint_gold: newGold
      },
      message: `Successfully bought ${pickaxeType} pickaxe for ${goldCost} gold!`
    };
    
    // Add Netherite challenge result if applicable
    if (netheriteChallengeResult) {
      response.netherite_challenge = netheriteChallengeResult;
    }
    
    res.json(response);
    
  } catch (e) {
    console.error('❌ Buy API main catch block error:', e.message);
    console.error('❌ Full error:', e);
    console.error('❌ Stack trace:', e.stack);
    
    res.status(500).json({
      error: 'Buy API error',
      details: e.message,
      stack: e.stack?.split('\n').slice(0, 5)
    });
  }
}