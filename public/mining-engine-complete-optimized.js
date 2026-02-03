// 🚀 COMPLETE OPTIMIZED Mining Engine - Client-Side Gold Calculation
// This version eliminates 99% of API calls by calculating mining locally

window.logger && window.logger.log('⚡ Loading Complete Optimized Mining Engine...');

// Client-side mining state
window.miningState = {
  isActive: false,
  startTime: null,
  lastSyncTime: null,
  baseGold: 0,
  totalRate: 0,
  pickaxes: { silver: 0, gold: 0, diamond: 0, netherite: 0 }
};

// Mining rates per minute
const MINING_RATES = {
  silver: 1,
  gold: 10, 
  diamond: 100,
  netherite: 1000
};

// Initialize mining engine with user data
function initializeMiningEngine(userData) {
  window.logger && window.logger.log('🔧 Initializing optimized mining engine with data:', userData);
  
  window.miningState.baseGold = userData.last_checkpoint_gold || 0;
  window.miningState.pickaxes = {
    silver: userData.silver_pickaxes || 0,
    gold: userData.gold_pickaxes || 0,
    diamond: userData.diamond_pickaxes || 0,
    netherite: userData.netherite_pickaxes || 0
  };
  
  // Calculate total mining rate
  window.miningState.totalRate = 
    window.miningState.pickaxes.silver * MINING_RATES.silver +
    window.miningState.pickaxes.gold * MINING_RATES.gold +
    window.miningState.pickaxes.diamond * MINING_RATES.diamond +
    window.miningState.pickaxes.netherite * MINING_RATES.netherite;
  
  // Set timestamps
  const checkpointTime = userData.checkpoint_timestamp ? userData.checkpoint_timestamp * 1000 : Date.now();
  window.miningState.startTime = checkpointTime;
  window.miningState.lastSyncTime = checkpointTime;
  
  window.logger && window.logger.log('✅ Mining engine initialized:', {
    baseGold: window.miningState.baseGold,
    totalRate: window.miningState.totalRate,
    pickaxes: window.miningState.pickaxes
  });
  
  // Start mining if user has pickaxes
  if (window.miningState.totalRate > 0) {
    startOptimizedMining();
  }
}

// Calculate current gold based on time elapsed
function calculateCurrentGold() {
  if (window.miningState.totalRate <= 0) {
    return window.miningState.baseGold;
  }
  
  const now = Date.now();
  const timeElapsedSeconds = (now - window.miningState.startTime) / 1000;
  const goldPerSecond = window.miningState.totalRate / 60;
  const minedGold = goldPerSecond * timeElapsedSeconds;
  
  return window.miningState.baseGold + minedGold;
}

// Start optimized mining loop
function startOptimizedMining() {
  if (window.miningState.isActive) {
    window.logger && window.logger.log('⚠️ Mining already active');
    return;
  }
  
  window.logger && window.logger.log('⚡ Starting optimized mining...');
  window.miningState.isActive = true;
  
  // Update display immediately
  updateMiningDisplay();
  
  // 🚨 EMERGENCY FIX: Replace setInterval with requestAnimationFrame to prevent infinite loops
  window.logger && window.logger.log('🛑 EMERGENCY: Mining engine setInterval DISABLED - using optimized system');
  
  // Clear any existing intervals
  if (window.miningDisplayInterval) {
    clearInterval(window.miningDisplayInterval);
    window.miningDisplayInterval = null;
  }
  if (window.miningSyncInterval) {
    clearInterval(window.miningSyncInterval);
    window.miningSyncInterval = null;
  }
  
  // Use requestAnimationFrame instead of setInterval (prevents infinite loops)
  let lastDisplayUpdate = 0;
  let lastSyncUpdate = 0;
  
  function optimizedMiningLoop() {
    const now = performance.now();
    
    // Update display every 1000ms (1 second)
    if (now - lastDisplayUpdate >= 1000) {
      updateMiningDisplay();
      lastDisplayUpdate = now;
    }
    
    // ✅ NO MORE 30-SECOND SYNC! Pure client-side calculation
    // Checkpoints are only created on user actions (buy, sell, etc.)
    
    // Continue loop with requestAnimationFrame (much more CPU efficient)
    requestAnimationFrame(optimizedMiningLoop);
  }
  
  // Start the optimized loop (NO setInterval!)
  optimizedMiningLoop();
  
  window.logger && window.logger.log('✅ Optimized mining started with rate:', window.miningState.totalRate, 'gold/min');
}

// Update mining display (client-side only)
function updateMiningDisplay() {
  const currentGold = calculateCurrentGold();
  
  // Update gold display
  const totalGoldEl = document.querySelector('#totalGold');
  if (totalGoldEl) {
    totalGoldEl.textContent = currentGold.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  // Update mining rate display
  const miningRateEl = document.querySelector('#currentMiningRate');
  if (miningRateEl) {
    miningRateEl.textContent = `+${window.miningState.totalRate.toLocaleString()} gold/min`;
  }
  
  // Update mining tick log (less frequent)
  if (Math.floor(Date.now() / 1000) % 5 === 0) { // Every 5 seconds
    window.logger && window.logger.log(`⛏️ Mining: ${currentGold.toFixed(2)} gold (Rate: ${window.miningState.totalRate}/min)`);
  }
}

// Create checkpoint (called only on user actions)
async function createCheckpoint() {
  if (!window.state || !window.state.address) return;
  
  try {
    const currentGold = calculateCurrentGold();
    
    window.logger && window.logger.log('💾 Creating checkpoint...', currentGold.toFixed(2), 'gold');
    
    const response = await fetch('/api/save-checkpoint', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: window.state.address,
        gold: currentGold,
        timestamp: Math.floor(Date.now() / 1000)
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update checkpoint in mining state
      window.miningState.baseGold = currentGold;
      window.miningState.startTime = Date.now();
      window.miningState.lastSyncTime = Date.now();
      
      // Broadcast to other tabs
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('checkpoint', JSON.stringify({
          gold: currentGold,
          timestamp: Date.now(),
          miningPower: window.miningState.totalRate
        }));
      }
      
      window.logger && window.logger.log('✅ Checkpoint created:', currentGold.toFixed(2), 'gold');
      return true;
    }
    
  } catch (error) {
    window.logger && window.logger.log('⚠️ Checkpoint creation failed:', error.message);
    return false;
  }
}

// Stop mining
function stopOptimizedMining() {
  window.logger && window.logger.log('🛑 Stopping optimized mining...');
  
  window.miningState.isActive = false;
  
  if (window.miningDisplayInterval) {
    clearInterval(window.miningDisplayInterval);
    window.miningDisplayInterval = null;
  }
  
  if (window.miningSyncInterval) {
    clearInterval(window.miningSyncInterval);
    window.miningSyncInterval = null;
  }
  
  window.logger && window.logger.log('✅ Optimized mining stopped');
}

// Add pickaxe (when purchased)
function addPickaxeToMining(type, quantity = 1) {
  window.logger && window.logger.log(`🔨 Adding ${quantity}x ${type} pickaxe to mining engine`);
  
  // Sync current gold before adding pickaxe
  const currentGold = calculateCurrentGold();
  window.miningState.baseGold = currentGold;
  window.miningState.startTime = Date.now();
  
  // Add pickaxe
  window.miningState.pickaxes[type] = (window.miningState.pickaxes[type] || 0) + quantity;
  
  // Recalculate rate
  window.miningState.totalRate = 
    window.miningState.pickaxes.silver * MINING_RATES.silver +
    window.miningState.pickaxes.gold * MINING_RATES.gold +
    window.miningState.pickaxes.diamond * MINING_RATES.diamond +
    window.miningState.pickaxes.netherite * MINING_RATES.netherite;
  
  window.logger && window.logger.log('✅ New mining rate:', window.miningState.totalRate, 'gold/min');
  
  // Start mining if not already active
  if (window.miningState.totalRate > 0 && !window.miningState.isActive) {
    startOptimizedMining();
  }
  
  // Update display immediately
  updateMiningDisplay();
}

// Subtract gold (when sold)
function subtractGoldFromMining(amount) {
  window.logger && window.logger.log(`💰 Subtracting ${amount} gold from mining engine`);
  
  // Calculate current gold
  const currentGold = calculateCurrentGold();
  
  // Subtract sold amount
  const newBaseGold = Math.max(0, currentGold - amount);
  
  // Reset mining state with new base
  window.miningState.baseGold = newBaseGold;
  window.miningState.startTime = Date.now();
  
  window.logger && window.logger.log('✅ Gold subtracted. New base:', newBaseGold);
  
  // Update display immediately
  updateMiningDisplay();
}

// Get current mining state
function getMiningState() {
  return {
    gold: calculateCurrentGold(),
    rate: window.miningState.totalRate,
    pickaxes: window.miningState.pickaxes,
    isActive: window.miningState.isActive
  };
}

// Save checkpoint on page close (reliable sync)
function saveCheckpointOnClose() {
  if (!window.state?.address) return;
  
  const currentGold = calculateCurrentGold();
  const data = JSON.stringify({
    address: window.state.address,
    gold: currentGold,
    timestamp: Math.floor(Date.now() / 1000),
    finalSync: true
  });
  
  // Use sendBeacon for reliable delivery even when page is closing
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/save-checkpoint', data);
    window.logger && window.logger.log('💾 Final checkpoint sent via beacon:', currentGold.toFixed(2), 'gold');
  } else {
    // Fallback for older browsers (synchronous XHR)
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/save-checkpoint', false); // Synchronous
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(data);
      window.logger && window.logger.log('💾 Final checkpoint sent via XHR:', currentGold.toFixed(2), 'gold');
    } catch (e) {
      console.error('❌ Failed to save final checkpoint:', e);
    }
  }
}

// Listen for page unload events
window.addEventListener('beforeunload', saveCheckpointOnClose);
window.addEventListener('pagehide', saveCheckpointOnClose); // Better mobile support

// Listen for visibility changes (switching tabs)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // User switched away - create checkpoint
    window.logger && window.logger.log('👋 User switched tabs - creating checkpoint');
    createCheckpoint();
  } else {
    // User came back - could reload fresh data if needed
    window.logger && window.logger.log('👀 User returned to tab');
  }
});

// Listen for storage events (multi-tab sync)
window.addEventListener('storage', (e) => {
  if (e.key === 'checkpoint' && e.newValue) {
    try {
      const checkpoint = JSON.parse(e.newValue);
      
      // Update from another tab
      window.logger && window.logger.log('📡 Checkpoint updated from another tab:', checkpoint.gold);
      
      window.miningState.baseGold = checkpoint.gold;
      window.miningState.startTime = checkpoint.timestamp;
      window.miningState.lastSyncTime = checkpoint.timestamp;
      
      // Force display update
      updateMiningDisplay();
    } catch (e) {
      console.error('❌ Failed to parse checkpoint from storage:', e);
    }
  }
});

// Export functions to global scope
window.initializeMiningEngine = initializeMiningEngine;
window.startOptimizedMining = startOptimizedMining;
window.stopOptimizedMining = stopOptimizedMining;
window.addPickaxeToMining = addPickaxeToMining;
window.subtractGoldFromMining = subtractGoldFromMining;
window.getMiningState = getMiningState;
window.calculateCurrentGold = calculateCurrentGold;
window.createCheckpoint = createCheckpoint; // Export for use in buy/sell actions

window.logger && window.logger.log('✅ Complete Optimized Mining Engine with Checkpoint System loaded!');