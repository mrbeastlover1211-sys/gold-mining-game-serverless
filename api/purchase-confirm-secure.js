// 🔒 SECURE PICKAXE PURCHASE CONFIRMATION
// Verifies real Solana transactions - prevents fake purchases

import { getUserOptimized, saveUserOptimized } from '../database.js';
import { verifyTransaction } from './verify-transaction.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

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
  // CORS headers
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
    console.log('🔒 SECURE pickaxe purchase confirmation...');

    const { address, pickaxeType, signature, quantity } = req.body || {};
    
    // Validation
    if (!address || !pickaxeType || !PICKAXES[pickaxeType] || !signature) {
      return res.status(400).json({ error: 'address, pickaxeType, signature required' });
    }
    
    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));
    const pickaxe = PICKAXES[pickaxeType];
    
    console.log(`🔒 Verifying ${qty}x ${pickaxeType} purchase for ${address.slice(0, 8)}...`);

    // 🔒 CRITICAL: Verify treasury is configured
    const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY;
    if (!TREASURY_PUBLIC_KEY) {
      console.error('❌ TREASURY_PUBLIC_KEY not configured!');
      return res.status(500).json({ error: 'Server configuration error: treasury not set' });
    }

    // 🔒 CRITICAL: Verify the transaction on-chain
    const expectedAmount = Math.round(pickaxe.costSol * qty * LAMPORTS_PER_SOL);
    
    console.log('🔍 Verifying transaction on blockchain...');
    const verification = await verifyTransaction(
      signature,
      address,
      TREASURY_PUBLIC_KEY,
      expectedAmount,
      `pickaxe_${pickaxeType}`
    );

    if (!verification.valid) {
      console.log('❌ Transaction verification FAILED:', verification.error);
      return res.status(400).json({ 
        error: verification.error,
        details: 'Transaction could not be verified on the blockchain'
      });
    }

    console.log('✅ Transaction verified on blockchain!');

    // Get or create user
    let user = await getUserOptimized(address, false);
    
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
      };
    }

    // Update pickaxe inventory
    const pickaxeKey = `${pickaxeType}_pickaxes`;
    user[pickaxeKey] = (user[pickaxeKey] || 0) + qty;
    
    // Update mining power
    const oldPower = user.total_mining_power || 0;
    const addedPower = pickaxe.ratePerSec * 60 * qty;
    user.total_mining_power = oldPower + addedPower;
    user.last_activity = nowSec();

    console.log(`⛏️ Adding ${qty}x ${pickaxeType} pickaxe(s) - Power: ${oldPower.toFixed(2)} → ${user.total_mining_power.toFixed(2)}`);

    // Save to database
    const saveSuccess = await saveUserOptimized(address, user);
    if (!saveSuccess) {
      throw new Error('Failed to save user data');
    }
    
    console.log(`✅ SECURE purchase completed successfully!`);
    
    // Check for Netherite Challenge bonus (same logic as before)
    let referralBonus = null;
    if (pickaxeType === 'netherite') {
      console.log('🔥 Netherite purchase - checking for challenge bonus...');
      
      try {
        const { sql } = await import('../database.js');
        const cookies = req.headers.cookie || '';
        const sessionMatch = cookies.match(/referral_session=([^;]+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : null;
        
        if (sessionId) {
          const challengeCheck = await sql`
            SELECT 
              rv.referrer_address,
              nc.id as challenge_id,
              EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - nc.challenge_started_at)) as seconds_elapsed
            FROM referral_visits rv
            INNER JOIN netherite_challenges nc ON rv.netherite_challenge_id = nc.id
            WHERE rv.session_id = ${sessionId}
              AND nc.is_active = true
              AND nc.challenge_expires_at > CURRENT_TIMESTAMP
              AND rv.purchased_netherite = false
          `;
          
          if (challengeCheck.length > 0) {
            const challenge = challengeCheck[0];
            console.log('🎁 Netherite Challenge active! Awarding bonus...');
            
            // Mark as purchased (on the visit) so we can't award twice for same session
            await sql`
              UPDATE referral_visits
              SET purchased_netherite = true, netherite_purchase_time = CURRENT_TIMESTAMP
              WHERE session_id = ${sessionId}
            `;

            // ✅ Correct Netherite Challenge reward: award the REFERRER +1 netherite pickaxe
            const referrerAddress = challenge.referrer_address;
            console.log('🎁 Awarding FREE Netherite pickaxe to referrer:', referrerAddress.slice(0, 8) + '...');

            let referrerUser = await getUserOptimized(referrerAddress, false);
            if (!referrerUser) {
              referrerUser = {
                address: referrerAddress,
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
              };
            }

            const referrerOldNetherite = parseInt(referrerUser.netherite_pickaxes || 0, 10);
            referrerUser.netherite_pickaxes = referrerOldNetherite + 1;
            referrerUser.total_mining_power = parseFloat(referrerUser.total_mining_power || 0) + 1000;
            referrerUser.last_activity = nowSec();

            await saveUserOptimized(referrerAddress, referrerUser);

            await sql`
              UPDATE netherite_challenges
              SET bonus_awarded = true,
                  referred_user_address = ${address},
                  referred_purchase_time = CURRENT_TIMESTAMP
              WHERE id = ${challenge.challenge_id}
            `;

            referralBonus = {
              awarded: true,
              reward: 'referrer_netherite_pickaxe',
              referrer: referrerAddress,
              timeElapsed: Math.floor(challenge.seconds_elapsed)
            };

            console.log('✅ Netherite Challenge reward complete: referrer received +1 netherite pickaxe');
          }
        }
      } catch (bonusError) {
        console.error('⚠️ Bonus check error:', bonusError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully purchased ${qty}x ${pickaxeType} pickaxe(s)!`,
      pickaxeType,
      quantity: qty,
      newInventory: {
        silver: user.silver_pickaxes || 0,
        gold: user.gold_pickaxes || 0,
        diamond: user.diamond_pickaxes || 0,
        netherite: user.netherite_pickaxes || 0,
      },
      miningPower: user.total_mining_power,
      verified: true,
      transactionSignature: signature,
      referralBonus
    });

  } catch (e) {
    console.error('❌ Secure purchase error:', e);
    return res.status(500).json({
      error: 'Purchase verification failed',
      message: e.message
    });
  }
}
