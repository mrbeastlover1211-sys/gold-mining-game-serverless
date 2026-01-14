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
    const landCostSOL = 0.001; // Must match api/purchase-land.js
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
        // Check if this is a referred purchase (using correct column names)
        const referralCheck = await sql`
          SELECT 
            referrer_address,
            converted,
            visit_timestamp
          FROM referral_visits
          WHERE session_id = ${sessionId}
            AND (converted = false OR converted IS NULL)
          LIMIT 1
        `;
        
        console.log('🔍 Referral check result:', {
          found: referralCheck.length > 0,
          sessionId: sessionId.slice(0, 20) + '...'
        });
        
        if (referralCheck.length > 0) {
          const referral = referralCheck[0];
          console.log('🎁 Referral found! Processing rewards...', {
            referrer: referral.referrer_address.slice(0, 8) + '...',
            newUser: address.slice(0, 8) + '...'
          });
          
          // Update referral record (using correct column names)
          await sql`
            UPDATE referral_visits
            SET 
              converted = true,
              converted_address = ${address},
              converted_timestamp = CURRENT_TIMESTAMP
            WHERE session_id = ${sessionId}
          `;
          
          // Award bonus to NEW USER ONLY (referrer gets reward when they buy pickaxe)
          const bonusAmount = 1000; // 1k gold bonus for new user
          
          // Fetch fresh user data (since we saved it above)
          const freshUser = await getUserOptimized(address, false);
          if (!freshUser) {
            throw new Error('Could not fetch user data after land grant');
          }
          
          // Give bonus to new user (buyer) only
          freshUser.last_checkpoint_gold = parseFloat(freshUser.last_checkpoint_gold || 0) + bonusAmount;
          freshUser.checkpoint_timestamp = nowSec(); // Update timestamp
          
          console.log(`🎁 Adding ${bonusAmount} gold to user. Current gold: ${freshUser.last_checkpoint_gold}`);
          
          await saveUserOptimized(address, freshUser);
          console.log(`✅ Referral bonus awarded to new user: ${bonusAmount.toLocaleString()} gold`);
          console.log(`💰 User now has ${freshUser.last_checkpoint_gold} gold total`);
          console.log(`ℹ️ Referrer will receive pickaxe + 100 gold when new user buys a pickaxe`);
          
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

    // Get final user state to return (might have referral bonus added)
    const finalUser = await getUserOptimized(address, false);
    
    return res.status(200).json({
      success: true,
      message: 'Land purchase verified and granted!',
      hasLand: true,
      landType: 'basic',
      verified: true,
      transactionSignature: signature,
      referralBonus,
      gold: finalUser?.last_checkpoint_gold || 0,
      checkpoint: {
        last_checkpoint_gold: finalUser?.last_checkpoint_gold || 0,
        checkpoint_timestamp: finalUser?.checkpoint_timestamp || nowSec(),
        total_mining_power: finalUser?.total_mining_power || 0
      }
    });

  } catch (e) {
    console.error('❌ Secure land purchase error:', e);
    return res.status(500).json({
      error: 'Land purchase verification failed',
      message: e.message
    });
  }
}
