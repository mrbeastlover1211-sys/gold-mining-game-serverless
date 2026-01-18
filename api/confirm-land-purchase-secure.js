// 🔒 SECURE LAND PURCHASE CONFIRMATION
// Verifies real Solana transactions - prevents fake land purchases

import { getUserOptimized, saveUserOptimized } from '../database.js';
import { verifyTransaction } from './verify-transaction.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔒 SECURE land purchase confirmation...');
    
    const { address, signature } = req.body || {};
    if (!address || !signature) {
      return res.status(400).json({ error: 'address and signature required' });
    }
    
    console.log(`🔒 Verifying land purchase for ${address.slice(0, 8)}...`);

    // 🔒 CRITICAL: Verify treasury is configured
    const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY;
    if (!TREASURY_PUBLIC_KEY) {
      console.error('❌ TREASURY_PUBLIC_KEY not configured!');
      return res.status(500).json({ error: 'Server configuration error: treasury not set' });
    }

    // 🔒 CRITICAL: Verify the transaction on-chain
    const landCostSOL = 0.01; // Must match api/purchase-land.js
    const expectedAmount = Math.round(landCostSOL * LAMPORTS_PER_SOL);
    
    console.log('🔍 Verifying transaction on blockchain...');
    const verification = await verifyTransaction(
      signature,
      address,
      TREASURY_PUBLIC_KEY,
      expectedAmount,
      'land_purchase'
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
      console.log('📝 Creating new user with land...');
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

    // Check if user already has land
    if (user.has_land) {
      console.log('⚠️ User already owns land!');
      return res.status(400).json({ 
        error: 'You already own land',
        details: 'Each wallet can only purchase land once'
      });
    }

    // Grant land
    user.has_land = true;
    user.land_purchase_date = nowSec();
    user.land_type = 'basic';
    user.last_activity = nowSec();

    console.log(`🏠 Granting land to ${address.slice(0, 8)}...`);

    // Save to database
    const saveSuccess = await saveUserOptimized(address, user);
    if (!saveSuccess) {
      throw new Error('Failed to save user data');
    }

    console.log(`✅ SECURE land purchase completed!`);

    // 🎁 Check for referral bonus
    let referralBonus = null;
    try {
      const { sql } = await import('../database.js');
      const cookies = req.headers.cookie || '';
      const sessionMatch = cookies.match(/referral_session=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : null;
      
      console.log('🍪 Checking referral session for land purchase:', {
        hasSession: !!sessionId,
        sessionId: sessionId ? sessionId.slice(0, 20) + '...' : 'none'
      });
      
      if (sessionId) {
        // Check if this is a referred purchase
        const referralCheck = await sql`
          SELECT 
            referrer_address,
            bonus_claimed,
            visited_at
          FROM referral_visits
          WHERE session_id = ${sessionId}
            AND referee_address IS NULL
          LIMIT 1
        `;
        
        if (referralCheck.length > 0) {
          const referral = referralCheck[0];
          console.log('🎁 Referral found! Processing rewards...');
          
          // Update referral record
          await sql`
            UPDATE referral_visits
            SET 
              referee_address = ${address},
              bonus_claimed = true,
              land_purchased_at = CURRENT_TIMESTAMP
            WHERE session_id = ${sessionId}
          `;
          
          // Award bonus to BOTH users
          const bonusAmount = 100000; // 100k gold
          
          // Give bonus to new user (buyer)
          user.last_checkpoint_gold = (user.last_checkpoint_gold || 0) + bonusAmount;
          await saveUserOptimized(address, user);
          
          // Give bonus to referrer
          const referrer = await getUserOptimized(referral.referrer_address, false);
          if (referrer) {
            referrer.last_checkpoint_gold = (referrer.last_checkpoint_gold || 0) + bonusAmount;
            await saveUserOptimized(referral.referrer_address, referrer);
            console.log(`🎁 Referral bonus awarded to both users: ${bonusAmount.toLocaleString()} gold each`);
          }
          
          referralBonus = {
            awarded: true,
            amount: bonusAmount,
            referrerAddress: referral.referrer_address
          };
        }
      }
    } catch (referralError) {
      console.error('⚠️ Referral bonus error:', referralError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Land purchase verified and granted!',
      hasLand: true,
      landType: 'basic',
      verified: true,
      transactionSignature: signature,
      referralBonus
    });

  } catch (e) {
    console.error('❌ Secure land purchase error:', e);
    return res.status(500).json({
      error: 'Land purchase verification failed',
      message: e.message
    });
  }
}
