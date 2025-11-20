// 🧪 TEST REFERRAL SYSTEM - Debug what's happening
export default async function handler(req, res) {
  try {
    console.log('🧪 Testing referral system...');
    
    const { method } = req;
    
    if (method === 'POST') {
      // Test manual referral creation
      const { referrerAddress, referredAddress } = req.body || {};
      
      console.log('📝 Manual referral test:', {
        referrer: referrerAddress?.slice(0, 8) + '...',
        referred: referredAddress?.slice(0, 8) + '...'
      });
      
      // Call the actual referral API
      const referralResult = await fetch(`${process.env.VERCEL_URL || 'https://gold-mining-game-serverless.vercel.app'}/api/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          referrerAddress,
          referredAddress,
          rewardAmount: 0.01,
          rewardType: 'sol'
        })
      });
      
      const referralData = await referralResult.text();
      console.log('🎁 Referral API response:', referralData);
      
      return res.json({
        success: true,
        test_type: 'manual_referral_creation',
        referral_api_response: referralData,
        referral_api_status: referralResult.status
      });
    }
    
    // GET - Test referral stats
    const { address, action } = req.query;
    
    if (action === 'simulate') {
      // Simulate the complete referral flow
      console.log('🎮 Simulating complete referral flow...');
      
      const mainAccount = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
      const testReferredAccount = 'TEST_REFERRED_USER_' + Date.now();
      
      // Step 1: Check current referral stats
      const currentStats = await fetch(`${process.env.VERCEL_URL || 'https://gold-mining-game-serverless.vercel.app'}/api/referrals?address=${mainAccount}`);
      const currentStatsData = await currentStats.json();
      
      // Step 2: Simulate user coming via referral link
      // (This would happen in the frontend with localStorage)
      
      // Step 3: Simulate both land and pickaxe purchase completion
      const referralCreation = await fetch(`${process.env.VERCEL_URL || 'https://gold-mining-game-serverless.vercel.app'}/api/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          referrerAddress: mainAccount,
          referredAddress: testReferredAccount,
          rewardAmount: 0.01,
          rewardType: 'sol'
        })
      });
      
      const referralResult = await referralCreation.text();
      
      // Step 4: Check updated stats
      const updatedStats = await fetch(`${process.env.VERCEL_URL || 'https://gold-mining-game-serverless.vercel.app'}/api/referrals?address=${mainAccount}`);
      const updatedStatsData = await updatedStats.json();
      
      return res.json({
        success: true,
        test_type: 'complete_flow_simulation',
        main_account: mainAccount.slice(0, 8) + '...',
        test_referred_account: testReferredAccount,
        current_stats: currentStatsData,
        referral_creation_response: referralResult,
        referral_creation_status: referralCreation.status,
        updated_stats: updatedStatsData,
        stats_changed: currentStatsData.stats?.total_referrals !== updatedStatsData.stats?.total_referrals
      });
    }
    
    // Default - show referral debug info
    return res.json({
      success: true,
      message: 'Referral test endpoint',
      available_tests: {
        'POST with referrerAddress/referredAddress': 'Test manual referral creation',
        'GET with action=simulate': 'Test complete referral flow',
        'GET with address': 'Check referral stats for address'
      },
      example_usage: {
        manual_test: 'POST with {"referrerAddress": "67ag...", "referredAddress": "TEST123"}',
        flow_test: 'GET with ?action=simulate',
        stats_check: 'GET with ?address=67ag...'
      }
    });
    
  } catch (error) {
    console.error('❌ Test referral error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}