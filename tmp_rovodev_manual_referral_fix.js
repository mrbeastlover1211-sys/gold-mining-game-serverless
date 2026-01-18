// 🔧 Manual Referral Completion Script
// Use this if you want to manually create the referral relationship

const MANUAL_REFERRAL_DATA = {
  referrer: 'YOUR_MAIN_WALLET_ADDRESS',  // Replace with your main wallet
  referee: 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG'
};

console.log('🔧 Manual Referral Fix Script');
console.log('This can be used if you have admin access to manually create referral relationships');

// Step 1: Create referral session manually (if you have admin API)
async function createManualReferralSession() {
  try {
    const response = await fetch('/api/create-manual-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referrer_address: MANUAL_REFERRAL_DATA.referrer,
        referee_address: MANUAL_REFERRAL_DATA.referee,
        admin_override: true
      })
    });
    
    const result = await response.json();
    console.log('Manual creation result:', result);
    return result.success;
  } catch (error) {
    console.log('Manual creation error:', error);
    return false;
  }
}

// Step 2: Complete the referral
async function completeManualReferral() {
  try {
    const response = await fetch('/api/complete-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: MANUAL_REFERRAL_DATA.referee })
    });
    
    const result = await response.json();
    console.log('Completion result:', result);
    return result;
  } catch (error) {
    console.log('Completion error:', error);
    return null;
  }
}

console.log('\nInstructions:');
console.log('1. Replace YOUR_MAIN_WALLET_ADDRESS with your actual referrer address');
console.log('2. If you have admin access, run: await createManualReferralSession()');
console.log('3. Then run: await completeManualReferral()');