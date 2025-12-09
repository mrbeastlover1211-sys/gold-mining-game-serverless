// 🚨 EMERGENCY BYPASS - FLAG SYSTEM TO STOP INFINITE LOOPS
// This script loads IMMEDIATELY to prevent infinite API calls

console.log('🚨 EMERGENCY FLAG SYSTEM LOADING...');

// Immediate flag system override
window.EMERGENCY_LAND_FLAGS = {
  cache: new Map(),
  isChecking: false,
  
  setLandStatus: function(address, hasLand) {
    console.log('🚩 EMERGENCY: Setting land status', address.slice(0,8) + '...', hasLand);
    this.cache.set(address, {
      hasLand: hasLand,
      timestamp: Date.now()
    });
    localStorage.setItem('emergency_land_' + address, JSON.stringify({
      hasLand: hasLand,
      timestamp: Date.now()
    }));
  },
  
  getLandStatus: function(address) {
    // Check cache first
    if (this.cache.has(address)) {
      const cached = this.cache.get(address);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        console.log('📦 EMERGENCY: Using cached land status', cached.hasLand);
        return cached.hasLand;
      }
    }
    
    // Check localStorage
    const stored = localStorage.getItem('emergency_land_' + address);
    if (stored) {
      const data = JSON.parse(stored);
      if (Date.now() - data.timestamp < 300000) {
        console.log('📦 EMERGENCY: Using stored land status', data.hasLand);
        this.cache.set(address, data);
        return data.hasLand;
      }
    }
    
    return null; // Unknown
  },
  
  preventInfiniteLoop: function() {
    if (this.isChecking) {
      console.log('🛑 EMERGENCY: Preventing duplicate land check');
      return true;
    }
    return false;
  }
};

// Override problematic functions IMMEDIATELY
window.EMERGENCY_OVERRIDE = {
  originalFunctions: {},
  
  init: function() {
    console.log('🚨 EMERGENCY OVERRIDE: Initializing...');
    
    // Prevent infinite land detection
    const self = this;
    
    // Override after 1 second when main.js loads
    setTimeout(() => {
      if (typeof window.checkLandStatusAndShowPopup === 'function') {
        console.log('🔧 EMERGENCY: Overriding checkLandStatusAndShowPopup');
        self.originalFunctions.checkLandStatusAndShowPopup = window.checkLandStatusAndShowPopup;
        
        window.checkLandStatusAndShowPopup = function() {
          if (!state?.address) return;
          
          const landStatus = window.EMERGENCY_LAND_FLAGS.getLandStatus(state.address);
          if (landStatus !== null) {
            console.log('✅ EMERGENCY: Using cached land status, skipping API');
            if (landStatus) {
              if (typeof hideMandatoryLandModal === 'function') hideMandatoryLandModal();
            } else {
              if (typeof showMandatoryLandModal === 'function') showMandatoryLandModal();
            }
            return;
          }
          
          if (window.EMERGENCY_LAND_FLAGS.preventInfiniteLoop()) return;
          
          // Call original function but with protection
          window.EMERGENCY_LAND_FLAGS.isChecking = true;
          try {
            self.originalFunctions.checkLandStatusAndShowPopup.call(this);
          } finally {
            setTimeout(() => {
              window.EMERGENCY_LAND_FLAGS.isChecking = false;
            }, 2000);
          }
        };
        
        console.log('✅ EMERGENCY: Land check function overridden');
      }
      
      // Override land purchase success
      if (typeof window.hideMandatoryLandModal === 'function') {
        self.originalFunctions.hideMandatoryLandModal = window.hideMandatoryLandModal;
        
        window.hideMandatoryLandModal = function() {
          if (state?.address) {
            window.EMERGENCY_LAND_FLAGS.setLandStatus(state.address, true);
          }
          self.originalFunctions.hideMandatoryLandModal.call(this);
        };
      }
      
    }, 1000);
  }
};

// Start emergency override
window.EMERGENCY_OVERRIDE.init();

console.log('✅ EMERGENCY FLAG SYSTEM LOADED - Infinite loops prevented!');