// Simplified purchase-confirm API that should work
import { getUserOptimized, saveUserOptimized } from '../database.js';

const PICKAXES = {
  silver: { name: 'Silver', costSol: 0.001, ratePerSec: 1/60 },
  gold: { name: 'Gold', costSol: 0.001, ratePerSec: 10/60 },
  diamond: { name: 'Diamond', costSol: 0.001, ratePerSec: 100/60 },
  netherite: { name: 'Netherite', costSol: 0.001, ratePerSec: 1000/60 },
};

function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

export default async function handler(req, res) {
  // CORS headers - CRITICAL for cookie handling with Netherite Challenge
  const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Starting simplified purchase confirmation...');

    const { address, pickaxeType, signature, quantity } = req.body || {};
    if (!address || !pickaxeType || !PICKAXES[pickaxeType] || !signature) {
      return res.status(400).json({ error: 'address, pickaxeType, signature required' });
    }
    
    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));
    console.log(`⚡ Purchase request: ${qty}x ${pickaxeType} for ${address.slice(0, 8)}...`);

    // Get user data
    let user = await getUserOptimized(address, false);
    console.log(`📊 User lookup result:`, { found: !!user, has_land: user?.has_land });
    
    if (!user) {
      console.log('📝 Creating new user...');
      user = {
        address: address,
        has_land: false,
        land_purchase_date: null,
        land_type: 'basic',
        silver_pickaxes: 0,
        gold_pickaxes: 0,
        diamond_pickaxes: 0,
        netherite_pickaxes: 0,
        total_mining_power: 0,
        checkpoint_timestamp: nowSec(),
        last_checkpoint_gold: 0,
        last_activity: nowSec(),
        total_gold_mined: 0,
        total_sol_spent: 0,
        total_sol_earned: 0,
        total_pickaxes_bought: 0,
        play_time_minutes: 0,
        login_streak: 0,
        total_logins: 1,
        player_level: 1,
        experience_points: 0,
        total_referrals: 0,
        suspicious_activity_count: 0,
        referrer_address: null,
        referral_rewards_earned: 0
      };
    }
    
    // Add pickaxe
    const currentCount = user[`${pickaxeType}_pickaxes`] || 0;
    user[`${pickaxeType}_pickaxes`] = currentCount + qty;
    user.last_activity = nowSec();
    
    // Calculate new mining power (FIXED: netherite = 10000, not 1000)
    user.total_mining_power = 
      (user.silver_pickaxes || 0) * 1 +
      (user.gold_pickaxes || 0) * 10 +
      (user.diamond_pickaxes || 0) * 100 +
      (user.netherite_pickaxes || 0) * 1000;
    
    console.log(`🛒 Updated inventory:`, {
      silver: user.silver_pickaxes,
      gold: user.gold_pickaxes,
      diamond: user.diamond_pickaxes,
      netherite: user.netherite_pickaxes,
      total_power: user.total_mining_power
    });
    
    // Save user
    console.log(`💾 Saving user data...`);
    const saveSuccess = await saveUserOptimized(address, user);
    
    if (!saveSuccess) {
      throw new Error('Failed to save user data');
    }
    
    console.log(`✅ Purchase completed successfully!`);
    
    // 🔥 Check for Netherite Challenge bonus if buying Netherite
    if (pickaxeType === 'netherite') {
      console.log('🔥 Netherite purchase detected! Checking for active challenge...');
      
      try {
        // Use the shared pool from database.js
        const { pool } = await import('../database.js');
        
        if (!pool) {
          console.error('⚠️ Database pool not available');
          return;
        }
        
        const client = await pool.connect();
        
        try {
          // Get session ID from cookie
          const cookies = req.headers.cookie || '';
          const sessionMatch = cookies.match(/referral_session=([^;]+)/);
          const sessionId = sessionMatch ? sessionMatch[1] : null;
          
          console.log('🍪 Cookie header:', cookies ? 'EXISTS' : 'MISSING');
          console.log('🍪 Session ID:', sessionId ? sessionId.slice(0, 20) + '...' : 'NOT FOUND');
          
          if (sessionId) {
            console.log('✅ Session ID found, querying for Netherite Challenge...');
            
            // Find referral visit with active challenge
            // NOTE: We DON'T check bonus_claimed = false because multiple people can earn bonus!
            const challengeCheck = await client.query(`
              SELECT 
                rv.referrer_address,
                rv.purchased_netherite,
                nc.id as challenge_id,
                nc.challenge_started_at,
                nc.challenge_expires_at,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - nc.challenge_started_at)) as seconds_elapsed
              FROM referral_visits rv
              INNER JOIN netherite_challenges nc ON rv.netherite_challenge_id = nc.id
              WHERE rv.session_id = $1
                AND nc.is_active = true
                AND nc.challenge_expires_at > CURRENT_TIMESTAMP
                AND rv.purchased_netherite = false
            `, [sessionId]);
            
            console.log('📊 Challenge query result:', {
              rowsFound: challengeCheck.rows.length,
              data: challengeCheck.rows[0] || 'NONE'
            });
            
            if (challengeCheck.rows.length > 0) {
              const challenge = challengeCheck.rows[0];
              const secondsElapsed = parseFloat(challenge.seconds_elapsed);
              const withinTimeLimit = secondsElapsed <= 3600; // 1 hour
              
              console.log('⏰ Time check:', {
                secondsElapsed,
                withinTimeLimit,
                timeLimit: 3600
              });
              
              if (withinTimeLimit) {
                console.log('🔥 BONUS TRIGGERED! Giving referrer FREE Netherite!');
                
                // Get referrer's data
                const referrerData = await getUserOptimized(challenge.referrer_address, false);
                
                if (referrerData) {
                  // Give referrer +1 Netherite pickaxe
                  referrerData.netherite_pickaxes = (referrerData.netherite_pickaxes || 0) + 1;
                  referrerData.total_mining_power = 
                    (referrerData.silver_pickaxes || 0) * 1 +
                    (referrerData.gold_pickaxes || 0) * 10 +
                    (referrerData.diamond_pickaxes || 0) * 100 +
                    (referrerData.netherite_pickaxes || 0) * 1000;
                  
                  await saveUserOptimized(challenge.referrer_address, referrerData);
                  
                  // Mark challenge as awarded (but DON'T set bonus_claimed to allow multiple bonuses!)
                  await client.query(`
                    UPDATE netherite_challenges
                    SET bonus_awarded = true
                    WHERE id = $1
                  `, [challenge.challenge_id]);
                  
                  // Update visit record
                  await client.query(`
                    UPDATE referral_visits
                    SET purchased_netherite = true,
                        netherite_purchase_time = CURRENT_TIMESTAMP
                    WHERE session_id = $1
                  `, [sessionId]);
                  
                  console.log('✅ Netherite bonus awarded to referrer:', challenge.referrer_address.slice(0, 8) + '...');
                  console.log('🎉 Referrer now has', referrerData.netherite_pickaxes, 'Netherite pickaxes!');
                } else {
                  console.error('⚠️ Could not find referrer data');
                }
              } else {
                console.log('⏰ Purchase was outside 1-hour window. No bonus awarded.');
              }
            } else {
              console.log('ℹ️ No active Netherite Challenge found for this session');
            }
          } else {
            console.log('ℹ️ No referral session cookie found');
          }
        } finally {
          client.release();
        }
      } catch (challengeError) {
        console.error('⚠️ Netherite Challenge check failed (non-critical):', challengeError);
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
    
    return res.json({ 
      ok: true,
      status: 'confirmed',
      pickaxeType,
      quantity: qty,
      inventory: inventory,
      totalRate: user.total_mining_power,
      gold: parseFloat(user.last_checkpoint_gold || 0),
      checkpoint: {
        total_mining_power: user.total_mining_power,
        checkpoint_timestamp: user.checkpoint_timestamp,
        last_checkpoint_gold: user.last_checkpoint_gold || 0
      }
    });
    
  } catch (e) {
    console.error('❌ Simplified purchase error:', e.message);
    console.error('❌ Stack:', e.stack);
    
    return res.status(500).json({ 
      error: 'Purchase confirmation failed: ' + e.message,
      details: e.message,
      stack: e.stack?.split('\n').slice(0, 3)
    });
  }
}