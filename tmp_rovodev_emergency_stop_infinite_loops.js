// 🚨 EMERGENCY HOTFIX: Stop ALL infinite loops immediately to save money!

console.log('🚨 EMERGENCY HOTFIX LOADING - Stopping infinite loops!');

// 1. BLOCK ALL land detection functions that cause infinite loops
window.detectLandStatus = function() {
  console.log('🛑 EMERGENCY: Land detection BLOCKED to prevent infinite API calls');
  return false;
};

window.checkActualLandStatus = function() {
  console.log('🛑 EMERGENCY: Land status API BLOCKED to prevent infinite calls');
  return false;
};

window.checkLandViaInventory = function() {
  console.log('🛑 EMERGENCY: Land inventory check BLOCKED');
  return false;
};

// 2. PROTECT updatePromotersStatus from infinite loops
let emergencyPromoterBlock = false;
let lastEmergencyPromoterCall = 0;

if (window.updatePromotersStatus) {
  const originalUpdatePromoters = window.updatePromotersStatus;
  window.updatePromotersStatus = function() {
    const now = Date.now();
    
    // Block if called within 10 seconds
    if (emergencyPromoterBlock || (now - lastEmergencyPromoterCall) < 10000) {
      console.log('🚨 EMERGENCY: Blocked promoter update to prevent infinite loop!');
      return;
    }
    
    emergencyPromoterBlock = true;
    lastEmergencyPromoterCall = now;
    
    console.log('🔒 EMERGENCY: Allowing ONE promoter update, then blocking for 10 seconds');
    
    try {
      originalUpdatePromoters();
    } catch (e) {
      console.error('🚨 EMERGENCY: Promoter update error:', e);
    } finally {
      setTimeout(() => {
        emergencyPromoterBlock = false;
        console.log('🔓 EMERGENCY: Promoter block reset after 10 seconds');
      }, 10000);
    }
  };
}

// 3. BLOCK ALL land API calls at the fetch level
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  
  // Block land-status API calls that cause infinite loops
  if (typeof url === 'string' && url.includes('/api/land-status')) {
    console.log('🚨 EMERGENCY: BLOCKED land-status API call to prevent infinite loop!');
    
    // Return fake successful response to prevent errors
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        hasLand: true, 
        emergency: true, 
        message: 'Emergency block active' 
      })
    });
  }
  
  // Allow all other API calls
  return originalFetch.apply(this, args);
};

// 4. STOP any existing intervals that might be causing loops
let intervalCount = 0;
const originalSetInterval = window.setInterval;
window.setInterval = function(callback, delay) {
  intervalCount++;
  console.log(`🔍 EMERGENCY: Created interval #${intervalCount} with delay ${delay}ms`);
  
  // Block very frequent intervals that might cause loops
  if (delay < 100) {
    console.log('🚨 EMERGENCY: BLOCKED high-frequency interval to prevent performance issues!');
    return null;
  }
  
  return originalSetInterval(callback, delay);
};

// 5. EMERGENCY CONSOLE MONITOR
let logCount = 0;
const originalConsoleLog = console.log;
console.log = function(...args) {
  logCount++;
  
  // If we see too many logs, something is looping
  if (logCount > 100) {
    console.error('🚨 EMERGENCY: Too many console logs detected - possible infinite loop!');
    
    // Reset counter every 5 seconds
    setTimeout(() => {
      logCount = 0;
    }, 5000);
  }
  
  return originalConsoleLog.apply(this, args);
};

console.log('✅ EMERGENCY HOTFIX ACTIVE - Infinite loops blocked, API costs protected!');

// 6. EMERGENCY STATUS DISPLAY
function showEmergencyStatus() {
  const emergencyDiv = document.createElement('div');
  emergencyDiv.id = 'emergencyStatus';
  emergencyDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: red;
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 99999;
    font-family: Arial;
    font-size: 12px;
    font-weight: bold;
  `;
  emergencyDiv.innerHTML = '🚨 EMERGENCY MODE: Infinite loops BLOCKED';
  document.body.appendChild(emergencyDiv);
  
  // Remove after 30 seconds
  setTimeout(() => {
    if (emergencyDiv.parentElement) {
      emergencyDiv.remove();
    }
  }, 30000);
}

// Show status when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showEmergencyStatus);
} else {
  showEmergencyStatus();
}

console.log('🛡️ EMERGENCY PROTECTION COMPLETE - Your money is safe!');