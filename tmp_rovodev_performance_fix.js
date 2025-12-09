// 🚀 PERFORMANCE FIX - Ultra-Optimized Mining System
// Eliminates setInterval timers that cause crashes with multiple users

// PROBLEM: Current system uses setInterval every 1 second per user
// SOLUTION: Mathematical calculation without any timers

// ⚡ ULTRA-OPTIMIZED GOLD CALCULATION (NO TIMERS)
function createOptimizedMiningEngine() {
  return {
    // Calculate gold in real-time using pure math - NO setInterval!
    calculateCurrentGold(checkpoint) {
      if (!checkpoint || !checkpoint.total_mining_power) {
        return parseFloat(checkpoint?.last_checkpoint_gold) || 0;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const checkpointTime = parseInt(checkpoint.checkpoint_timestamp, 10);
      const timeSinceCheckpoint = Math.max(0, currentTime - checkpointTime);
      const goldPerSecond = parseFloat(checkpoint.total_mining_power) / 60;
      const goldMined = goldPerSecond * timeSinceCheckpoint;
      const baseGold = parseFloat(checkpoint.last_checkpoint_gold) || 0;
      
      return baseGold + goldMined;
    },

    // Update display using requestAnimationFrame (60fps max, auto-throttles)
    startOptimizedDisplay(checkpoint) {
      let lastFrame = 0;
      const targetFPS = 2; // Update only 2 times per second to save CPU
      const frameDelay = 1000 / targetFPS;
      
      const updateFrame = (currentTime) => {
        // Throttle to 2 FPS instead of 60 FPS
        if (currentTime - lastFrame >= frameDelay) {
          this.updateGoldDisplay(checkpoint);
          lastFrame = currentTime;
        }
        
        // Continue animation loop
        this.animationId = requestAnimationFrame(updateFrame);
      };
      
      // Start the optimized loop
      this.animationId = requestAnimationFrame(updateFrame);
    },

    // Stop the animation when not needed
    stopOptimizedDisplay() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    },

    // Update only the gold display element
    updateGoldDisplay(checkpoint) {
      if (!checkpoint || !checkpoint.total_mining_power) return;
      
      const currentGold = this.calculateCurrentGold(checkpoint);
      const totalGoldEl = document.querySelector('#totalGold');
      
      if (totalGoldEl) {
        const safeGold = parseFloat(currentGold) || 0;
        totalGoldEl.textContent = safeGold.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
      }
      
      // Update mining rate display
      const currentMiningRateEl = document.querySelector('#currentMiningRate');
      if (currentMiningRateEl) {
        const miningPower = checkpoint.total_mining_power || 0;
        if (miningPower > 0) {
          currentMiningRateEl.textContent = `+${miningPower.toLocaleString()} gold/min`;
        }
      }
    }
  };
}

// ⚡ OPTIMIZED STATE MANAGEMENT
const OptimizedGameState = {
  checkpoint: null,
  miningEngine: null,
  isActive: false,

  // Initialize the optimized system
  init(checkpointData) {
    this.checkpoint = checkpointData;
    this.miningEngine = createOptimizedMiningEngine();
    
    if (checkpointData && checkpointData.total_mining_power > 0) {
      this.startMining();
    }
  },

  // Start mining WITHOUT setInterval
  startMining() {
    if (this.isActive) return; // Prevent multiple instances
    
    this.isActive = true;
    console.log('🚀 Starting OPTIMIZED mining engine (no timers!)');
    
    // Use requestAnimationFrame instead of setInterval
    this.miningEngine.startOptimizedDisplay(this.checkpoint);
  },

  // Stop mining cleanly
  stopMining() {
    if (!this.isActive) return;
    
    this.isActive = false;
    console.log('🛑 Stopping optimized mining engine');
    
    if (this.miningEngine) {
      this.miningEngine.stopOptimizedDisplay();
    }
  },

  // Update checkpoint when user buys pickaxes
  updateCheckpoint(newCheckpoint) {
    this.checkpoint = newCheckpoint;
    
    // Restart with new data if mining is active
    if (this.isActive) {
      this.stopMining();
      this.startMining();
    }
  },

  // Get current gold instantly without any timers
  getCurrentGold() {
    if (!this.miningEngine || !this.checkpoint) return 0;
    return this.miningEngine.calculateCurrentGold(this.checkpoint);
  }
};

// 🔧 REPLACE THE OLD TIMER-BASED SYSTEM
function replaceOldMiningSystem() {
  console.log('🔧 Replacing old timer-based mining system...');
  
  // Clear any existing setInterval timers
  if (window.state && window.state.goldUpdateInterval) {
    clearInterval(window.state.goldUpdateInterval);
    window.state.goldUpdateInterval = null;
    console.log('✅ Cleared old setInterval timer');
  }
  
  // Replace old functions with optimized versions
  window.startCheckpointGoldLoop = function() {
    if (window.state && window.state.checkpoint) {
      OptimizedGameState.init(window.state.checkpoint);
    }
  };
  
  window.stopMining = function() {
    OptimizedGameState.stopMining();
  };
  
  window.calculateGoldFromCheckpoint = function(checkpoint) {
    return OptimizedGameState.miningEngine ? 
      OptimizedGameState.miningEngine.calculateCurrentGold(checkpoint) : 0;
  };
  
  console.log('✅ Mining system optimization complete!');
}

// 🌟 BROWSER OPTIMIZATION FOR MULTIPLE TABS
function optimizeForMultipleTabs() {
  // Pause mining when tab is not visible to save CPU
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      console.log('🌙 Tab hidden - pausing mining to save CPU');
      OptimizedGameState.stopMining();
    } else {
      console.log('☀️ Tab visible - resuming mining');
      if (OptimizedGameState.checkpoint && OptimizedGameState.checkpoint.total_mining_power > 0) {
        OptimizedGameState.startMining();
      }
    }
  });
  
  // Reduce updates when window loses focus
  window.addEventListener('blur', function() {
    OptimizedGameState.stopMining();
  });
  
  window.addEventListener('focus', function() {
    if (OptimizedGameState.checkpoint && OptimizedGameState.checkpoint.total_mining_power > 0) {
      OptimizedGameState.startMining();
    }
  });
}

// 🚀 AUTO-APPLY OPTIMIZATION
(function() {
  console.log('🚀 PERFORMANCE OPTIMIZATION LOADING...');
  
  // Wait for the main script to load
  if (typeof window !== 'undefined') {
    // Apply optimizations when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
          replaceOldMiningSystem();
          optimizeForMultipleTabs();
          console.log('🎉 PERFORMANCE OPTIMIZATION ACTIVE!');
        }, 1000);
      });
    } else {
      // DOM already ready
      setTimeout(() => {
        replaceOldMiningSystem();
        optimizeForMultipleTabs();
        console.log('🎉 PERFORMANCE OPTIMIZATION ACTIVE!');
      }, 1000);
    }
  }
})();

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OptimizedGameState,
    createOptimizedMiningEngine,
    replaceOldMiningSystem,
    optimizeForMultipleTabs
  };
}