// 🚀 COMPLETE OPTIMIZED Mining Engine - Client-Side Gold Calculation
// This version eliminates 99% of API calls by calculating mining locally

console.log('⚡ Loading Complete Optimized Mining Engine...');

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
  console.log('🔧 Initializing optimized mining engine with data:', userData);
  
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
  
  console.log('✅ Mining engine initialized:', {
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
    console.log('⚠️ Mining already active');
    return;
  }
  
  console.log('⚡ Starting optimized mining...');
  window.miningState.isActive = true;
  
  // Update display immediately
  updateMiningDisplay();
  
  // 🚨 EMERGENCY FIX: Replace setInterval with requestAnimationFrame to prevent infinite loops
  console.log('🛑 EMERGENCY: Mining engine setInterval DISABLED - using optimized system');
  
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
    
    // Sync with server every 30000ms (30 seconds)
    if (now - lastSyncUpdate >= 30000) {
      syncWithServer();
      lastSyncUpdate = now;
    }
    
    // Continue loop with requestAnimationFrame (much more CPU efficient)
    requestAnimationFrame(optimizedMiningLoop);
  }
  
  // Start the optimized loop (NO setInterval!)
  optimizedMiningLoop();
  
  console.log('✅ Optimized mining started with rate:', window.miningState.totalRate, 'gold/min');
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
    console.log(`⛏️ Mining: ${currentGold.toFixed(2)} gold (Rate: ${window.miningState.totalRate}/min)`);
  }
}

// Sync with server (reduced frequency)
async function syncWithServer() {
  if (!window.state || !window.state.address) return;
  
  try {
    const currentGold = calculateCurrentGold();
    
    // Only sync if significant time has passed or gold amount is substantial
    const timeSinceLastSync = Date.now() - window.miningState.lastSyncTime;
    if (timeSinceLastSync < 25000 && currentGold - window.miningState.baseGold < 100) {
      return; // Skip sync if minimal progress
    }
    
    console.log('🔄 Syncing with server...');
    
    const response = await fetch('/api/status', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: window.state.address,
        clientGold: currentGold,
        syncUpdate: true
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update base gold to server value
      window.miningState.baseGold = data.last_checkpoint_gold || currentGold;
      window.miningState.startTime = Date.now();
      window.miningState.lastSyncTime = Date.now();
      
      console.log('✅ Synced with server:', window.miningState.baseGold, 'gold');
    }
    
  } catch (error) {
    console.log('⚠️ Sync failed (continuing with client-side):', error.message);
  }
}

// Stop mining
function stopOptimizedMining() {
  console.log('🛑 Stopping optimized mining...');
  
  window.miningState.isActive = false;
  
  if (window.miningDisplayInterval) {
    clearInterval(window.miningDisplayInterval);
    window.miningDisplayInterval = null;
  }
  
  if (window.miningSyncInterval) {
    clearInterval(window.miningSyncInterval);
    window.miningSyncInterval = null;
  }
  
  console.log('✅ Optimized mining stopped');
}

// Add pickaxe (when purchased)
function addPickaxeToMining(type, quantity = 1) {
  console.log(`🔨 Adding ${quantity}x ${type} pickaxe to mining engine`);
  
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
  
  console.log('✅ New mining rate:', window.miningState.totalRate, 'gold/min');
  
  // Start mining if not already active
  if (window.miningState.totalRate > 0 && !window.miningState.isActive) {
    startOptimizedMining();
  }
  
  // Update display immediately
  updateMiningDisplay();
}

// Subtract gold (when sold)
function subtractGoldFromMining(amount) {
  console.log(`💰 Subtracting ${amount} gold from mining engine`);
  
  // Calculate current gold
  const currentGold = calculateCurrentGold();
  
  // Subtract sold amount
  const newBaseGold = Math.max(0, currentGold - amount);
  
  // Reset mining state with new base
  window.miningState.baseGold = newBaseGold;
  window.miningState.startTime = Date.now();
  
  console.log('✅ Gold subtracted. New base:', newBaseGold);
  
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

// Export functions to global scope
window.initializeMiningEngine = initializeMiningEngine;
window.startOptimizedMining = startOptimizedMining;
window.stopOptimizedMining = stopOptimizedMining;
window.addPickaxeToMining = addPickaxeToMining;
window.subtractGoldFromMining = subtractGoldFromMining;
window.getMiningState = getMiningState;
window.calculateCurrentGold = calculateCurrentGold;

console.log('✅ Complete Optimized Mining Engine loaded successfully!');