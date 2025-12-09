// 🔍 Referral System Debug Script
// Use this to manually check and complete referrals

const DEBUG_INFO = {
  newUserAddress: 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG',
  referrerAddress: 'YOUR_MAIN_ACCOUNT_ADDRESS', // Replace with your main account
  testUrl: 'https://gold-mining-game-serverless.vercel.app'
};

console.log('🔍 REFERRAL DEBUG TOOL');
console.log('New User Address:', DEBUG_INFO.newUserAddress);
console.log('Expected Referrer:', DEBUG_INFO.referrerAddress);

// 1. Check referral session tracking
async function checkReferralSession() {
  console.log('\n📊 1. Checking Referral Session...');
  
  try {
    const response = await fetch(`${DEBUG_INFO.testUrl}/api/check-referral-session?address=${DEBUG_INFO.newUserAddress}`);
    const result = await response.json();
    console.log('Session Result:', result);
    
    if (!result.session_found) {
      console.log('❌ No referral session found - this is likely the issue!');
      return false;
    } else {
      console.log('✅ Referral session exists');
      return true;
    }
  } catch (error) {
    console.log('❌ Error checking session:', error);
    return false;
  }
}

// 2. Check land ownership
async function checkLandOwnership() {
  console.log('\n🏞️ 2. Checking Land Ownership...');
  
  try {
    const response = await fetch(`${DEBUG_INFO.testUrl}/api/land-status?address=${DEBUG_INFO.newUserAddress}`);
    const result = await response.json();
    console.log('Land Result:', result);
    
    if (!result.hasLand) {
      console.log('❌ User does not own land yet');
      return false;
    } else {
      console.log('✅ User owns land');
      return true;
    }
  } catch (error) {
    console.log('❌ Error checking land:', error);
    return false;
  }
}

// 3. Check user status
async function checkUserStatus() {
  console.log('\n📊 3. Checking User Status...');
  
  try {
    const response = await fetch(`${DEBUG_INFO.testUrl}/api/status?address=${DEBUG_INFO.newUserAddress}`);
    const result = await response.json();
    console.log('User Status:', result);
    
    const totalPickaxes = Object.values(result.inventory || {}).reduce((sum, count) => sum + count, 0);
    console.log('Total Pickaxes:', totalPickaxes);
    
    if (totalPickaxes === 0) {
      console.log('❌ User has no pickaxes yet');
      return false;
    } else {
      console.log('✅ User has pickaxes');
      return true;
    }
  } catch (error) {
    console.log('❌ Error checking status:', error);
    return false;
  }
}

// 4. Manual referral completion attempt
async function manualCompleteReferral() {
  console.log('\n🎁 4. Attempting Manual Referral Completion...');
  
  try {
    const response = await fetch(`${DEBUG_INFO.testUrl}/api/complete-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: DEBUG_INFO.newUserAddress })
    });
    
    const result = await response.json();
    console.log('Completion Result:', result);
    
    if (result.success && result.referral_completed) {
      console.log('🎉 REFERRAL COMPLETED SUCCESSFULLY!');
      console.log('Rewards:', result.reward_details);
    } else if (result.success && !result.referral_completed) {
      console.log('ℹ️ Referral not completed:', result.message);
    } else {
      console.log('❌ Referral completion failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.log('❌ Error completing referral:', error);
    return null;
  }
}

// 5. Run full diagnostic
async function runFullDiagnostic() {
  console.log('🚀 Running Full Referral Diagnostic...\n');
  
  const sessionExists = await checkReferralSession();
  const hasLand = await checkLandOwnership();
  const hasPickaxes = await checkUserStatus();
  
  console.log('\n📋 DIAGNOSTIC SUMMARY:');
  console.log('Referral Session:', sessionExists ? '✅' : '❌');
  console.log('Land Ownership:', hasLand ? '✅' : '❌');
  console.log('Has Pickaxes:', hasPickaxes ? '✅' : '❌');
  
  if (sessionExists && hasLand && hasPickaxes) {
    console.log('\n🎯 All requirements met - attempting completion...');
    await manualCompleteReferral();
  } else {
    console.log('\n❌ Missing requirements for referral completion');
    
    if (!sessionExists) {
      console.log('ISSUE: No referral session tracked');
      console.log('SOLUTION: User needs to visit referral link before connecting wallet');
    }
    if (!hasLand) {
      console.log('ISSUE: User needs to purchase land');
    }
    if (!hasPickaxes) {
      console.log('ISSUE: User needs to purchase pickaxes');
    }
  }
}

// Usage instructions
console.log('\n📖 USAGE INSTRUCTIONS:');
console.log('1. Replace DEBUG_INFO.referrerAddress with your main account');
console.log('2. Run: await runFullDiagnostic()');
console.log('3. Or run individual checks:');
console.log('   - await checkReferralSession()');
console.log('   - await checkLandOwnership()');
console.log('   - await checkUserStatus()');
console.log('   - await manualCompleteReferral()');