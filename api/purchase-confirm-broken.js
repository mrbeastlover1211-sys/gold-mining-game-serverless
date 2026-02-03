// Simplified purchase-confirm API that should work
import { getUserOptimized, saveUserOptimized } from '../database.js';

const PICKAXES = {
  silver: { name: 'Silver', costSol: 0.01, ratePerSec: 1/60 },
  gold: { name: 'Gold', costSol: 0.01, ratePerSec: 10/60 },
  diamond: { name: 'Diamond', costSol: 0.01, ratePerSec: 100/60 },
  netherite: { name: 'Netherite', costSol: 0.01, ratePerSec: 1000/60 },
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
    
    // Track if Netherite bonus was awarded (to skip regular reward)
    const netheriteBonus = { awarded: false, sessionId: null };
    console.log('🔍 Initial netheriteBonus state:', netheriteBonus);
    
    // 🔥 Check for Netherite Challenge bonus if buying Netherite
    if (pickaxeType === 'netherite') {
// DISABLED:       console.log('🔥 Netherite purchase detected! Checking for active challenge...');
// DISABLED:       
// DISABLED:       try {
// DISABLED:         // Use the shared pool from database.js
// DISABLED:         const { sql } = await import('../database.js');
// DISABLED:         
// DISABLED:         if (!pool) {
// DISABLED:           console.error('⚠️ Database pool not available');
// DISABLED:           return;
// DISABLED:         }
// DISABLED:         
// DISABLED:     // Neon Serverless - no pool.connect needed
// DISABLED:         
// DISABLED:         try {
// DISABLED:           // Get session ID from cookie
// DISABLED:           const cookies = req.headers.cookie || '';
// DISABLED:           const sessionMatch = cookies.match(/referral_session=([^;]+)/);
// DISABLED:           const sessionId = sessionMatch ? sessionMatch[1] : null;
// DISABLED:           
// DISABLED:           console.log('🍪 Cookie header:', cookies ? 'EXISTS' : 'MISSING');
// DISABLED:           console.log('🍪 Session ID:', sessionId ? sessionId.slice(0, 20) + '...' : 'NOT FOUND');
// DISABLED:           
// DISABLED:           if (sessionId) {
// DISABLED:             console.log('✅ Session ID found, querying for Netherite Challenge...');
// DISABLED:             
// DISABLED:             // Find referral visit with active challenge
// DISABLED:             // NOTE: We DON'T check bonus_claimed = false because multiple people can earn bonus!
// DISABLED:             const challengeCheck = await client.query(`
// DISABLED:               SELECT 
// DISABLED:                 rv.referrer_address,
// DISABLED:                 rv.purchased_netherite,
// DISABLED:                 nc.id as challenge_id,
// DISABLED:                 nc.challenge_started_at,
// DISABLED:                 nc.challenge_expires_at,
// DISABLED:                 EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - nc.challenge_started_at)) as seconds_elapsed
// DISABLED:               FROM referral_visits rv
// DISABLED:               INNER JOIN netherite_challenges nc ON rv.netherite_challenge_id = nc.id
// DISABLED:               WHERE rv.session_id = $1
// DISABLED:                 AND nc.is_active = true
// DISABLED:                 AND nc.challenge_expires_at > CURRENT_TIMESTAMP
// DISABLED:                 AND rv.purchased_netherite = false
// DISABLED:             `, [sessionId]);
// DISABLED:             
// DISABLED:             console.log('📊 Challenge query result:', {
// DISABLED:               rowsFound: challengeCheck.rows.length,
// DISABLED:               data: challengeCheck.rows[0] || 'NONE'
// DISABLED:             });
// DISABLED:             
// DISABLED:             if (challengeCheck.rows.length > 0) {
// DISABLED:               const challenge = challengeCheck.rows[0];
// DISABLED:               const secondsElapsed = parseFloat(challenge.seconds_elapsed);
// DISABLED:               const withinTimeLimit = secondsElapsed <= 3600; // 1 hour
// DISABLED:               
// DISABLED:               console.log('⏰ Time check:', {
// DISABLED:                 secondsElapsed,
// DISABLED:                 withinTimeLimit,
// DISABLED:                 timeLimit: 3600
// DISABLED:               });
// DISABLED:               
// DISABLED:               if (withinTimeLimit) {
// DISABLED:                 console.log('🔥 BONUS TRIGGERED! Giving referrer FREE Netherite!');
// DISABLED:                 
// DISABLED:                 // Get referrer's data
// DISABLED:                 console.log('🔍 Looking up referrer:', challenge.referrer_address);
// DISABLED:                 const referrerData = await getUserOptimized(challenge.referrer_address, false);
// DISABLED:                 console.log('📊 Referrer data found:', referrerData ? 'YES' : 'NO');
// DISABLED:                 
// DISABLED:                 if (!referrerData) {
// DISABLED:                   console.error('❌ CRITICAL: Referrer not found in database!');
// DISABLED:                   console.error('   Referrer address:', challenge.referrer_address);
// DISABLED:                   console.error('   This should not happen - referrer must exist to have created challenge');
// DISABLED:                   
// DISABLED:                   // Still mark bonus as awarded to prevent double reward
// DISABLED:                   netheriteBonus.awarded = true;
// DISABLED:                   netheriteBonus.sessionId = sessionId;
// DISABLED:                 }
// DISABLED:                 
// DISABLED:                 if (referrerData) {
// DISABLED:                   // Give referrer +1 Netherite pickaxe
// DISABLED:                   referrerData.netherite_pickaxes = (referrerData.netherite_pickaxes || 0) + 1;
// DISABLED:                   referrerData.total_mining_power = 
// DISABLED:                     (referrerData.silver_pickaxes || 0) * 1 +
// DISABLED:                     (referrerData.gold_pickaxes || 0) * 10 +
// DISABLED:                     (referrerData.diamond_pickaxes || 0) * 100 +
// DISABLED:                     (referrerData.netherite_pickaxes || 0) * 1000;
// DISABLED:                   
// DISABLED:                   await saveUserOptimized(challenge.referrer_address, referrerData);
// DISABLED:                   
// DISABLED:                   // Mark challenge as awarded (but DON'T set bonus_claimed to allow multiple bonuses!)
// DISABLED:                   await client.query(`
// DISABLED:                     UPDATE netherite_challenges
// DISABLED:                     SET bonus_awarded = true
// DISABLED:                     WHERE id = $1
// DISABLED:                   `, [challenge.challenge_id]);
// DISABLED:                   
// DISABLED:                   // Update visit record
// DISABLED:                   await client.query(`
// DISABLED:                     UPDATE referral_visits
// DISABLED:                     SET purchased_netherite = true,
// DISABLED:                         netherite_purchase_time = CURRENT_TIMESTAMP
// DISABLED:                     WHERE session_id = $1
// DISABLED:                   `, [sessionId]);
// DISABLED:                   
// DISABLED:                   console.log('✅ Netherite bonus awarded to referrer:', challenge.referrer_address.slice(0, 8) + '...');
// DISABLED:                   console.log('🎉 Referrer now has', referrerData.netherite_pickaxes, 'Netherite pickaxes!');
// DISABLED:                   
// DISABLED:                   // IMPORTANT: Mark this session to skip regular referral reward
// DISABLED:                   netheriteBonus.awarded = true;
// DISABLED:                   netheriteBonus.sessionId = sessionId;
// DISABLED:                   console.log('✅ Set netheriteBonus.awarded = true');
// DISABLED:                   console.log('🔍 netheriteBonus state after award:', netheriteBonus);
// DISABLED:                 } else {
// DISABLED:                   console.error('⚠️ Could not find referrer data');
// DISABLED:                 }
// DISABLED:               } else {
// DISABLED:                 console.log('⏰ Purchase was outside 1-hour window. No bonus awarded.');
// DISABLED:               }
// DISABLED:             } else {
// DISABLED:               console.log('ℹ️ No active Netherite Challenge found for this session');
// DISABLED:             }
// DISABLED:           } else {
// DISABLED:             console.log('ℹ️ No referral session cookie found');
// DISABLED:           }
// DISABLED:         } finally {
// DISABLED:         }
// DISABLED:       } catch (challengeError) {
// DISABLED:         console.error('⚠️ Netherite Challenge check failed (non-critical):', challengeError);
// DISABLED:       }
// DISABLED:     }
// DISABLED:     
// DISABLED:     // Auto-trigger referral completion after pickaxe purchase
// DISABLED:     // BUT skip if Netherite bonus was awarded (to avoid double rewards)
// DISABLED:     console.log('🔍 Checking netheriteBonus.awarded before referral completion:', netheriteBonus.awarded);
// DISABLED:     console.log('🔍 Full netheriteBonus object:', JSON.stringify(netheriteBonus));
// DISABLED:     
// DISABLED:     if (netheriteBonus.awarded) {
// DISABLED:       console.log('🔥 Netherite bonus was awarded - SKIPPING regular referral reward to avoid double rewards');
// DISABLED:     } else {
// DISABLED:       console.log('➡️ netheriteBonus.awarded is false, proceeding with regular referral reward');
// DISABLED:       try {
// DISABLED:         // Always use production URL for API-to-API calls (not preview URLs)
// DISABLED:         const productionUrl = process.env.PRODUCTION_URL || 'https://gold-mining-game-serverless.vercel.app';
// DISABLED:         const baseUrl = process.env.NODE_ENV === 'production' ? productionUrl : 'http://localhost:3000';
// DISABLED:         console.log('🎁 Attempting referral completion at:', `${baseUrl}/api/complete-referral`);
// DISABLED:       
// DISABLED:       const completeReferralResponse = await fetch(`${baseUrl}/api/complete-referral`, {
// DISABLED:         method: 'POST',
// DISABLED:         headers: { 'Content-Type': 'application/json' },
// DISABLED:         body: JSON.stringify({ address })
// DISABLED:       });
// DISABLED:       
// DISABLED:       const referralResult = await completeReferralResponse.json();
// DISABLED:       console.log('🎁 Auto-referral completion result:', {
// DISABLED:         status: completeReferralResponse.status,
// DISABLED:         result: referralResult
// DISABLED:       });
// DISABLED:       
// DISABLED:         if (!completeReferralResponse.ok) {
// DISABLED:           console.error('⚠️ Referral completion returned non-OK status:', completeReferralResponse.status);
// DISABLED:         }
// DISABLED:       } catch (referralError) {
// DISABLED:         console.error('⚠️ Auto-referral completion failed (non-critical):', referralError);
// DISABLED:       }
// DISABLED:     }
// DISABLED:     
// DISABLED:     // Create inventory object for response
// DISABLED:     const inventory = {
// DISABLED:       silver: user.silver_pickaxes || 0,
// DISABLED:       gold: user.gold_pickaxes || 0,
// DISABLED:       diamond: user.diamond_pickaxes || 0,
// DISABLED:       netherite: user.netherite_pickaxes || 0
// DISABLED:     };
// DISABLED:     
// DISABLED:     return res.json({ 
// DISABLED:       ok: true,
// DISABLED:       status: 'confirmed',
// DISABLED:       pickaxeType,
// DISABLED:       quantity: qty,
// DISABLED:       inventory: inventory,
// DISABLED:       totalRate: user.total_mining_power,
// DISABLED:       gold: parseFloat(user.last_checkpoint_gold || 0),
// DISABLED:       checkpoint: {
// DISABLED:         total_mining_power: user.total_mining_power,
// DISABLED:         checkpoint_timestamp: user.checkpoint_timestamp,
// DISABLED:         last_checkpoint_gold: user.last_checkpoint_gold || 0
// DISABLED:       }
// DISABLED:     });
// DISABLED:     
// DISABLED:   } catch (e) {
// DISABLED:     console.error('❌ Simplified purchase error:', e.message);
// DISABLED:     console.error('❌ Stack:', e.stack);
// DISABLED:     
// DISABLED:     return res.status(500).json({ 
// DISABLED:       error: 'Purchase confirmation failed: ' + e.message,
// DISABLED:       details: e.message,
// DISABLED:       stack: e.stack?.split('\n').slice(0, 3)
// DISABLED:     });
// DISABLED:   }
// DISABLED: }