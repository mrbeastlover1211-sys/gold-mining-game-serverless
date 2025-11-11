// Client-Side Mining Engine
// Handles all mining calculations in the browser

class MiningEngine {
  constructor() {
    this.isRunning = false;
    this.lastUpdateTime = Date.now();
    this.gold = 0;
    this.inventory = { silver: 0, gold: 0, diamond: 0, netherite: 0 };
    this.config = null;
    this.isWindowActive = true;
    this.idleMiningLimit = 10000;
    this.activityTimeout = 30000; // 30 seconds
    this.lastActivityTime = Date.now();
    
    // Mining rates per second (from server config)
    this.PICKAXE_RATES = {
      silver: 1/60,     // 1 gold/min = 1/60 gold/sec
      gold: 10/60,      // 10 gold/min = 10/60 gold/sec  
      diamond: 100/60,  // 100 gold/min = 100/60 gold/sec
      netherite: 10000/60 // 10,000 gold/min = 10,000/60 gold/sec
    };
    
    // Setup activity tracking
    this.setupActivityTracking();
    
    // Mining loop will be started manually from main.js
    // this.startMiningLoop();
  }
  
  // Initialize with server data
  init(serverData) {
    this.gold = serverData.gold || 0;
    this.inventory = serverData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
    this.lastUpdateTime = Date.now();
    this.lastActivityTime = Date.now();
    console.log('🔧 Mining engine initialized with:', { gold: this.gold, inventory: this.inventory });
  }
  
  // Calculate total mining rate per second
  getTotalMiningRate() {
    let totalRate = 0;
    for (const [pickaxeType, count] of Object.entries(this.inventory)) {
      if (this.PICKAXE_RATES[pickaxeType]) {
        totalRate += count * this.PICKAXE_RATES[pickaxeType];
      }
    }
    return totalRate;
  }
  
  // Get mining rate per minute for display
  getTotalMiningRatePerMinute() {
    return this.getTotalMiningRate() * 60;
  }
  
  // Check if mining should be active
  shouldMine() {
    // No pickaxes = no mining
    const totalPickaxes = Object.values(this.inventory).reduce((sum, count) => sum + count, 0);
    if (totalPickaxes === 0) return false;
    
    // Anti-idle system: stop mining if gold >= limit and user inactive
    if (this.gold >= this.idleMiningLimit) {
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      if (timeSinceActivity > this.activityTimeout) {
        return false; // User is idle, pause mining
      }
    }
    
    return true;
  }
  
  // Main mining calculation (called every frame)
  mine() {
    if (!this.shouldMine()) return;
    
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    
    const miningRate = this.getTotalMiningRate();
    const goldEarned = miningRate * deltaTime;
    
    this.gold += goldEarned;
    this.lastUpdateTime = now;
    
    return goldEarned;
  }
  
  // Start the mining loop (called manually from main.js)
  startMiningLoop() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    console.log('⚡ Mining engine ready for manual mining calls');
  }
  
  // Stop mining
  stopMining() {
    this.isRunning = false;
    console.log('⏹️ Mining stopped');
  }
  
  // Add pickaxes to inventory
  addPickaxe(pickaxeType, quantity = 1) {
    if (!this.inventory[pickaxeType]) {
      this.inventory[pickaxeType] = 0;
    }
    this.inventory[pickaxeType] += quantity;
    console.log(`➕ Added ${quantity}x ${pickaxeType} pickaxe(s). New total: ${this.inventory[pickaxeType]}`);
  }
  
  // Spend gold (for selling or purchases)
  spendGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }
  
  // Add gold (for purchases or bonuses)
  addGold(amount) {
    this.gold += amount;
  }
  
  // Get current state for display/sync
  getState() {
    return {
      gold: this.gold,
      inventory: { ...this.inventory },
      totalRate: this.getTotalMiningRate(),
      totalRatePerMinute: this.getTotalMiningRatePerMinute(),
      isActiveMining: this.shouldMine(),
      lastUpdate: this.lastUpdateTime
    };
  }
  
  // Setup activity tracking for anti-idle system
  setupActivityTracking() {
    // Track window visibility
    document.addEventListener('visibilitychange', () => {
      this.isWindowActive = !document.hidden;
      if (this.isWindowActive) {
        this.recordActivity();
      }
    });
    
    // Track window focus/blur
    window.addEventListener('focus', () => {
      this.isWindowActive = true;
      this.recordActivity();
    });
    
    window.addEventListener('blur', () => {
      this.isWindowActive = false;
    });
    
    // Track mouse movement and clicks
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, () => {
        this.recordActivity();
      }, true);
    });
  }
  
  // Record user activity
  recordActivity() {
    this.lastActivityTime = Date.now();
    this.isWindowActive = true;
  }
  
  // Get mining status for UI
  getMiningStatus() {
    const totalPickaxes = Object.values(this.inventory).reduce((sum, count) => sum + count, 0);
    
    if (totalPickaxes === 0) {
      return {
        status: 'inactive',
        message: '💤 Buy pickaxes to start mining!',
        color: '#b0b0b0'
      };
    }
    
    if (!this.shouldMine()) {
      return {
        status: 'paused',
        message: '⚠️ Mining PAUSED - Stay active to continue after 10,000 gold!',
        color: '#ff6b6b'
      };
    }
    
    return {
      status: 'active',
      message: `⚡ Mining with ${totalPickaxes} pickaxe${totalPickaxes > 1 ? 's' : ''}!`,
      color: '#339af0'
    };
  }
}

// Export for use in main.js
window.MiningEngine = MiningEngine;