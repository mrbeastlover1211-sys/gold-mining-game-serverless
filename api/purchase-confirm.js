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
    
    // Auto-trigger referral completion after pickaxe purchase
    try {
      const baseUrl = `https://${req.headers.host}` || process.env.VERCEL_URL || 'http://localhost:3000';
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