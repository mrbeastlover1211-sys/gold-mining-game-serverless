// 🧪 Quick Referral System Test - Run this in browser console

async function testReferralSystem(referrerAddress, refereeAddress) {
  const API_BASE = 'https://gold-mining-serverless-a1yg9fmr3-james-projects-c1b8b251.vercel.app';
  
  console.log('🔍 Testing referral system...');
  console.log('Referrer (should get rewards):', referrerAddress);
  console.log('Referee (who was referred):', refereeAddress);
  
  try {
    // Test 1: Manual referral completion
    console.log('\n🧪 Test 1: Manual referral completion');
    const manualTest = await fetch(`${API_BASE}/api/manual-test-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referrer_address: referrerAddress,
        referee_address: refereeAddress,
        action: 'test_complete'
      })
    });
    
    const manualResult = await manualTest.json();
    console.log('Manual test result:', manualResult);
    
    // Test 2: Check referral completion API
    console.log('\n🎁 Test 2: Referral completion API');
    const completionTest = await fetch(`${API_BASE}/api/complete-referral?address=${encodeURIComponent(refereeAddress)}`);
    const completionResult = await completionTest.json();
    console.log('Completion API result:', completionResult);
    
    // Test 3: New referral system
    console.log('\n✨ Test 3: New referral system');
    const newSystemTest = await fetch(`${API_BASE}/api/referral-system-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: refereeAddress,
        force: false,
        trigger: 'test'
      })
    });
    
    const newSystemResult = await newSystemTest.json();
    console.log('New system result:', newSystemResult);
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('Manual test success:', manualResult.success);
    console.log('Completion API success:', completionResult.success);
    console.log('New system success:', newSystemResult.success);
    
    if (manualResult.success && manualResult.completion_status?.reward_given_now) {
      console.log('🎉 SUCCESS: Referral reward was given!');
      console.log('Referrer gold increase:', manualResult.users.referrer.gold_before, '→', manualResult.users.referrer.gold_after);
    } else {
      console.log('❌ ISSUE:', manualResult.next_steps || 'Referral requirements not met');
    }
    
    return {
      manualTest: manualResult,
      completionTest: completionResult,
      newSystemTest: newSystemResult
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { error: error.message };
  }
}

// Example usage:
// testReferralSystem('YOUR_MAIN_WALLET_ADDRESS', 'SECOND_ACCOUNT_WALLET_ADDRESS');

console.log(`
🧪 REFERRAL SYSTEM TEST READY!

To test your referral issue, run:

testReferralSystem('YOUR_MAIN_WALLET', 'SECOND_WALLET');

Replace with your actual wallet addresses:
- YOUR_MAIN_WALLET: The account that should get rewards
- SECOND_WALLET: The account that used referral link and bought land + pickaxe

Example:
testReferralSystem('67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
`);