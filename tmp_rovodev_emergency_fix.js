// EMERGENCY: Inject this script directly into browser console
// This will immediately stop infinite loops

console.log('🚨 EMERGENCY CONSOLE FIX - STOPPING INFINITE LOOPS...');

// Global stop flag
window.EMERGENCY_STOP = true;
window.ORIGINAL_FUNCTIONS = {};

// Store original function and replace with limited version
function limitFunction(funcName, maxCalls = 3) {
  if (window[funcName] && typeof window[funcName] === 'function') {
    console.log('🔧 EMERGENCY: Limiting function', funcName);
    
    window.ORIGINAL_FUNCTIONS[funcName] = window[funcName];
    let callCount = 0;
    
    window[funcName] = function() {
      callCount++;
      if (callCount > maxCalls) {
        console.log('🚨 EMERGENCY: Blocked excessive calls to', funcName, '- Call #', callCount);
        return;
      }
      
      console.log('✅ EMERGENCY: Allowing controlled call to', funcName, '- Call #', callCount);
      return window.ORIGINAL_FUNCTIONS[funcName].apply(this, arguments);
    };
  }
}

// Kill all existing intervals and timeouts
console.log('🔧 EMERGENCY: Killing all intervals and timeouts...');
for(let i = 1; i < 99999; i++) {
  clearInterval(i);
  clearTimeout(i);
}

// Wait for functions to load, then limit them
setTimeout(() => {
  console.log('🔧 EMERGENCY: Setting up function limits...');
  
  limitFunction('checkLandStatusAndShowPopup', 2);
  limitFunction('updatePromotersStatus', 2);
  limitFunction('updateReferralStatus', 2);
  
  // Override any function that contains "comprehensive land detection"
  const allFunctions = Object.getOwnPropertyNames(window);
  allFunctions.forEach(name => {
    if (typeof window[name] === 'function') {
      const funcString = window[name].toString();
      if (funcString.includes('comprehensive land detection') || 
          funcString.includes('Land detected via API')) {
        console.log('🚨 EMERGENCY: Found problematic function:', name);
        limitFunction(name, 1);
      }
    }
  });
  
  console.log('✅ EMERGENCY: Protection active - infinite loops should be stopped');
  
}, 2000);

console.log('🚩 EMERGENCY FIX LOADED - Copy and paste this into browser console!');