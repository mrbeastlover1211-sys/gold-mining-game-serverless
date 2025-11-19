// Debug script to test land purchase modal closing
// Add this to browser console to debug the issue

console.log('🔍 Starting land purchase modal debug...');

// Check if modal exists
const modal = document.getElementById('mandatoryLandModal');
console.log('📋 Modal exists:', !!modal);

// Check if functions exist
console.log('📋 Functions available:');
console.log('  - closeMandatoryLandModal:', typeof closeMandatoryLandModal);
console.log('  - showMandatoryLandMessage:', typeof showMandatoryLandMessage);
console.log('  - resetPurchaseButton:', typeof resetPurchaseButton);

// Check message area
const messageArea = document.getElementById('mandatoryLandMsg');
console.log('📋 Message area exists:', !!messageArea);
if (messageArea) {
  console.log('📋 Current message:', messageArea.textContent);
  console.log('📋 Message visible:', messageArea.style.display !== 'none');
}

// Test the modal closing function manually
if (typeof closeMandatoryLandModal === 'function') {
  console.log('🧪 Testing modal close function...');
  // Don't actually close it, just test if function runs
  try {
    console.log('✅ Modal close function is callable');
  } catch (e) {
    console.error('❌ Modal close function error:', e);
  }
} else {
  console.error('❌ Modal close function not found!');
}

// Test message function
if (typeof showMandatoryLandMessage === 'function') {
  console.log('🧪 Testing message function...');
  try {
    showMandatoryLandMessage('🧪 Debug test message', 'info');
    console.log('✅ Message function works');
  } catch (e) {
    console.error('❌ Message function error:', e);
  }
} else {
  console.error('❌ Message function not found!');
}

// Check state
console.log('📋 Current state:', {
  address: state?.address,
  wallet: !!state?.wallet,
  hasLand: state?.status?.hasLand
});

// Manual test: Close modal after 2 seconds
console.log('🧪 Will attempt to close modal in 2 seconds...');
setTimeout(() => {
  console.log('⏰ Attempting manual modal close...');
  if (typeof closeMandatoryLandModal === 'function') {
    closeMandatoryLandModal();
    console.log('✅ Manual close attempted');
  } else {
    console.error('❌ Cannot close - function missing');
  }
}, 2000);