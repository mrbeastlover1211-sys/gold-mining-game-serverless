// 🚨 EMERGENCY HOTFIX - STOP INFINITE LOOPS IMMEDIATELY
// This loads FIRST and kills the infinite loop functions

console.log('🚨 EMERGENCY HOTFIX LOADING - STOPPING INFINITE LOOPS...');

// Global flag to prevent any land checks
window.LAND_CHECK_DISABLED = false;
window.LAND_CHECK_COUNT = 0;
window.MAX_LAND_CHECKS = 3;

// Override console.log to detect infinite loops
const originalLog = console.log;
let landDetectionCount = 0;

console.log = function(...args) {
  const message = args.join(' ');
  
  // Detect infinite loop pattern
  if (message.includes('Running comprehensive land detection') || 
      message.includes('Land detected via API, updating promoters')) {
    landDetectionCount++;
    
    if (landDetectionCount > 5) {
      console.error('🚨 INFINITE LOOP DETECTED! Disabling land checks...');
      window.LAND_CHECK_DISABLED = true;
      
      // Kill all intervals and timeouts
      for(let i = 1; i < 99999; i++) {
        clearInterval(i);
        clearTimeout(i);
      }
      
      // Show emergency message
      document.body.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
             background: linear-gradient(45deg, #ff6b6b, #ee5a24); 
             display: flex; align-items: center; justify-content: center; 
             color: white; font-family: Arial; z-index: 99999;">
          <div style="text-align: center; padding: 40px; background: rgba(0,0,0,0.8); 
               border-radius: 20px; max-width: 600px;">
            <h1>🚨 INFINITE LOOP DETECTED</h1>
            <p style="font-size: 18px; margin: 20px 0;">
              The system detected infinite API calls that were draining server costs.
            </p>
            <p style="font-size: 16px; margin: 20px 0;">
              <strong>EMERGENCY PROTECTION ACTIVATED</strong><br>
              All loops have been stopped to protect the system.
            </p>
            <button onclick="location.reload()" 
                    style="padding: 15px 30px; font-size: 16px; background: #2ecc71; 
                           color: white; border: none; border-radius: 10px; cursor: pointer;">
              🔄 Reload Page
            </button>
            <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">
              Contact support if this issue persists.
            </p>
          </div>
        </div>
      `;
      return;
    }
  }
  
  // Call original console.log
  originalLog.apply(console, args);
};

// Emergency function overrides
setTimeout(() => {
  console.log('🔧 HOTFIX: Setting up emergency overrides...');
  
  // Kill specific problematic functions
  if (typeof window.checkLandStatusAndShowPopup === 'function') {
    const original = window.checkLandStatusAndShowPopup;
    window.checkLandStatusAndShowPopup = function() {
      window.LAND_CHECK_COUNT++;
      
      if (window.LAND_CHECK_COUNT > window.MAX_LAND_CHECKS) {
        console.log('🚨 HOTFIX: Blocking excessive land checks');
        return;
      }
      
      if (window.LAND_CHECK_DISABLED) {
        console.log('🚨 HOTFIX: Land checks disabled due to infinite loop');
        return;
      }
      
      console.log('🔧 HOTFIX: Allowing controlled land check #' + window.LAND_CHECK_COUNT);
      return original.apply(this, arguments);
    };
  }
  
  // Kill update promoters if it's causing loops
  if (typeof window.updatePromotersStatus === 'function') {
    const original = window.updatePromotersStatus;
    let promoterUpdateCount = 0;
    
    window.updatePromotersStatus = function() {
      promoterUpdateCount++;
      
      if (promoterUpdateCount > 3) {
        console.log('🚨 HOTFIX: Blocking excessive promoter updates');
        return;
      }
      
      console.log('🔧 HOTFIX: Allowing controlled promoter update #' + promoterUpdateCount);
      return original.apply(this, arguments);
    };
  }
  
  // Reset counters every 10 seconds
  setInterval(() => {
    window.LAND_CHECK_COUNT = 0;
    landDetectionCount = Math.max(0, landDetectionCount - 1);
  }, 10000);
  
  console.log('✅ HOTFIX: Emergency protection active');
  
}, 1000);

console.log('✅ HOTFIX LOADED - Infinite loop protection active');