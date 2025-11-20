// 🧪 MANUAL REFERRAL TEST - Simulate the exact flow
export default async function handler(req, res) {
  try {
    console.log('🧪 Testing manual referral flow...');
    
    const { method, body, query } = req;
    
    if (method === 'POST') {
      const { referrerAddress, referredAddress } = body;
      
      console.log('📝 Processing manual referral:', {
        referrer: referrerAddress?.slice(0, 8) + '...',
        referred: referredAddress?.slice(0, 8) + '...'
      });
      
      // Import database functions
      const { createReferral, getReferralStats } = await import('../database.js');
      
      // Get stats before
      const statsBefore = await getReferralStats(referrerAddress);
      console.log('📊 Stats before referral:', statsBefore);
      
      // Create the referral
      const referralResult = await createReferral(
        referrerAddress,
        referredAddress, 
        0.01, // reward amount
        'sol'  // reward type
      );
      
      console.log('🎁 Referral creation result:', referralResult);
      
      // Get stats after
      const statsAfter = await getReferralStats(referrerAddress);
      console.log('📊 Stats after referral:', statsAfter);
      
      return res.json({
        success: true,
        test_type: 'manual_referral_creation',
        referrer: referrerAddress?.slice(0, 8) + '...',
        referred: referredAddress?.slice(0, 8) + '...',
        stats_before: statsBefore,
        referral_result: referralResult,
        stats_after: statsAfter,
        reward_triggered: statsAfter?.stats?.total_referrals > (statsBefore?.stats?.total_referrals || 0)
      });
    }
    
    // GET request - test current state
    const { address } = query;
    
    if (address) {
      const { getReferralStats, getUserOptimized } = await import('../database.js');
      
      // Get referral stats
      const referralStats = await getReferralStats(address);
      
      // Get user data
      const userData = await getUserOptimized(address);
      
      return res.json({
        success: true,
        test_type: 'get_current_state',
        address: address.slice(0, 8) + '...',
        referral_stats: referralStats,
        user_data: {
          exists: !!userData,
          has_land: userData?.has_land || false,
          total_mining_power: userData?.total_mining_power || 0,
          inventory: userData?.inventory || {}
        }
      });
    }
    
    return res.json({
      success: true,
      message: 'Manual referral test endpoint',
      instructions: {
        'POST': 'Send {"referrerAddress": "67ag...", "referredAddress": "NEW_USER"} to test referral creation',
        'GET with ?address=67ag...': 'Check current state of an address'
      }
    });
    
  } catch (error) {
    console.error('❌ Manual referral test error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}