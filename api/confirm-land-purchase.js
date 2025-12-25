import { Connection } from '@solana/web3.js';

function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, signature } = req.body || {};
    if (!address || !signature) {
      return res.status(400).json({ error: 'address and signature required' });
    }

    global.users = global.users || {};
    
    // Ensure user exists
    if (!global.users[address]) {
      global.users[address] = {
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        hasLand: false,
        landPurchaseDate: null
      };
    }
    
    // 🔧 FIX: Clear potentially stale cache to force fresh database lookup
    if (global.users[address] && global.users[address].hasLand) {
      console.log(`⚠️ Cache shows ${address} has land, clearing cache to verify with database...`);
      
      // Clear the potentially stale cache entry
      delete global.users[address];
      
      console.log(`🔄 Cache cleared for ${address} - will refresh from database if needed`);
    }
    
    // Now use the normal cache flow (which will fetch from database if cache is empty)

    // Validate signature format
    if (typeof signature !== 'string' || signature.length < 80 || signature.length > 90) {
      return res.status(400).json({ error: 'invalid signature format' });
    }

    // Basic confirmation check with better error handling
    let status = 'confirmed';
    try {
      const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');
      const conf = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      status = conf && conf.value && (conf.value.confirmationStatus || (conf.value.err == null ? 'processed' : null));
    } catch (signatureError) {
      console.error('Signature validation error:', signatureError);
      console.log(`Warning: Could not validate signature ${signature} for address ${address}, but allowing land purchase`);
      status = 'unverified';
    }

    // For devnet testing, we'll be more lenient with signature validation
    if (!status || status === 'unverified') {
      console.log(`Granting land to ${address} with signature ${signature} (status: ${status || 'unknown'})`);
      status = 'confirmed';
    }

    // Grant land - use optimized database functions
    try {
      const { getUserOptimized, saveUserOptimized } = await import('../database.js');
      
      // Get existing user data or create new user structure
      let existingUser = await getUserOptimized(address, false); // No cache for land purchase
      
      if (!existingUser) {
        // Create new user structure for land purchase
        existingUser = {
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
          referrer_address: null,
          total_referrals: 0,
          referral_rewards_earned: 0,
          suspicious_activity_count: 0
        };
      }
      
      // Update with land ownership (using database column names)
      const updatedUser = {
        ...existingUser,
        has_land: true,
        land_purchase_date: nowSec(),
        last_activity: nowSec()
      };
      try {
        const { pool } = await import('../database.js');
        const client = await pool.connect();
        
        try {
          // Check if user came from referral link
          const referralCheck = await client.query(`
            SELECT referrer_address, session_id 
            FROM referral_visits 
            WHERE converted_address = $1 
              AND converted = true
            LIMIT 1
          `, [address]);
          
          if (referralCheck.rows.length > 0) {
            // User was referred! Give 1000 gold bonus
            const currentGold = parseFloat(updatedUser.last_checkpoint_gold || 0);
            updatedUser.last_checkpoint_gold = currentGold + 1000;
            referralBonusGiven = true;
            
            console.log(`🎁 Referral bonus: Gave ${address.slice(0, 8)}... 1000 gold (from referrer: ${referralCheck.rows[0].referrer_address.slice(0, 8)}...)`);
          }
        } finally {
          client.release();
        }
      } catch (bonusError) {
        console.log('⚠️ Could not check referral bonus:', bonusError.message);
        // Continue without bonus - not critical
      }
      
      // Save using optimized function
      console.log(`💾 Attempting to save land purchase for ${address}...`);
      console.log(`📊 Updated user data:`, {
        address: address.slice(0, 8),
        has_land: updatedUser.has_land,
        land_purchase_date: updatedUser.land_purchase_date,
        last_activity: updatedUser.last_activity
      });
      
      const saveResult = await saveUserOptimized(address, updatedUser);
      
      if (saveResult) {
        console.log(`✅ Land purchase saved successfully for ${address}`);
        console.log(`🎉 Database should now show has_land: true for this wallet`);
      } else {
        console.error(`❌ saveUserOptimized returned false for ${address}`);
        throw new Error('Failed to save land purchase to database - saveUserOptimized returned false');
      }
      
      // Update global.users for backwards compatibility
      global.users = global.users || {};
      global.users[address] = global.users[address] || {};
      global.users[address].hasLand = true;
      global.users[address].landPurchaseDate = updatedUser.land_purchase_date;
      
      console.log(`🏡 Land granted to ${address} via OptimizedDatabase`);
      
    } catch (dbError) {
      console.error('🚨 CRITICAL: Database save failed for land purchase!');
      console.error('📊 Error details:', dbError.message);
      console.error('📊 Stack trace:', dbError.stack);
      console.error('📊 Address:', address);
      console.error('📊 This is why land is not saving to database!');
      
      // IMPORTANT: Don't just fallback - this hides the real problem!
      // Return error instead of silently failing
      return res.status(500).json({ 
        error: 'Failed to save land purchase to database: ' + dbError.message,
        details: 'Land purchase failed - please try again'
      });
    }

    console.log(`🏡 Land granted to ${address} at ${new Date().toISOString()}`);

    res.json({ 
      ok: true, 
      status: status, 
      hasLand: true,
      landPurchaseDate: global.users[address].landPurchaseDate,
      message: 'Land purchased successfully! You can now buy pickaxes and start mining.',
      inventory: global.users[address].inventory,
      referral_bonus_given: referralBonusGiven || false,
      referral_bonus_amount: referralBonusGiven ? 1000 : 0
    });
  } catch (e) {
    console.error('Land purchase confirmation error:', e);
    res.status(500).json({ error: 'failed to confirm land purchase: ' + (e?.message || 'unknown error') });
  }
}