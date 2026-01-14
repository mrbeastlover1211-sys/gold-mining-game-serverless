// 🚀 COMPLETE OPTIMIZED Gold Mining Game - All Features Included
// Ultra-efficient client supporting 500K+ users with full functionality

// Global state management with SMART FLAG SYSTEM
let state = {
  connection: null,
  config: null,
  wallet: null,
  address: null,
  intervalId: null,
  status: { gold: 0, inventory: null },
  miningEngine: null,
  goldUpdateInterval: null,
  checkpoint: null,
  solBalance: 0,
  consecutiveErrors: 0
};

// 🚩 SMART LAND STATUS CACHE - 3-LAYER SYSTEM TO PREVENT INFINITE LOOPS
const LAND_STATUS_CACHE = {
  // Layer 1: Memory flag (fastest - 5 minutes)
  memoryCache: new Map(),
  
  // Layer 2: localStorage (persistent - 10 minutes)
  CACHE_KEY_PREFIX: 'gm_land_status_',
  MEMORY_EXPIRY: 5 * 60 * 1000,    // 5 minutes
  STORAGE_EXPIRY: 10 * 60 * 1000,   // 10 minutes
  
  // Layer 3: API call control
  apiCallInProgress: false,
  
  // 🚨 NUCLEAR CIRCUIT BREAKER - Prevent infinite loops completely
  apiCallCount: 0,
  maxApiCallsPerMinute: 3,
  lastApiCallReset: 0,
  
  // Generate cache key for localStorage
  getCacheKey(address) {
    return this.CACHE_KEY_PREFIX + address;
  },
  
  // MAIN FUNCTION: Check land status with cascading fallbacks
  async checkLandStatus(address) {
    if (!address) {
      console.log('🚩 SMART CACHE: No address provided');
      return null;
    }
    
    const shortAddr = address.slice(0, 8) + '...';
    const now = Date.now();
    
    // 🎯 LAYER 1: Check memory cache first (fastest)
    if (this.memoryCache.has(address)) {
      const memoryData = this.memoryCache.get(address);
      
      if (now - memoryData.timestamp < this.MEMORY_EXPIRY) {
        console.log(`🚩 LAYER 1 (Memory): ${shortAddr} land status = ${memoryData.hasLand} (cached)`);
        return memoryData.hasLand;
      } else {
        console.log(`🚩 LAYER 1 (Memory): Cache expired for ${shortAddr}`);
        this.memoryCache.delete(address);
      }
    } else {
      console.log(`🚩 LAYER 1 (Memory): No cache for ${shortAddr}`);
    }
    
    // 🎯 LAYER 2: Check localStorage cache (persistent)
    try {
      const cacheKey = this.getCacheKey(address);
      const storedData = localStorage.getItem(cacheKey);
      
      if (storedData) {
        const parsed = JSON.parse(storedData);
        
        if (now - parsed.timestamp < this.STORAGE_EXPIRY) {
          console.log(`🚩 LAYER 2 (Storage): ${shortAddr} land status = ${parsed.hasLand} (cached)`);
          
          // Restore to memory cache
          this.memoryCache.set(address, parsed);
          return parsed.hasLand;
        } else {
          console.log(`🚩 LAYER 2 (Storage): Cache expired for ${shortAddr}`);
          localStorage.removeItem(cacheKey);
        }
      } else {
        console.log(`🚩 LAYER 2 (Storage): No cache for ${shortAddr}`);
      }
    } catch (error) {
      console.log(`🚩 LAYER 2 (Storage): Error reading cache for ${shortAddr}:`, error);
    }
    
    // 🎯 LAYER 3: API call (only if both caches failed)
    if (this.apiCallInProgress) {
      console.log(`🚩 LAYER 3 (API): Call already in progress for ${shortAddr}, waiting...`);
      return null;
    }
    
    // 🚨 NUCLEAR CIRCUIT BREAKER - Prevent infinite API calls
    const currentTime = Date.now();
    if (currentTime - this.lastApiCallReset > 60000) { // Reset every minute
      this.apiCallCount = 0;
      this.lastApiCallReset = currentTime;
    }
    
    if (this.apiCallCount >= this.maxApiCallsPerMinute) {
      console.log(`🚨 CIRCUIT BREAKER: Too many API calls (${this.apiCallCount}/${this.maxApiCallsPerMinute}), blocking for 1 minute`);
      return null;
    }
    
    this.apiCallCount++;
    console.log(`🚩 LAYER 3 (API): Making API call ${this.apiCallCount}/${this.maxApiCallsPerMinute} for ${shortAddr}...`);
    this.apiCallInProgress = true;
    
    try {
      const response = await fetch(`/api/land-status?address=${encodeURIComponent(address)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`🚩 LAYER 3 (API): Fresh data for ${shortAddr}:`, result);
      
      // Update all cache layers with fresh data
      this.updateAllLayers(address, result.hasLand);
      
      return result.hasLand;
      
    } catch (error) {
      console.error(`🚩 LAYER 3 (API): Failed for ${shortAddr}:`, error);
      return null;
    } finally {
      this.apiCallInProgress = false;
    }
  },
  
  // Update all cache layers with fresh data
  updateAllLayers(address, hasLand) {
    const timestamp = Date.now();
    const data = { hasLand, timestamp };
    
    // Update memory cache
    this.memoryCache.set(address, data);
    console.log(`🚩 MEMORY UPDATED: ${address.slice(0, 8)}... = ${hasLand}`);
    
    // Update localStorage cache
    try {
      const cacheKey = this.getCacheKey(address);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      console.log(`🚩 STORAGE UPDATED: ${address.slice(0, 8)}... = ${hasLand}`);
    } catch (error) {
      console.log(`🚩 STORAGE UPDATE FAILED: ${error.message}`);
    }
  },
  
  // Force update when land is purchased
  setLandStatus(address, hasLand) {
    console.log(`🚩 FORCE UPDATE: ${address.slice(0, 8)}... = ${hasLand} (manual)`);
    this.updateAllLayers(address, hasLand);
  },
  
  // Clear cache for address (on wallet switch)
  clearCache(address) {
    this.memoryCache.delete(address);
    try {
      localStorage.removeItem(this.getCacheKey(address));
      console.log(`🚩 CACHE CLEARED: ${address.slice(0, 8)}...`);
    } catch (error) {
      console.log(`🚩 CACHE CLEAR FAILED: ${error.message}`);
    }
  }
};

const $ = (sel) => document.querySelector(sel);

// 📡 Load configuration and initialize system
async function loadConfig() {
  try {
    console.log('📡 Loading config...');
    const res = await fetch('/api/config');
    state.config = await res.json();
    console.log('✅ Config loaded:', state.config);
    
    // Initialize Solana connection
    const clusterUrl = state.config.clusterUrl || 'https://api.devnet.solana.com';
    state.connection = new solanaWeb3.Connection(clusterUrl);
    
    updateStaticInfo();
    renderShop();
    
    // Auto-reconnect wallet
    await autoReconnectWallet();
    
  } catch (e) {
    console.error('❌ Failed to load config:', e);
  }
}

// 📊 Update static information display
function updateStaticInfo() {
  if (state.config) {
    $('#goldPrice').textContent = state.config.goldPriceSol + ' SOL';
    $('#minSell').textContent = state.config.minSellGold.toLocaleString();
  }
}

// 🛒 Render pickaxe shop (CRITICAL - was missing from optimized)
function renderShop() {
  console.log('🛒 renderShop() called');
  
  if (!state.config || !state.config.pickaxes) {
    console.log('❌ renderShop: No config or pickaxes data available');
    return;
  }
  
  const grid = $('#pickaxeGrid');
  if (!grid) {
    console.error('❌ renderShop: #pickaxeGrid element not found in DOM!');
    return;
  }
  
  console.log('✅ renderShop: Found pickaxeGrid element, clearing content...');
  grid.innerHTML = '';
  
  const pickaxes = [
    { key: 'silver', name: 'Silver Pickaxe', rate: 1, cost: state.config.pickaxes.silver.costSol, roi: '7 DAYS', roiClass: 'roi-slow' },
    { key: 'gold', name: 'Gold Pickaxe', rate: 10, cost: state.config.pickaxes.gold.costSol, roi: '18 HOURS', roiClass: 'roi-medium' },
    { key: 'diamond', name: 'Diamond Pickaxe', rate: 100, cost: state.config.pickaxes.diamond.costSol, roi: '2 HOURS', roiClass: 'roi-fast' },
    { key: 'netherite', name: 'Netherite Pickaxe', rate: 1000, cost: state.config.pickaxes.netherite.costSol, roi: '50 MINUTES', roiClass: 'roi-instant' }
  ];
  
  console.log('🔧 renderShop: Creating pickaxe items...');
  
  pickaxes.forEach((pickaxe, index) => {
    const item = document.createElement('div');
    item.className = 'pickaxe-item';
    
    // Get the correct icon for each pickaxe type
    let iconSrc = '';
    switch(pickaxe.key) {
      case 'silver':
        iconSrc = 'assets/pickaxes/pickaxe-silver.png';
        break;
      case 'gold':
        iconSrc = 'assets/pickaxes/pickaxe-gold.png';
        break;
      case 'diamond':
        iconSrc = 'assets/pickaxes/pickaxe-diamond.png';
        break;
      case 'netherite':
        iconSrc = 'assets/pickaxes/pickaxe-netherite.gif';
        break;
      default:
        iconSrc = 'assets/pickaxes/pickaxe-silver.png';
    }
    
    console.log(`🔨 Creating ${pickaxe.key} pickaxe item (${index + 1}/4)`);
    
    item.innerHTML = `
      <div class="pickaxe-header">
        <div class="pickaxe-icon ${pickaxe.key}">
          <img src="${iconSrc}" alt="${pickaxe.name}" class="pickaxe-shop-icon">
        </div>
        <div class="pickaxe-info">
          <div class="pickaxe-name">${pickaxe.name}</div>
          <div class="pickaxe-rate">⚡ ${pickaxe.rate} gold/min</div>
          <div class="pickaxe-roi ${pickaxe.roiClass}">⏱️ ROI: ${pickaxe.roi}</div>
        </div>
      </div>
      <div class="pickaxe-price">💰 ${pickaxe.cost} SOL each</div>
      <div id="owned-${pickaxe.key}" class="pickaxe-owned" style="display: none;">Owned: 0</div>
      <div class="quantity-controls">
        <button class="qty-btn" onclick="changeQuantity('${pickaxe.key}', -1)">-</button>
        <input type="number" id="qty-${pickaxe.key}" class="qty-input" value="1" min="1" max="1000" />
        <button class="qty-btn" onclick="changeQuantity('${pickaxe.key}', 1)">+</button>
      </div>
      <button class="buy-btn" onclick="buyPickaxe('${pickaxe.key}')">Buy</button>
    `;
    grid.appendChild(item);
    console.log(`✅ Added ${pickaxe.key} pickaxe to shop`);
  });
  
  console.log('🎉 renderShop: All pickaxe items created successfully');
}

// ➕➖ Change quantity controls for pickaxe shop
function changeQuantity(pickaxeType, delta) {
  const input = $(`#qty-${pickaxeType}`);
  const currentValue = parseInt(input.value) || 1;
  const newValue = Math.max(1, Math.min(1000, currentValue + delta));
  input.value = newValue;
}

// 🔗 CLEAN WALLET CONNECTION - Simple Logic Flow
async function connectWallet() {
  console.log('🔗 Connecting wallet...');
  
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    alert('Phantom wallet not found. Please install Phantom.');
    return;
  }
  
  try {
    const resp = await provider.connect();
    const account = resp?.publicKey || provider.publicKey;
    if (!account) {
      alert('Failed to connect wallet');
      return;
    }
    
    const address = account.toString();
    
    // 🔄 WALLET SWITCH DETECTION - Clear old state if switching wallets
    const previousAddress = state.address;
    if (previousAddress && previousAddress !== address) {
      console.log(`🔄 Wallet switched from ${previousAddress.slice(0, 8)}... to ${address.slice(0, 8)}...`);
      
      // Clear old wallet's cache and state
      LAND_STATUS_CACHE.clearCache(previousAddress);
      hideMandatoryLandModal();
      stopMining();
      stopStatusPolling();
    }
    
    // 📝 SET NEW WALLET STATE
    state.wallet = provider;
    state.address = address;
    localStorage.setItem('gm_address', address);
    
    console.log('✅ Wallet connected:', address.slice(0, 8) + '...');
    
    // 💰 UPDATE WALLET BALANCE
    await updateWalletBalance();
    updateConnectButtonDisplay();
    
    // 📊 LOAD USER DATA FROM DATABASE
    console.log('📊 Loading user data from database...');
    const userData = await loadInitialUserData();
    
    if (userData) {
      // Update display with loaded data
      updateDisplay({
        gold: userData.last_checkpoint_gold || 0,
        inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        checkpoint: {
          total_mining_power: userData.total_mining_power || 0,
          checkpoint_timestamp: userData.checkpoint_timestamp,
          last_checkpoint_gold: userData.last_checkpoint_gold || 0
        }
      });
      
      state.checkpoint = {
        total_mining_power: userData.total_mining_power || 0,
        checkpoint_timestamp: userData.checkpoint_timestamp,
        last_checkpoint_gold: userData.last_checkpoint_gold || 0
      };
      
      console.log('✅ User data loaded and displayed');
    } else {
      console.log('ℹ️ New user - starting with empty state');
      updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
    }
    
    // 🏞️ STEP 1: CHECK LAND STATUS FROM API (ONLY ON WALLET CONNECT)
    console.log('🔍 Step 1: Checking land status from API...');
    const hasLand = await LAND_STATUS_CACHE.checkLandStatus(address);
    
    if (hasLand === true) {
      // ✅ USER HAS LAND
      console.log('✅ User has land - updating UI');
      LAND_STATUS_CACHE.setLandStatus(address, true);
      hideMandatoryLandModal();
      
      // 📱 STEP 2: UPDATE REFER & EARN + PROMOTER POPUPS (show share links)
      setTimeout(() => {
        updateReferralStatus(); // Show share link
        updatePromotersStatus(); // Show share link
      }, 500);
      
    } else {
      // ❌ USER NEEDS LAND
      console.log('❌ User needs land - showing purchase popup');
      LAND_STATUS_CACHE.setLandStatus(address, false);
      showMandatoryLandModal();
      
      // Don't show share links until they buy land
    }
    
    // 🎁 CHECK REFERRAL COMPLETION
    await autoCheckReferralCompletion();
    
  } catch (e) {
    console.error('❌ Wallet connection failed:', e);
    alert('Failed to connect wallet: ' + e.message);
  }
}

// 🛒 Buy pickaxe function (EXACT COPY FROM WORKING VERSION)
async function buyPickaxe(pickaxeType) {
  if (!state.address) {
    $('#shopMsg').textContent = 'Please connect your wallet first!';
    $('#shopMsg').style.color = '#f44336';
    return;
  }

  try {
    console.log('🛒 Buying pickaxe:', pickaxeType);
    
    const quantityInput = $(`#qty-${pickaxeType}`);
    const quantity = parseInt(quantityInput?.value) || 1;
    
    $('#shopMsg').textContent = `Creating ${pickaxeType} pickaxe transaction...`;
    $('#shopMsg').style.color = '#2196F3';
    
    // Build transaction (SERVER CREATES THE TRANSACTION)
    const r1 = await fetch('/api/purchase-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity }),
    });
    const j1 = await r1.json();
    if (j1.error) throw new Error(j1.error);

    const txBytes = Uint8Array.from(atob(j1.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);

    // Sign and send (NO CLIENT-SIDE BUFFER NEEDED!)
    $('#shopMsg').textContent = 'Please sign the transaction in your wallet...';
    $('#shopMsg').style.color = '#FF9800';
    
    const sig = await state.wallet.signAndSendTransaction(tx);
    $('#shopMsg').textContent = `⏳ Transaction sent! Waiting for blockchain confirmation...`;
    $('#shopMsg').style.color = '#2196F3';
    
    console.log('⏳ Waiting for blockchain to confirm transaction:', sig.signature);

    // Confirm with server (this may take up to 15 seconds with retries)
    const r2 = await fetch('/api/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity, signature: sig.signature }),
    });
    
    if (!r2.ok) {
      const errorText = await r2.text();
      let errorObj;
      try {
        errorObj = JSON.parse(errorText);
      } catch (e) {
        throw new Error(`Purchase confirmation failed: ${errorText}`);
      }
      
      // If it's a "transaction not found" error, give helpful advice
      if (errorObj.error && errorObj.error.includes('Transaction not found')) {
        throw new Error('Transaction is still processing on the blockchain. Please wait 10 seconds and click "Refresh Status" or refresh the page. Your purchase will appear once confirmed.');
      }
      
      throw new Error(`Purchase confirmation failed: ${errorObj.error || errorText}`);
    }
    
    const responseText = await r2.text();
    let j2;
    try {
      j2 = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
    }
    
    if (j2.error) throw new Error(j2.error);

    $('#shopMsg').textContent = `✅ Successfully purchased ${quantity}x ${pickaxeType} pickaxe!`;
    $('#shopMsg').style.color = '#4CAF50';
    
    // Update inventory optimistically
    const predictedInventory = { ...state.status.inventory };
    predictedInventory[pickaxeType] = (predictedInventory[pickaxeType] || 0) + quantity;
    
    // Update UI immediately
    state.status.inventory = predictedInventory;
    updateDisplay({
      gold: state.status.gold,
      inventory: predictedInventory,
      checkpoint: state.checkpoint
    });
    
    // 🎁 CRITICAL: Check if referral can be completed now
    console.log('🎁 Pickaxe purchased - checking referral completion...');
    await autoCheckReferralCompletion();
    
    // 🔥 CRITICAL FIX: Update state with server response properly
    const serverInventory = j2.inventory || j2.newInventory;
    if (serverInventory) {
      state.status.inventory = serverInventory;
      console.log('✅ Updated inventory after SOL purchase:', serverInventory);
    }
    
    // Update checkpoint for mining
    const now = Math.floor(Date.now() / 1000);
    const newMiningPower = j2.miningPower || j2.checkpoint?.total_mining_power || 0;
    
    state.checkpoint = {
      total_mining_power: newMiningPower,
      checkpoint_timestamp: now,
      last_checkpoint_gold: state.status.gold || 0
    };
    
    console.log('✅ Updated checkpoint after SOL purchase:', state.checkpoint);
    
    // Update UI immediately with new values
    updateDisplay({
      gold: state.status.gold,
      inventory: serverInventory || state.status.inventory,
      checkpoint: state.checkpoint
    });
    
    // Restart mining engine with new checkpoint
    if (state.checkpoint.total_mining_power > 0) {
      console.log('⛏️ Restarting mining engine after SOL purchase:', state.checkpoint.total_mining_power);
      console.log('⛏️ New checkpoint data:', state.checkpoint);
      
      // Force stop the old engine
      if (state.optimizedMiningEngine && state.optimizedMiningEngine.isRunning) {
        console.log('🛑 Stopping old mining engine...');
        state.optimizedMiningEngine.stop();
        
        // Wait a moment for the engine to fully stop
        setTimeout(() => {
          console.log('▶️ Starting new mining engine with updated checkpoint...');
          startCheckpointGoldLoop();
        }, 100);
      } else {
        startCheckpointGoldLoop();
      }
    }
    
    // 💾 NEW: Save checkpoint after purchase (server already saved, this is client confirmation)
    console.log('💾 Pickaxe purchase complete - checkpoint already saved by server');
    
    // Update wallet balance
    await updateWalletBalance();
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      $('#shopMsg').textContent = '';
    }, 3000);
    
  } catch (error) {
    console.error('❌ Purchase failed:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('User rejected')) {
      errorMessage = 'Transaction cancelled by user';
    } else if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient SOL balance for purchase';
    }
    
    $('#shopMsg').textContent = `❌ Purchase failed: ${errorMessage}`;
    $('#shopMsg').style.color = '#f44336';
    
    // Clear message after 5 seconds
    setTimeout(() => {
      $('#shopMsg').textContent = '';
    }, 5000);
  }
}

// 💰 Update wallet balance
async function updateWalletBalance() {
  if (!state.wallet || !state.address) {
    return;
  }
  
  try {
    // Check if Solana Web3 library is loaded
    if (typeof solanaWeb3 === 'undefined') {
      console.error('Solana Web3 library not loaded');
      state.solBalance = 'Error';
      updateConnectButtonDisplay();
      return;
    }
    
    const publicKey = new solanaWeb3.PublicKey(state.address);
    const balance = await state.connection.getBalance(publicKey);
    const solBalance = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3);
    state.solBalance = solBalance;
    
    updateConnectButtonDisplay();
    
  } catch (e) {
    console.error('Failed to fetch balance:', e);
    state.solBalance = 'Error';
    updateConnectButtonDisplay();
  }
}

// 🔄 Update connect button display
function updateConnectButtonDisplay() {
  const connectBtn = $('#connectBtn');
  if (!connectBtn) return;
  
  if (state.address && state.solBalance !== undefined) {
    const shortAddress = state.address.slice(0, 6) + '...' + state.address.slice(-4);
    connectBtn.innerHTML = `
      <div style="font-size: 10px; line-height: 1.2;">
        <div>🔗 ${shortAddress}</div>
        <div>💳 ${state.solBalance} SOL</div>
      </div>
    `;
    connectBtn.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
    connectBtn.style.padding = '8px 12px';
    connectBtn.style.fontSize = '10px';
  } else {
    connectBtn.textContent = '🔗 Connect Wallet';
    connectBtn.style.background = 'linear-gradient(45deg, var(--primary), #00b894)';
    connectBtn.style.padding = '6px 12px';
    connectBtn.style.fontSize = '11px';
  }
}

// 📊 Load initial user data from database
async function loadInitialUserData() {
  if (!state.address) {
    console.log('⚠️ Cannot load user data - no wallet connected');
    return null;
  }

  try {
    console.log('📡 Loading user data from database (one-time load)...');
    
    const response = await fetch(`/api/status?address=${encodeURIComponent(state.address)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const userData = await response.json();
    if (userData.error) throw new Error(userData.error);
    
    console.log('✅ User data loaded from database:', userData);
    
    const checkpointData = {
      last_checkpoint_gold: userData.gold || 0,
      inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
      total_mining_power: userData.checkpoint?.total_mining_power || 0,
      checkpoint_timestamp: userData.checkpoint?.checkpoint_timestamp || Math.floor(Date.now() / 1000)
    };
    
    console.log('📊 Checkpoint data for engine:', checkpointData);
    return checkpointData;
    
  } catch (error) {
    console.error('❌ Failed to load user data:', error.message);
    return null;
  }
}

// 🔄 Update display with user data
function updateDisplay(data) {
  console.log('🔄 updateDisplay called with data:', data);
  
  const serverGold = data.gold || 0;
  const serverInventory = data.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  
  // Update gold display
  const totalGoldEl = $('#totalGold');
  if (totalGoldEl) {
    const safeGold = parseFloat(serverGold) || 0;
    totalGoldEl.textContent = safeGold.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    console.log('✅ Gold display updated to:', totalGoldEl.textContent);
  }
  
  // Update total pickaxes
  const totalPickaxes = Object.values(serverInventory).reduce((sum, count) => sum + count, 0);
  const totalPickaxesEl = $('#totalPickaxes');
  if (totalPickaxesEl) {
    totalPickaxesEl.textContent = totalPickaxes.toLocaleString();
    console.log('✅ Updated totalPickaxes display to:', totalPickaxes);
  }
  
  // Update mining rate
  let totalRate = 0;
  totalRate += (serverInventory.silver || 0) * 1;
  totalRate += (serverInventory.gold || 0) * 10;
  totalRate += (serverInventory.diamond || 0) * 100;
  totalRate += (serverInventory.netherite || 0) * 1000;
  
  const miningRateEl = $('#miningRate');
  if (miningRateEl) {
    miningRateEl.textContent = totalRate.toLocaleString() + '/min';
  }
  
  const currentMiningRateEl = $('#currentMiningRate');
  if (currentMiningRateEl) {
    currentMiningRateEl.textContent = `+${totalRate.toLocaleString()} gold/min`;
  }
  
  // Update owned pickaxes in shop
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const ownedEl = $(`#owned-${type}`);
    const count = serverInventory[type] || 0;
    if (ownedEl) {
      if (count > 0) {
        ownedEl.textContent = `Owned: ${count}`;
        ownedEl.style.display = 'block';
      } else {
        ownedEl.style.display = 'none';
      }
    }
  });
  
  // Update mining status
  const miningStatusEl = $('#miningStatus');
  if (miningStatusEl) {
    if (totalPickaxes > 0) {
      const statusText = `Mining with ${totalPickaxes} pickaxe${totalPickaxes === 1 ? '' : 's'}`;
      miningStatusEl.textContent = statusText;
    } else {
      miningStatusEl.textContent = '💤 Buy pickaxes to start mining!';
    }
  }
  
  // Update pickaxe inventory grid
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const countEl = $(`#${type}-count`);
    const itemEl = $(`.inventory-item[data-type="${type}"]`);
    const count = serverInventory[type] || 0;
    
    if (countEl) {
      countEl.textContent = count;
    }
    
    if (itemEl) {
      itemEl.setAttribute('data-count', count);
      if (count > 0) {
        itemEl.style.opacity = '1';
      } else {
        itemEl.style.opacity = '0.3';
      }
    }
  });
}

// 🔄 Refresh status from server
async function refreshStatus(afterPurchase = false) {
  if (!state.address) {
    console.log('⏭️ Skipping status refresh - no wallet connected');
    return;
  }
  
  try {
    console.log('📊 Refreshing status for:', state.address.slice(0, 8) + '...');
    
    const headers = afterPurchase ? { 'x-last-purchase': Date.now().toString() } : {};
    
    const r = await fetch(`/api/status?address=${encodeURIComponent(state.address)}`, {
      headers: headers
    });
    
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    
    state.status = {
      gold: json.gold || 0,
      inventory: json.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }
    };
    
    // Store checkpoint data for real-time calculations
    state.checkpoint = json.checkpoint || {
      total_mining_power: 0,
      checkpoint_timestamp: Math.floor(Date.now() / 1000),
      last_checkpoint_gold: json.gold || 0
    };
    
    console.log('📈 Raw server data:', json);
    updateDisplay(json);
    
    // Start mining if checkpoint exists
    if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
      console.log('⛏️ Found existing mining power, starting mining...');
      startCheckpointGoldLoop();
    }
    
    console.log('✅ Status updated successfully');
    
  } catch (e) {
    console.error('❌ Status refresh failed:', e.message);
  }
}

// ⚡ ULTRA-OPTIMIZED: No setInterval timers - uses requestAnimationFrame for 500K+ user support
function startCheckpointGoldLoop() {
  // Clear any old timer-based system
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
    state.goldUpdateInterval = null;
  }
  
  console.log('🚀 Starting OPTIMIZED checkpoint gold loop (NO TIMERS!)');
  
  // Create optimized mining engine
  if (!state.optimizedMiningEngine) {
    state.optimizedMiningEngine = {
      animationId: null,
      isRunning: false,
      lastUpdate: 0,
      updateFrequency: 500, // Update every 500ms instead of 1000ms for smoother feel
      
      start(checkpoint) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.checkpoint = checkpoint;
        this.animate();
      },
      
      stop() {
        this.isRunning = false;
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
      },
      
      animate() {
        if (!this.isRunning) return;
        
        const now = performance.now();
        if (now - this.lastUpdate >= this.updateFrequency) {
          this.updateDisplay();
          this.lastUpdate = now;
        }
        
        // Continue animation loop
        this.animationId = requestAnimationFrame(() => this.animate());
      },
      
      updateDisplay() {
        if (!this.checkpoint || !this.checkpoint.total_mining_power) return;
        
        const currentGold = calculateGoldFromCheckpoint(this.checkpoint);
        
        const totalGoldEl = $('#totalGold');
        if (totalGoldEl) {
          const safeGold = parseFloat(currentGold) || 0;
          totalGoldEl.textContent = safeGold.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }
        
        state.status.gold = currentGold;
        
        const miningRateEl = $('#currentMiningRate');
        if (miningRateEl) {
          const miningPower = this.checkpoint.total_mining_power || 0;
          if (miningPower > 0) {
            miningRateEl.textContent = `+${miningPower.toLocaleString()} gold/min`;
          }
        }
      }
    };
  }
  
  // Start the optimized engine with fresh checkpoint
  if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
    // Force update the checkpoint even if engine is running
    if (state.optimizedMiningEngine.isRunning) {
      console.log('⚠️ Mining engine already running, forcing checkpoint update...');
      state.optimizedMiningEngine.checkpoint = state.checkpoint;
    } else {
      state.optimizedMiningEngine.start(state.checkpoint);
    }
  }
}

// 🧮 Calculate current gold from checkpoint data
function calculateGoldFromCheckpoint(checkpoint) {
  if (!checkpoint || !checkpoint.total_mining_power) {
    return parseFloat(checkpoint?.last_checkpoint_gold) || 0;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const checkpointTime = parseInt(checkpoint.checkpoint_timestamp, 10);
  const timeSinceCheckpoint = currentTime - checkpointTime;
  const goldPerSecond = parseFloat(checkpoint.total_mining_power) / 60;
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  const baseGold = parseFloat(checkpoint.last_checkpoint_gold) || 0;
  
  return baseGold + goldMined;
}

// 💾 Save checkpoint to server (called on actions and page close)
async function saveCheckpoint(goldAmount = null) {
  if (!state.address || !state.checkpoint) {
    console.log('⚠️ Cannot save checkpoint - no wallet or checkpoint data');
    return;
  }
  
  try {
    // Calculate current gold if not provided
    const currentGold = goldAmount !== null ? goldAmount : calculateGoldFromCheckpoint(state.checkpoint);
    const timestamp = Math.floor(Date.now() / 1000);
    
    console.log('💾 Saving checkpoint:', {
      address: state.address.slice(0, 8) + '...',
      gold: currentGold.toFixed(2),
      timestamp
    });
    
    const response = await fetch('/api/save-checkpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        gold: currentGold,
        timestamp: timestamp,
        finalSync: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Checkpoint saved successfully:', result.checkpoint);
      return result.checkpoint;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Failed to save checkpoint:', error);
    return null;
  }
}

// 🛑 OPTIMIZED: Stop mining function for new system
function stopMining() {
  // Stop old timer-based system
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
    state.goldUpdateInterval = null;
  }
  
  // Stop new optimized system
  if (state.optimizedMiningEngine) {
    state.optimizedMiningEngine.stop();
    console.log('🛑 Optimized mining engine stopped');
  }
}

function stopStatusPolling() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

// 🔄 Auto-reconnect wallet on page refresh
async function autoReconnectWallet() {
  try {
    const savedAddress = localStorage.getItem('gm_address');
    if (!savedAddress) {
      console.log('🔄 No saved wallet address found');
      return;
    }
    
    console.log('🔄 Found saved wallet address, attempting auto-reconnect...', savedAddress.slice(0, 8) + '...');
    
    const provider = window.solana || window.phantom?.solana;
    if (!provider) {
      console.log('⚠️ Phantom wallet not available for auto-reconnect');
      return;
    }
    
    // Check if wallet is already connected
    if (provider.isConnected && provider.publicKey) {
      const currentAddress = provider.publicKey.toString();
      
      if (currentAddress === savedAddress) {
        console.log('✅ Phantom wallet already connected, restoring session...');
        
        state.wallet = provider;
        state.address = savedAddress;
        
        console.log('✅ Wallet auto-reconnected:', savedAddress.slice(0, 8) + '...');
        
        // Update wallet balance
        await updateWalletBalance();
        updateConnectButtonDisplay();
        
        // Load user data from database
        const userData = await loadInitialUserData();
        
        if (userData) {
          console.log('✅ User data restored after refresh:', userData);
          
          // Update display with loaded data
          updateDisplay({
            gold: userData.last_checkpoint_gold || 0,
            inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
            checkpoint: {
              total_mining_power: userData.total_mining_power || 0,
              checkpoint_timestamp: userData.checkpoint_timestamp,
              last_checkpoint_gold: userData.last_checkpoint_gold || 0
            }
          });
          
          // Store checkpoint for real-time updates
          state.checkpoint = {
            total_mining_power: userData.total_mining_power || 0,
            checkpoint_timestamp: userData.checkpoint_timestamp,
            last_checkpoint_gold: userData.last_checkpoint_gold || 0
          };
          
          // Start mining if has mining power
          if (state.checkpoint.total_mining_power > 0) {
            console.log('⛏️ Resuming mining after page refresh...');
            startCheckpointGoldLoop();
          }
          
          console.log('🎉 Wallet auto-reconnect and data restore complete!');
        } else {
          console.log('ℹ️ New user after auto-reconnect');
          updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
        }
        
        // 🏞️ CHECK LAND STATUS AFTER AUTO-RECONNECT (CACHE ONLY)
        console.log('🔍 Checking land status after auto-reconnect (cache only)...');
        const cachedData = LAND_STATUS_CACHE.memoryCache.get(savedAddress);
        let hasLand = cachedData ? cachedData.hasLand : null;
        
        // If no cache, make ONE API call
        if (hasLand === null) {
          console.log('📡 No cache found, making single API call...');
          hasLand = await LAND_STATUS_CACHE.checkLandStatus(savedAddress);
        }
        
        if (hasLand === true) {
          console.log('✅ Auto-reconnect: User has land');
          hideMandatoryLandModal();
          // Show share links
          setTimeout(() => {
            updateReferralStatus();
            updatePromotersStatus();
          }, 500);
        } else {
          console.log('❌ Auto-reconnect: User needs land');
          showMandatoryLandModal();
        }
        
        // Setup wallet switch detection
        setupWalletSwitchDetection(provider);
        
      } else {
        console.log('⚠️ Connected wallet address differs from saved address - wallet switched');
        await handleWalletSwitch(currentAddress, provider);
      }
    } else {
      // Try to reconnect automatically
      console.log('🔄 Wallet not connected, attempting silent reconnect...');
      
      try {
        // Try silent connect (will only work if previously connected)
        const resp = await provider.connect({ onlyIfTrusted: true });
        const account = resp?.publicKey || provider.publicKey;
        
        if (account && account.toString() === savedAddress) {
          console.log('✅ Silent reconnection successful');
          
          state.wallet = provider;
          state.address = savedAddress;
          
          await updateWalletBalance();
          updateConnectButtonDisplay();
          
          const userData = await loadInitialUserData();
          if (userData) {
            updateDisplay({
              gold: userData.last_checkpoint_gold || 0,
              inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }
            });
            
            state.checkpoint = {
              total_mining_power: userData.total_mining_power || 0,
              checkpoint_timestamp: userData.checkpoint_timestamp,
              last_checkpoint_gold: userData.last_checkpoint_gold || 0
            };
            
            if (state.checkpoint.total_mining_power > 0) {
              startCheckpointGoldLoop();
            }
          }
          
          // 🏞️ CHECK LAND STATUS AFTER SILENT RECONNECT (CACHE ONLY)
          console.log('🔍 Checking land status after silent reconnect (cache only)...');
          const cachedData = LAND_STATUS_CACHE.memoryCache.get(savedAddress);
          let hasLand = cachedData ? cachedData.hasLand : null;
          
          // If no cache, make ONE API call
          if (hasLand === null) {
            console.log('📡 No cache found, making single API call...');
            hasLand = await LAND_STATUS_CACHE.checkLandStatus(savedAddress);
          }
          
          if (hasLand === true) {
            console.log('✅ Silent reconnect: User has land');
            hideMandatoryLandModal();
            // Show share links
            setTimeout(() => {
              updateReferralStatus();
              updatePromotersStatus();
            }, 500);
          } else {
            console.log('❌ Silent reconnect: User needs land');
            showMandatoryLandModal();
          }
          
          setupWalletSwitchDetection(provider);
          
        } else {
          console.log('⚠️ Silent reconnection failed or different wallet');
        }
        
      } catch (silentConnectError) {
        console.log('ℹ️ Silent reconnection not available - user needs to connect manually');
        // This is normal - just means user needs to click connect
      }
    }
    
  } catch (error) {
    console.error('❌ Auto-reconnect failed:', error);
    // Clear potentially corrupted saved address
    localStorage.removeItem('gm_address');
  }
}

// 🔄 Setup wallet switch detection
function setupWalletSwitchDetection(provider) {
  if (!provider) return;
  
  provider.on('accountChanged', (publicKey) => {
    if (publicKey) {
      console.log('🔄 Wallet switched to:', publicKey.toString().slice(0, 8) + '...');
      handleWalletSwitch(publicKey.toString(), provider);
    } else {
      console.log('🔄 Wallet disconnected');
      handleWalletDisconnect();
    }
  });
}

// 🔄 CLEAN WALLET SWITCH HANDLER
async function handleWalletSwitch(newAddress, provider) {
  const previousAddress = state.address;
  
  console.log(`🔄 Wallet switch: ${previousAddress?.slice(0, 8)}... → ${newAddress.slice(0, 8)}...`);
  
  // 🧹 CLEAN UP OLD WALLET STATE
  stopMining();
  stopStatusPolling();
  if (previousAddress) {
    LAND_STATUS_CACHE.clearCache(previousAddress);
  }
  hideMandatoryLandModal();
  
  // 📝 SET NEW WALLET STATE
  state.wallet = provider;
  state.address = newAddress;
  localStorage.setItem('gm_address', newAddress);
  
  // 💰 UPDATE UI FOR NEW WALLET
  await updateWalletBalance();
  updateConnectButtonDisplay();
  
  // 📊 LOAD NEW WALLET DATA
  const userData = await loadInitialUserData();
  if (userData) {
    updateDisplay({
      gold: userData.last_checkpoint_gold || 0,
      inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }
    });
    
    state.checkpoint = {
      total_mining_power: userData.total_mining_power || 0,
      checkpoint_timestamp: userData.checkpoint_timestamp,
      last_checkpoint_gold: userData.last_checkpoint_gold || 0
    };
    
    if (state.checkpoint.total_mining_power > 0) {
      startCheckpointGoldLoop();
    }
  } else {
    updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
  }
  
  // 🏞️ CHECK LAND STATUS FOR NEW WALLET (CACHE ONLY)
  console.log('🔍 Checking land status for new wallet (cache only)...');
  const cachedData = LAND_STATUS_CACHE.memoryCache.get(newAddress);
  let hasLand = cachedData ? cachedData.hasLand : null;
  
  // If no cache, make ONE API call
  if (hasLand === null) {
    console.log('📡 No cache found for new wallet, making single API call...');
    hasLand = await LAND_STATUS_CACHE.checkLandStatus(newAddress);
  }
  
  if (hasLand === true) {
    console.log('✅ New wallet has land');
    LAND_STATUS_CACHE.setLandStatus(newAddress, true);
    hideMandatoryLandModal();
    // Show share links
    setTimeout(() => {
      updateReferralStatus();
      updatePromotersStatus();
    }, 500);
  } else {
    console.log('❌ New wallet needs land');
    LAND_STATUS_CACHE.setLandStatus(newAddress, false);
    showMandatoryLandModal();
  }
  
  console.log('✅ Wallet switch completed');
}

// 🔄 Handle wallet disconnect
function handleWalletDisconnect() {
  console.log('🔄 Handling wallet disconnect...');
  
  // Stop mining and polling
  stopMining();
  stopStatusPolling();
  
  // Clear state
  state.wallet = null;
  state.address = null;
  state.solBalance = 0;
  
  // Clear storage
  localStorage.removeItem('gm_address');
  
  // Reset UI
  updateConnectButtonDisplay();
  updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
  
  console.log('✅ Wallet disconnect handled');
}

// ✅ REMOVED OLD COMPLEX LAND STATUS CHECK FUNCTION
// The new clean logic is now handled directly in:
// - connectWallet()
// - handleWalletSwitch() 
// - autoReconnectWallet()
// This prevents infinite loops and API calls

// 🚩 GET LAND OWNERSHIP FLAG FROM CACHE
function getLandOwnershipFlag(address) {
  const cacheKey = `gm_land_${address}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    const data = JSON.parse(cached);
    console.log('📦 Land flag from cache:', data);
    return {
      hasLand: data.hasLand,
      lastChecked: data.timestamp
    };
  }
  
  console.log('📦 No land flag cache found for address');
  return {
    hasLand: null,
    lastChecked: 0
  };
}

// 🚩 SET LAND OWNERSHIP FLAG IN CACHE AND DATABASE
function setLandOwnershipFlag(address, hasLand) {
  const now = Date.now();
  const flagData = {
    hasLand: hasLand,
    timestamp: now
  };
  
  // Store in localStorage for instant access
  const cacheKey = `gm_land_${address}`;
  localStorage.setItem(cacheKey, JSON.stringify(flagData));
  
  // Update global state
  state.landFlags.hasLand = hasLand;
  state.landFlags.lastChecked = now;
  
  console.log('🚩 Land ownership flag set:', { address: address.slice(0, 8) + '...', hasLand, timestamp: now });
  
  // Optional: Sync to database for cross-device consistency
  syncLandFlagToDatabase(address, hasLand);
}

// 🔄 SYNC LAND FLAG TO DATABASE (NON-BLOCKING) - DISABLED FOR NOW
async function syncLandFlagToDatabase(address, hasLand) {
  // DISABLED: API endpoint doesn't exist yet
  // Cache-only approach is sufficient for preventing infinite loops
  console.log('📝 Land flag would sync to database:', { address: address.slice(0,8) + '...', hasLand });
  
  // TODO: Create /api/sync-land-flag endpoint later if needed
  // For now, localStorage cache is sufficient to prevent infinite loops
}

// ✅ REMOVED OLD COMPLEX LAND FLAG RESET FUNCTION
// Land flag reset is now handled simply by:
// LAND_STATUS_CACHE.clearCache(previousAddress) in handleWalletSwitch()

// 🚨 Show mandatory land purchase modal
function showMandatoryLandModal() {
  console.log('🚨 Showing mandatory land purchase modal...');
  
  const landModal = $('#landModal');
  if (landModal) {
    landModal.style.display = 'flex';
    
    // Store in localStorage that user needs to buy land
    localStorage.setItem('gm_needs_land_' + state.address, 'true');
    
    // Disable page interactions (optional - prevent clicking other elements)
    document.body.style.overflow = 'hidden';
    
    console.log('🚨 Mandatory land modal displayed - user must purchase land');
  }
}

// ✅ Hide mandatory land purchase modal
function hideMandatoryLandModal() {
  console.log('✅ Hiding mandatory land purchase modal...');
  
  const landModal = $('#landModal');
  if (landModal) {
    landModal.style.display = 'none';
    
    // Clear localStorage flag
    if (state.address) {
      localStorage.removeItem('gm_needs_land_' + state.address);
    }
    
    // Re-enable page interactions
    document.body.style.overflow = 'auto';
    
    console.log('✅ Mandatory land modal hidden - user has access');
  }
}

// 🏞️ Check if user needs to buy land (for auto-show on refresh)
function checkIfUserNeedsLand() {
  if (!state.address) return false;
  
  const needsLand = localStorage.getItem('gm_needs_land_' + state.address);
  return needsLand === 'true';
}

// 🔧 REFERRAL FIX: Auto-check referral completion function (COPIED FROM WORKING VERSION)
async function autoCheckReferralCompletion() {
  if (!state.address) {
    console.log('⚠️ No wallet connected for referral completion check');
    return;
  }
  
  try {
    console.log('🤝 Auto-checking referral completion for:', state.address.slice(0, 8) + '...');
    
    const response = await fetch('/api/complete-referral', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      credentials: 'include', // 🔧 CRITICAL: Include cookies in request
      body: JSON.stringify({ address: state.address })
    });
    
    const result = await response.json();
    
    // Check if referral was completed AND not already rewarded
    if (result.success && result.referral_completed && !result.already_rewarded) {
      console.log('🎉 REFERRAL COMPLETED!', result);
      
      // Show success notification
      showReferralCompletionNotification(result);
      
      // Update gold directly from referral result (don't fetch from server)
      if (result.newGold !== undefined) {
        console.log('💰 Updating gold from referral completion:', result.newGold);
        state.status.gold = result.newGold;
        if (state.checkpoint) {
          state.checkpoint.last_checkpoint_gold = result.newGold;
          state.checkpoint.checkpoint_timestamp = Math.floor(Date.now() / 1000);
        }
        updateDisplay({
          gold: result.newGold,
          inventory: state.status.inventory,
          checkpoint: state.checkpoint
        });
      }
      
    } else if (result.success && result.referral_completed && result.already_rewarded) {
      console.log('ℹ️ Referral already completed previously - no duplicate reward');
    } else if (result.success && !result.referral_completed) {
      console.log('ℹ️ No referral completion needed:', result.message);
    } else {
      console.log('⚠️ Referral completion check failed:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Auto referral completion check failed:', error);
  }
}

// 🎉 Show referral completion notification
function showReferralCompletionNotification(result) {
  const notification = document.createElement('div');
  notification.id = 'referralCompletionNotification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(45deg, #10b981, #059669);
    color: white;
    padding: 20px 30px;
    border-radius: 15px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 10001;
    font-family: Arial, sans-serif;
    text-align: center;
    animation: slideDown 0.5s ease-out;
    max-width: 400px;
  `;
  
  const rewards = result.reward_details || {};
  
  notification.innerHTML = `
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
      🎉 Referral Reward Earned!
    </div>
    <div style="background: rgba(76, 175, 80, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 2px solid rgba(76, 175, 80, 0.6);">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">🎁 You received:</div>
      <div style="font-size: 18px; font-weight: bold; color: #FFD700;">💰 ${rewards.new_user_gold_bonus || 1000} Gold Bonus!</div>
    </div>
    <div style="font-size: 14px; margin-bottom: 10px; opacity: 0.9;">
      Your referrer also received:
    </div>
    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
      <div>🔨 ${rewards.pickaxe_count || 1}x ${(rewards.pickaxe_type || 'silver').toUpperCase()} Pickaxe</div>
      <div>💰 ${rewards.gold_reward || 100} Gold</div>
    </div>
    <div style="font-size: 12px; opacity: 0.9;">
      Referrals completed: ${rewards.new_referral_count || 1}
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 5px;
      margin-top: 15px;
      cursor: pointer;
      font-weight: bold;
    ">Awesome! ✨</button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 8000);
}

// 🏪 Gold Store Modal Functions
function openGoldStoreModal() {
  console.log('🏪 Opening Gold Store Modal...');
  const modal = $('#goldStoreModal');
  if (modal) {
    modal.style.display = 'flex';
    updateGoldStoreModal();
  }
}

function closeGoldStoreModal() {
  console.log('🏪 Closing Gold Store Modal...');
  const modal = $('#goldStoreModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function updateGoldStoreModal() {
  if (state.status && state.status.inventory) {
    $('#modal-silver-owned-count').textContent = `${state.status.inventory.silver || 0} pickaxes`;
    $('#modal-gold-owned-count').textContent = `${state.status.inventory.gold || 0} pickaxes`;
  }
}

async function buyPickaxeWithGold(pickaxeType, goldCost) {
  if (!state.address) {
    alert('Please connect your wallet first');
    return;
  }

  // 🔥 CRITICAL: Save checkpoint before purchase to get accurate gold count
  console.log('💾 Saving checkpoint before gold purchase to get accurate balance...');
  const currentGoldFromMining = calculateGoldFromCheckpoint(state.checkpoint);
  await saveCheckpoint(currentGoldFromMining);
  
  // Wait a moment for save to complete
  await new Promise(resolve => setTimeout(resolve, 500));

  // Calculate current gold from checkpoint (real-time)
  let currentGold = 0;
  if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
    currentGold = calculateGoldFromCheckpoint(state.checkpoint);
  } else {
    currentGold = state.status.gold || 0;
  }

  console.log(`💰 Current gold for purchase check:`, {
    calculatedGold: currentGold.toFixed(2),
    checkpoint: state.checkpoint,
    statusGold: state.status.gold,
    requiredGold: goldCost
  });

  if (currentGold < goldCost) {
    console.error(`❌ Not enough gold! Need ${goldCost}, have ${currentGold.toFixed(2)}`);
    alert(`Not enough gold! You need ${goldCost.toLocaleString()} gold but only have ${Math.floor(currentGold).toLocaleString()}`);
    return;
  }

  console.log(`🛒 Buying ${pickaxeType} pickaxe with ${goldCost.toLocaleString()} gold...`);
  
  // Show processing message
  const msgEl = $('#modalStoreMsg');
  msgEl.textContent = `Processing purchase...`;
  msgEl.style.color = '#2196F3';
  msgEl.style.display = 'block';
  msgEl.style.borderColor = '#2196F3';

  try {
    // Call the API
    const response = await fetch('/api/buy-with-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        pickaxeType: pickaxeType,
        quantity: 1
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Successfully purchased with gold!', result);
      
      // Show success message prominently
      msgEl.textContent = `✅ Successfully purchased ${pickaxeType.toUpperCase()} pickaxe!`;
      msgEl.style.color = '#4CAF50';
      msgEl.style.display = 'block';
      msgEl.style.borderColor = '#4CAF50';
      msgEl.style.fontSize = '16px';
      msgEl.style.fontWeight = 'bold';
      
      // 🔥 CRITICAL FIX: Update state immediately with server response
      const newInventory = result.newInventory || result.inventory || {
        silver: 0,
        gold: 0,
        diamond: 0,
        netherite: 0
      };

      const newGold = result.goldRemaining || 0;
      const newMiningPower = result.miningPower || 0;

      console.log('🔄 Updating state with server data:', {
        newGold,
        newInventory,
        newMiningPower
      });

      // Update global state
      state.status.gold = newGold;
      state.status.inventory = newInventory;

      // Update checkpoint with new values
      const now = Math.floor(Date.now() / 1000);
      state.checkpoint = {
        total_mining_power: newMiningPower,
        checkpoint_timestamp: now,
        last_checkpoint_gold: newGold
      };

      console.log('✅ State updated, refreshing UI...');

      // Update UI immediately
      updateDisplay({
        gold: newGold,
        inventory: newInventory,
        checkpoint: state.checkpoint
      });

      // Restart mining engine with new checkpoint
      if (state.checkpoint.total_mining_power > 0) {
        console.log('⛏️ Restarting mining engine with new power:', state.checkpoint.total_mining_power);
        console.log('⛏️ New checkpoint data:', state.checkpoint);
        
        // Force stop the old engine
        if (state.optimizedMiningEngine && state.optimizedMiningEngine.isRunning) {
          console.log('🛑 Stopping old mining engine...');
          state.optimizedMiningEngine.stop();
          
          // Wait a moment for the engine to fully stop
          setTimeout(() => {
            console.log('▶️ Starting new mining engine with updated checkpoint...');
            startCheckpointGoldLoop();
          }, 100);
        } else {
          startCheckpointGoldLoop();
        }
      }

      // Update gold store modal prices
      updateGoldStoreModal();
      
      // 🎁 Check if referral can be completed now
      console.log('🎁 Pickaxe purchased with gold - checking referral completion...');
      await autoCheckReferralCompletion();

      // Clear message after 5 seconds
      setTimeout(() => {
        msgEl.textContent = '';
        msgEl.style.display = 'none';
      }, 5000);

    } else {
      throw new Error(result.error || 'Purchase failed');
    }
  } catch (error) {
    console.error('❌ Gold purchase failed:', error);
    
    // Show error message prominently
    msgEl.textContent = `❌ Purchase failed: ${error.message}`;
    msgEl.style.color = '#f44336';
    msgEl.style.display = 'block';
    msgEl.style.borderColor = '#f44336';
    msgEl.style.fontSize = '15px';
    
    // Clear error after 7 seconds
    setTimeout(() => {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
    }, 7000);
  }
}

// 💰 Sell Gold Function
async function sellGold() {
  if (!state.address) {
    alert('Please connect your wallet first');
    return;
  }

  const goldToSell = parseInt($('#goldToSell').value) || 0;
  if (goldToSell <= 0) {
    alert('Please enter a valid amount of gold to sell');
    return;
  }

  // Calculate real-time gold including mined gold
  let currentGold = 0;
  
  // Try to get gold from optimized mining engine first (most accurate)
  if (state.optimizedMiningEngine && state.optimizedMiningEngine.getCurrentGold) {
    currentGold = state.optimizedMiningEngine.getCurrentGold();
    console.log(`💰 Current gold from mining engine: ${currentGold}`);
  } 
  // Fallback to checkpoint calculation
  else if (state.checkpoint) {
    currentGold = calculateGoldFromCheckpoint(state.checkpoint);
    console.log(`💰 Current gold from checkpoint: ${currentGold}`);
  }
  // Last resort: use status gold
  else {
    currentGold = state.status.gold || 0;
    console.log(`💰 Current gold from status: ${currentGold}`);
  }
  
  console.log(`💰 Final gold for selling check: ${currentGold}`);
  console.log(`💰 User wants to sell: ${goldToSell}`);
  console.log(`💰 state.checkpoint exists: ${!!state.checkpoint}`);
  console.log(`💰 state.optimizedMiningEngine exists: ${!!state.optimizedMiningEngine}`);
  
  if (goldToSell > currentGold) {
    alert(`Not enough gold! You have ${Math.floor(currentGold).toLocaleString()} gold available`);
    return;
  }

  if (!state.config) {
    alert('Configuration not loaded. Please refresh the page.');
    return;
  }

  if (goldToSell < state.config.minSellGold) {
    alert(`Minimum sell amount is ${state.config.minSellGold.toLocaleString()} gold`);
    return;
  }

  try {
    console.log(`💰 Selling ${goldToSell} gold...`);
    console.log(`💰 state.address:`, state.address);
    console.log(`💰 goldToSell:`, goldToSell);
    
    const requestBody = {
      address: state.address,
      amountGold: goldToSell
    };
    
    console.log(`💰 Request body being sent:`, JSON.stringify(requestBody));
    
    const response = await fetch('/api/sell-working-final', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (result.success) {
      const solAmount = (goldToSell * state.config.goldPriceSol).toFixed(6);
      $('#sellMsg').textContent = `✅ Successfully sold ${goldToSell.toLocaleString()} gold for ${solAmount} SOL! Pending admin approval.`;
      $('#sellMsg').style.color = '#4CAF50';
      $('#goldToSell').value = '';
      
      // 💾 NEW: Save checkpoint after selling gold
      console.log('💾 Saving checkpoint after gold sale...');
      const currentGold = calculateGoldFromCheckpoint(state.checkpoint);
      const newGold = currentGold - goldToSell;
      
      await saveCheckpoint(newGold);
      
      // Update local state
      if (state.checkpoint) {
        state.checkpoint.last_checkpoint_gold = newGold;
        state.checkpoint.checkpoint_timestamp = Math.floor(Date.now() / 1000);
      }
      state.status.gold = newGold;
      
      // Update UI with new gold amount (no need to refresh from server - we have fresh data)
      updateDisplay({
        gold: newGold,
        inventory: state.status.inventory,
        checkpoint: state.checkpoint
      });
      
      console.log('✅ Gold updated after sale, UI refreshed');
    } else {
      throw new Error(result.error || 'Sell failed');
    }
  } catch (error) {
    console.error('❌ Sell failed:', error);
    $('#sellMsg').textContent = `❌ Sell failed: ${error.message}`;
    $('#sellMsg').style.color = '#f44336';
  }
}

// ❓ How It Works Modal Functions
function showHowItWorksModal() {
  console.log('❓ Showing How It Works Modal...');
  const modal = $('#howItWorksModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideHowItWorksModal() {
  console.log('❓ Hiding How It Works Modal...');
  const modal = $('#howItWorksModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 📈 Promoters Modal Functions
function showPromotersModal() {
  console.log('📈 Showing Promoters Modal...');
  const modal = $('#promotersModal');
  if (modal) {
    modal.style.display = 'flex';
    updatePromotersStatus();
  }
}

function closePromotersModal() {
  console.log('📈 Closing Promoters Modal...');
  const modal = $('#promotersModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 🚨 EMERGENCY FIX: Add infinite loop protection
let isUpdatingPromoters = false;
let lastPromoterUpdate = 0;

async function updatePromotersStatus() {
  const now = Date.now();
  
  // PREVENT INFINITE LOOPS - Only allow one update per 10 seconds
  if (isUpdatingPromoters || (now - lastPromoterUpdate) < 10000) {
    console.log('🛑 EMERGENCY: Blocked promoter update to prevent infinite loops and API costs');
    return;
  }
  
  isUpdatingPromoters = true;
  lastPromoterUpdate = now;
  console.log('🔒 EMERGENCY: Promoter update started with 10-second protection');
  
  try {
  const walletConnected = !!state.address;
  let hasLand = false;
  
  // 🚩 CACHE-ONLY CHECK - NO API CALLS
  if (walletConnected) {
    console.log('📈 PROMOTER UPDATE: Using memory cache only (no API)...');
    
    // Check ONLY memory cache - never trigger API calls
    const cachedData = LAND_STATUS_CACHE.memoryCache.get(state.address);
    if (cachedData) {
      hasLand = cachedData.hasLand;
      console.log('📦 PROMOTER: Cache shows hasLand =', hasLand);
    } else {
      console.log('📦 PROMOTER: No cache found, assuming false');
      hasLand = false;
    }
  }
  
  $('#walletStatusPromoters').textContent = walletConnected ? '✅ Connected' : '❌ Not Connected';
  $('#walletStatusPromoters').style.color = walletConnected ? '#4CAF50' : '#f44336';
  
  $('#landStatusPromoters').textContent = hasLand ? '✅ Owned' : '❌ No Land';
  $('#landStatusPromoters').style.color = hasLand ? '#4CAF50' : '#f44336';
  
  if (walletConnected && hasLand) {
    $('#promotersRequirement').style.display = 'none';
    $('#promotersLinkSection').style.display = 'block';
    $('#promotersLink').value = `https://www.thegoldmining.com/?ref=${state.address}`;
  } else {
    $('#promotersRequirement').style.display = 'block';
    $('#promotersLinkSection').style.display = 'none';
  }
  
  } catch (error) {
    console.error('❌ EMERGENCY: Error in updatePromotersStatus:', error);
  } finally {
    // Always unlock after 5 seconds to prevent permanent blocking
    setTimeout(() => {
      isUpdatingPromoters = false;
      console.log('🔓 EMERGENCY: Promoter update protection reset after 5 seconds');
    }, 5000);
  }
}

// ⚔️ Battlezone Modal Functions
function showBattlezoneModal() {
  console.log('⚔️ Showing Battlezone Modal...');
  const modal = $('#battlezoneModal');
  if (modal) {
    modal.style.display = 'flex';
    startBattlezoneCountdown();
  }
}

function closeBattlezoneModal() {
  console.log('⚔️ Closing Battlezone Modal...');
  const modal = $('#battlezoneModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function startBattlezoneCountdown() {
  const targetDate = new Date('January 31, 2026 00:00:00 UTC').getTime();
  
  const countdown = setInterval(() => {
    const now = new Date().getTime();
    const distance = targetDate - now;
    
    if (distance < 0) {
      clearInterval(countdown);
      return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    $('#days').textContent = days.toString().padStart(3, '0');
    $('#hours').textContent = hours.toString().padStart(2, '0');
    $('#minutes').textContent = minutes.toString().padStart(2, '0');
    $('#seconds').textContent = seconds.toString().padStart(2, '0');
  }, 1000);
}

function joinWaitlistBattlezone() {
  alert('Thanks for your interest in Battlezone! You will be notified when it launches.');
}

// 🎄 V2.0 Christmas Modal Functions
function showV2Modal() {
  console.log('🎄 Showing V2.0 Christmas Modal...');
  const modal = $('#v2ComingSoonModal');
  if (modal) {
    modal.style.display = 'flex';
    startChristmasCountdown();
  }
}

function closeV2Modal() {
  console.log('🎄 Closing V2.0 Christmas Modal...');
  const modal = $('#v2ComingSoonModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function startChristmasCountdown() {
  // Christmas countdown functionality
  console.log('🎄 Starting Christmas countdown...');
}

// 🎁 Referral Modal Functions  
function showReferralModal() {
  console.log('🎁 Showing Referral Modal...');
  const modal = $('#referralModal');
  if (modal) {
    modal.style.display = 'flex';
    updateReferralStatus();
  }
}

function closeReferralModal() {
  console.log('🎁 Closing Referral Modal...');
  const modal = $('#referralModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function updateReferralStatus() {
  const walletConnected = !!state.address;
  let hasLand = false;
  
  // 🚩 CACHE-ONLY CHECK - NO API CALLS
  if (walletConnected) {
    console.log('🎁 REFERRAL UPDATE: Using memory cache only (no API)...');
    
    // Check ONLY memory cache - never trigger API calls
    const cachedData = LAND_STATUS_CACHE.memoryCache.get(state.address);
    if (cachedData) {
      hasLand = cachedData.hasLand;
      console.log('📦 REFERRAL: Cache shows hasLand =', hasLand);
    } else {
      console.log('📦 REFERRAL: No cache found, assuming false');
      hasLand = false;
    }
  }
  
  $('#walletStatusReferral').textContent = walletConnected ? '✅ Connected' : '❌ Not Connected';
  $('#walletStatusReferral').style.color = walletConnected ? '#4CAF50' : '#f44336';
  
  $('#landStatusReferral').textContent = hasLand ? '✅ Owned' : '❌ No Land';
  $('#landStatusReferral').style.color = hasLand ? '#4CAF50' : '#f44336';
  
  if (walletConnected && hasLand) {
    $('#referralRequirement').style.display = 'none';
    $('#referralLinkSection').style.display = 'block';
    $('#referralLink').value = `https://www.thegoldmining.com/?ref=${state.address}`;
  } else {
    $('#referralRequirement').style.display = 'block';
    $('#referralLinkSection').style.display = 'none';
  }
}

// 🔥 Netherite Challenge - Show info and open referral modal
function showNetheriteChallengePopup() {
  console.log('🔥 Showing Netherite Challenge popup...');
  
  if (!state.address) {
    alert('Please connect your wallet first to access the Netherite Challenge!');
    return;
  }
  
  // Create modal dynamically
  const existingModal = document.getElementById('netheriteModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'netheriteModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.style.zIndex = '10000';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px; background: linear-gradient(135deg, #1a1a1a, #2d2d2d);">
      <div class="modal-header">
        <div class="modal-title">🔥 NETHERITE CHALLENGE</div>
        <button class="modal-close-btn" onclick="closeNetheriteModal()">✖</button>
      </div>
      
      <div class="modal-body" style="text-align: center;">
        <!-- Icon -->
        <div style="font-size: 80px; margin: 20px 0;">🎁</div>
        
        <!-- Title -->
        <h2 style="color: #ff6b00; font-size: 28px; margin-bottom: 15px;">SECRET DROP FOR YOU!</h2>
        <p style="color: #ffd700; font-size: 16px; font-weight: bold;">🔥 Limited Time Offer! 🔥</p>
        
        <!-- Timer Box -->
        <div style="background: linear-gradient(135deg, #ff6b00, #ff8c00); border-radius: 15px; padding: 20px; margin: 25px 0; box-shadow: 0 5px 20px rgba(255, 107, 0, 0.3);">
          <div style="color: white; font-size: 18px; margin-bottom: 10px;">⏰ Challenge Duration</div>
          <div style="font-size: 48px; font-weight: bold; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">1 HOUR</div>
        </div>
        
        <!-- Description -->
        <div style="background: rgba(255, 107, 0, 0.1); border-left: 4px solid #ff6b00; padding: 20px; border-radius: 10px; text-align: left; margin: 25px 0;">
          <div style="color: #ff6b00; font-size: 18px; font-weight: bold; margin-bottom: 15px;">🎯 HOW IT WORKS:</div>
          <div style="color: var(--text-primary); font-size: 15px; line-height: 1.8;">
            1️⃣ Share your referral link below<br/>
            2️⃣ Get people to join using your link<br/>
            3️⃣ When someone buys a <strong style="color: #ffd700;">NETHERITE PICKAXE</strong> within 1 hour<br/>
            4️⃣ You get a <strong style="color: #ff6b00;">FREE NETHERITE PICKAXE</strong>! 🔥
          </div>
        </div>
        
        <!-- Referral Link -->
        <div style="margin: 25px 0;">
          <div style="color: var(--text-primary); font-size: 14px; margin-bottom: 10px; text-align: left;">🔗 Your Referral Link:</div>
          <div style="display: flex; gap: 10px;">
            <input type="text" id="netheriteReferralLink" readonly 
              value="https://www.thegoldmining.com/?ref=${state.address}"
              style="flex: 1; padding: 12px; background: var(--bg-accent); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
            <button onclick="copyNetheriteLink()" 
              style="padding: 12px 20px; background: #4CAF50; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer;">
              📋 Copy
            </button>
          </div>
        </div>
        
        <!-- Share Buttons -->
        <div style="display: flex; gap: 10px; margin: 25px 0;">
          <button onclick="shareNetheriteOnX()" 
            style="flex: 1; padding: 15px; background: linear-gradient(45deg, #1DA1F2, #0d8bd9); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer;">
            𝕏 Post on X
          </button>
          <button onclick="openReferralModalFromNetherite()" 
            style="flex: 1; padding: 15px; background: linear-gradient(45deg, #FFD700, #FFA500); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer;">
            📱 More Options
          </button>
        </div>
        
        <!-- Important Note -->
        <div style="background: rgba(255, 215, 0, 0.1); border-left: 4px solid #ffd700; padding: 15px; border-radius: 10px; text-align: left; margin-top: 25px;">
          <div style="color: #ffd700; font-size: 14px; font-weight: bold; margin-bottom: 8px;">⚠️ Important:</div>
          <div style="color: var(--text-secondary); font-size: 13px; line-height: 1.6;">
            • Challenge starts when someone clicks your link<br/>
            • They have 1 hour to buy Netherite pickaxe<br/>
            • You can earn this bonus multiple times!<br/>
            • Share your link widely to maximize chances!
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Close Netherite Modal
window.closeNetheriteModal = function() {
  const modal = document.getElementById('netheriteModal');
  if (modal) {
    modal.remove();
  }
};

// Copy Netherite referral link
window.copyNetheriteLink = function() {
  const input = document.getElementById('netheriteReferralLink');
  if (input) {
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = event.target;
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      btn.style.background = '#4CAF50';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '#4CAF50';
      }, 2000);
    });
  }
};

// Share Netherite Challenge on X
window.shareNetheriteOnX = function() {
  const link = `https://www.thegoldmining.com/?ref=${state.address}`;
  const text = `🔥 Join me on Gold Mining Game and get 1000 FREE GOLD!\n\nI'm doing the Netherite Challenge - if you buy Netherite pickaxe in the next hour, I get one FREE! ⏰\n\n${link}\n\n#GoldMining #Solana #Web3Gaming`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

// Open referral modal from Netherite
window.openReferralModalFromNetherite = function() {
  closeNetheriteModal();
  showReferralModal();
};

// 💰 Free Gold Modal Functions
function showFreeGoldModal() {
  console.log('💰 Showing Free Gold Modal...');
  const modal = $('#freeGoldModal');
  if (modal) {
    modal.style.display = 'flex';
    updateFreeGoldStatus();
  }
}

function closeFreeGoldModal() {
  console.log('💰 Closing Free Gold Modal...');
  const modal = $('#freeGoldModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function updateFreeGoldStatus() {
  const walletConnected = !!state.address;
  let hasLand = false;
  
  // Use cache-only check like referral system
  if (walletConnected) {
    console.log('💰 FREE GOLD UPDATE: Using memory cache only (no API)...');
    
    const cachedData = LAND_STATUS_CACHE.memoryCache.get(state.address);
    if (cachedData) {
      hasLand = cachedData.hasLand;
      console.log('📦 FREE GOLD: Cache shows hasLand =', hasLand);
    } else {
      console.log('📦 FREE GOLD: No cache found, assuming false');
      hasLand = false;
    }
  }
  
  $('#walletStatusFreeGold').textContent = walletConnected ? '✅ Connected' : '❌ Not Connected';
  $('#walletStatusFreeGold').style.color = walletConnected ? '#4CAF50' : '#f44336';
  
  $('#landStatusFreeGold').textContent = hasLand ? '✅ Owned' : '❌ No Land';
  $('#landStatusFreeGold').style.color = hasLand ? '#4CAF50' : '#f44336';
  
  if (walletConnected && hasLand) {
    $('#freeGoldRequirement').style.display = 'none';
    $('#freeGoldContent').style.display = 'block';
    $('#freeGoldLink').value = `https://www.thegoldmining.com/?ref=${state.address}`;
  } else {
    $('#freeGoldRequirement').style.display = 'block';
    $('#freeGoldContent').style.display = 'none';
  }
}

function copyFreeGoldLink() {
  const linkInput = $('#freeGoldLink');
  if (linkInput && linkInput.value) {
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(linkInput.value).then(() => {
      const btn = $('#copyFreeGoldLinkBtn');
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.style.background = '#4CAF50';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
      
      console.log('✅ Free Gold link copied to clipboard');
    }).catch(err => {
      console.error('❌ Failed to copy:', err);
      alert('Failed to copy link. Please copy manually.');
    });
  }
}

function postFreeGoldOnX() {
  const link = $('#freeGoldLink').value || 'https://www.thegoldmining.com';
  const text = `🎮 I'm mining gold and earning SOL on this epic blockchain game! Join me and get FREE rewards! 💰⛏️

${link}

#GoldMining #Solana #Web3Gaming #PlayToEarn`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(twitterUrl, '_blank');
  console.log('𝕏 Opening X to post...');
}

// 🏞️ Land Purchase Functions (EXACT COPY FROM WORKING VERSION)
async function purchaseLand() {
  if (!state.address) {
    $('#landMsg').textContent = 'Please connect your wallet first!';
    $('#landMsg').style.color = '#f44336';
    return;
  }
  
  try {
    $('#landMsg').textContent = 'Creating land purchase transaction...';
    $('#landMsg').style.color = '#2196F3';
    
    // Create land purchase transaction (SERVER CREATES THE TRANSACTION)
    const response = await fetch('/api/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    $('#landMsg').textContent = 'Please sign the transaction in your wallet...';
    $('#landMsg').style.color = '#FF9800';
    
    // Sign and send transaction (NO CLIENT-SIDE BUFFER NEEDED!)
    const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);
    
    const sig = await state.wallet.signAndSendTransaction(tx);
    $('#landMsg').textContent = `Transaction submitted: ${sig.signature.slice(0, 8)}...`;
    $('#landMsg').style.color = '#2196F3';
    
    // Confirm purchase
    const confirmResponse = await fetch('/api/confirm-land-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address, 
        signature: sig.signature 
      })
    });
    
    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text();
      throw new Error(`Confirm failed: ${errorText}`);
    }
    
    const confirmData = await confirmResponse.json();
    if (confirmData.error) throw new Error(confirmData.error);
    
    console.log('✅ Land purchase confirmed successfully!');
    console.log('📊 Confirm data:', confirmData);
    
    // 🎁 Update gold if referral bonus was awarded
    if (confirmData.gold !== undefined) {
      console.log(`💰 Updating gold from land purchase: ${confirmData.gold}`);
      state.status.gold = confirmData.gold;
      
      if (confirmData.checkpoint) {
        state.checkpoint = {
          last_checkpoint_gold: confirmData.checkpoint.last_checkpoint_gold,
          checkpoint_timestamp: confirmData.checkpoint.checkpoint_timestamp,
          total_mining_power: confirmData.checkpoint.total_mining_power
        };
        console.log('✅ Updated checkpoint with referral bonus:', state.checkpoint);
      }
      
      // Update display immediately
      updateDisplay({
        gold: confirmData.gold,
        inventory: state.status.inventory || {},
        checkpoint: state.checkpoint
      });
    }
    
    // Show success message
    $('#landMsg').textContent = '✅ Land purchased successfully!';
    $('#landMsg').style.color = '#4CAF50';
    
    // Add referral bonus message if awarded
    if (confirmData.referralBonus && confirmData.referralBonus.awarded) {
      $('#landMsg').textContent = `✅ Land purchased! You received 1,000 gold bonus! 🎁`;
    }
    
    // 🚩 CRITICAL FIX: Update cache and database status
    LAND_STATUS_CACHE.setLandStatus(state.address, true);
    console.log('🚩 Cache updated: User now has land after purchase');
    
    // Hide the mandatory modal
    hideMandatoryLandModal();
    
    // Update UI to reflect land ownership (show share links)
    setTimeout(() => {
      updatePromotersStatus(); // Show promoter share link
      updateReferralStatus();  // Show referral share link
    }, 1000);
    
    // Update wallet balance
    await updateWalletBalance();
    
    // Refresh status
    await refreshStatus(true);
    
    // 🎁 CRITICAL: Check if referral can be completed now
    console.log('🎁 Land purchased - checking referral completion...');
    await autoCheckReferralCompletion();
    
    console.log('🎉 Land purchase complete - user now has access!');
    
  } catch (error) {
    console.error('❌ Land purchase failed:', error);
    
    let errorMessage = error.message;
    
    // Handle specific error types
    if (error.message.includes('User rejected')) {
      errorMessage = 'Transaction cancelled by user';
    } else if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient SOL balance for land purchase';
    }
    
    $('#landMsg').textContent = `❌ Land purchase failed: ${errorMessage}`;
    $('#landMsg').style.color = '#f44336';
    
    // Clear message after 8 seconds
    setTimeout(() => {
      $('#landMsg').textContent = '';
    }, 8000);
  }
}

// 📋 Copy Functions
function copyPromotersLink() {
  const linkInput = $('#promotersLink');
  if (linkInput) {
    linkInput.select();
    document.execCommand('copy');
    alert('Promoter link copied to clipboard!');
  }
}

function copyReferralLink() {
  const linkInput = $('#referralLink');
  if (linkInput) {
    linkInput.select();
    document.execCommand('copy');
    alert('Referral link copied to clipboard!');
  }
}

// 📱 Social Sharing Functions
function sharePromotersOnTwitter() {
  const url = $('#promotersLink').value || 'https://www.thegoldmining.com';
  const text = `🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! ${url}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(twitterUrl, '_blank');
}

function sharePromotersOnFacebook() {
  const url = $('#promotersLink').value || 'https://www.thegoldmining.com';
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(facebookUrl, '_blank');
}

function sharePromotersOnLinkedIn() {
  const url = $('#promotersLink').value || 'https://www.thegoldmining.com';
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(linkedinUrl, '_blank');
}

function copyPromotersForInstagram() {
  const text = "🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! " + ($('#promotersLink').value || 'https://www.thegoldmining.com');
  navigator.clipboard.writeText(text).then(() => {
    alert('Text copied for Instagram! Paste it in your Instagram post.');
  });
}

function copyPromotersForTikTok() {
  const text = "🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! " + ($('#promotersLink').value || 'https://www.thegoldmining.com');
  navigator.clipboard.writeText(text).then(() => {
    alert('Text copied for TikTok! Paste it in your TikTok video description.');
  });
}

// 📥 Banner Download Functions
function downloadBanner(type) {
  const bannerUrls = {
    'square': '/assets/banners/banner-square.png',
    'wide': '/assets/banners/banner-wide.png', 
    'story': '/assets/banners/banner-vertical.png',
    'youtube': '/assets/banners/banner-youtube.png'
  };
  
  const url = bannerUrls[type];
  if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `banner-${type}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// 🔄 Wait for Solana Web3 library to load
function waitForSolanaWeb3() {
  return new Promise((resolve) => {
    if (typeof solanaWeb3 !== 'undefined') {
      console.log('✅ Solana Web3 library already loaded');
      resolve();
      return;
    }
    
    console.log('⏳ Waiting for Solana Web3 library to load...');
    const checkInterval = setInterval(() => {
      if (typeof solanaWeb3 !== 'undefined') {
        console.log('✅ Solana Web3 library loaded successfully');
        clearInterval(checkInterval);
        resolve();
      }
    }, 100); // Check every 100ms
    
    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.error('❌ Solana Web3 library failed to load within 10 seconds');
      resolve(); // Still resolve to continue initialization
    }, 10000);
  });
}

// 🎁 Check and track referral from URL parameters (CRITICAL MISSING FUNCTION!)
async function checkAndTrackReferral() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const referrerAddress = urlParams.get('ref');
    
    if (referrerAddress && referrerAddress.length > 20) {
      console.log('🎁 Referral detected from:', referrerAddress.slice(0, 8) + '...');
      
      // Track the referral session using tracking pixel (GET request)
      const trackingPixel = new Image();
      trackingPixel.src = `/api/track-referral?ref=${encodeURIComponent(referrerAddress)}&t=${Date.now()}`;
      
      trackingPixel.onload = () => {
        console.log('✅ Referral session tracked successfully');
        
        // Store referrer in localStorage for later use
        localStorage.setItem('gm_referrer', referrerAddress);
        
        // Show referral notification
        showReferralTrackedNotification(referrerAddress);
      };
      
      trackingPixel.onerror = () => {
        console.log('⚠️ Failed to track referral');
      };
      
    } else {
      console.log('ℹ️ No referral parameter found');
    }
  } catch (error) {
    console.error('❌ Error checking referral:', error);
  }
}

// 🎉 Show referral tracked notification
function showReferralTrackedNotification(referrerAddress) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(45deg, #3B82F6, #1D4ED8);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-family: Arial, sans-serif;
    max-width: 300px;
    animation: slideIn 0.5s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">🎁 Referral Tracked!</div>
    <div style="font-size: 12px; opacity: 0.9;">
      Referred by: ${referrerAddress.slice(0, 8)}...${referrerAddress.slice(-4)}
    </div>
    <div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">
      Buy land to complete referral
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// 🚀 Initialize the game when page loads
// 💾 Save checkpoint when page is closing
window.addEventListener('beforeunload', function(e) {
  if (state.address && state.checkpoint && state.checkpoint.total_mining_power > 0) {
    console.log('💾 Page closing - saving final checkpoint...');
    
    // Calculate final gold amount
    const finalGold = calculateGoldFromCheckpoint(state.checkpoint);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Use sendBeacon for reliable delivery during page unload
    const payload = {
      address: state.address,
      gold: finalGold,
      timestamp: timestamp,
      finalSync: true
    };
    
    // sendBeacon with Blob to set Content-Type
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const beaconSent = navigator.sendBeacon('/api/save-checkpoint', blob);
    
    if (beaconSent) {
      console.log('✅ Final checkpoint sent via sendBeacon:', finalGold.toFixed(2), 'gold');
    } else {
      console.log('⚠️ sendBeacon failed, checkpoint may not be saved');
    }
  }
});

window.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initializing Complete Optimized Gold Mining Game...');
  
  // 🎁 CRITICAL: Check for referral tracking FIRST!
  await checkAndTrackReferral();
  
  // Wait for Solana Web3 library to load first
  await waitForSolanaWeb3();
  
  // Load configuration and setup
  await loadConfig();
  
  // Setup connect button event listener
  const connectBtn = $('#connectBtn');
  if (connectBtn) {
    connectBtn.addEventListener('click', connectWallet);
    console.log('✅ Connect button event listener added');
  }
  
  // 🎯 Setup click-outside-to-close for ALL modals
  setupModalClickOutside();
  
  // Setup sell button event listener
  const sellBtn = $('#sellBtn');
  if (sellBtn) {
    sellBtn.addEventListener('click', sellGold);
    console.log('✅ Sell button event listener added');
  }
  
  // Setup modal button event listeners
  const referBtn = $('#referBtn');
  if (referBtn) {
    referBtn.addEventListener('click', showReferralModal);
  }
  
  const v2ComingSoonBtn = $('#v2ComingSoonBtn');
  if (v2ComingSoonBtn) {
    v2ComingSoonBtn.addEventListener('click', showV2Modal);
  }
  
  // Setup modal close listeners
  const closeModal = $('#closeModal');
  if (closeModal) {
    closeModal.addEventListener('click', closeReferralModal);
  }
  
  // Setup copy button listeners
  const copyLinkBtn = $('#copyLinkBtn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', copyReferralLink);
  }
  
  const copyPromotersLinkBtn = $('#copyPromotersLinkBtn');
  if (copyPromotersLinkBtn) {
    copyPromotersLinkBtn.addEventListener('click', copyPromotersLink);
  }
  
  // Setup social share button listeners for referral modal
  const shareX = $('#shareX');
  if (shareX) {
    shareX.addEventListener('click', () => {
      const url = $('#referralLink').value || 'https://www.thegoldmining.com';
      const text = `🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! ${url}`;
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(twitterUrl, '_blank');
    });
  }
  
  const shareDiscord = $('#shareDiscord');
  if (shareDiscord) {
    shareDiscord.addEventListener('click', () => {
      const text = "🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! " + ($('#referralLink').value || 'https://www.thegoldmining.com');
      navigator.clipboard.writeText(text).then(() => {
        alert('Link copied! Paste it in Discord.');
      });
    });
  }
  
  const shareTelegram = $('#shareTelegram');
  if (shareTelegram) {
    shareTelegram.addEventListener('click', () => {
      const url = $('#referralLink').value || 'https://www.thegoldmining.com';
      const text = `🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! ${url}`;
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      window.open(telegramUrl, '_blank');
    });
  }
  
  console.log('🎉 Game initialization complete with ALL modal and button functions!');
});

// 🎯 Setup click-outside-to-close functionality for all modals
function setupModalClickOutside() {
  const modals = [
    { id: 'goldStoreModal', closeFunction: closeGoldStoreModal },
    { id: 'howItWorksModal', closeFunction: hideHowItWorksModal },
    { id: 'promotersModal', closeFunction: closePromotersModal },
    { id: 'battlezoneModal', closeFunction: closeBattlezoneModal },
    { id: 'v2ComingSoonModal', closeFunction: closeV2Modal },
    { id: 'referralModal', closeFunction: closeReferralModal },
    { id: 'freeGoldModal', closeFunction: closeFreeGoldModal }
    // Note: landModal is intentionally excluded as it's a mandatory modal
  ];
  
  modals.forEach(modal => {
    const modalElement = document.getElementById(modal.id);
    if (modalElement) {
      modalElement.addEventListener('click', function(event) {
        // Close modal if clicking on the overlay (not the modal content)
        if (event.target === modalElement) {
          console.log(`🎯 Clicked outside ${modal.id}, closing modal...`);
          modal.closeFunction();
        }
      });
      console.log(`✅ Click-outside-to-close setup for ${modal.id}`);
    }
  });
  
  // Special handling for Gold Store Modal since it has a different parameter structure
  const goldStoreModal = document.getElementById('goldStoreModal');
  if (goldStoreModal) {
    goldStoreModal.removeEventListener('click', closeGoldStoreModal); // Remove existing listener
    goldStoreModal.addEventListener('click', function(event) {
      if (event.target === goldStoreModal) {
        console.log('🎯 Clicked outside Gold Store Modal, closing...');
        closeGoldStoreModal();
      }
    });
  }
}