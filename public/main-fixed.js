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
    { key: 'silver', name: 'Silver Pickaxe', rate: 1, cost: state.config.pickaxes.silver.costSol },
    { key: 'gold', name: 'Gold Pickaxe', rate: 10, cost: state.config.pickaxes.gold.costSol },
    { key: 'diamond', name: 'Diamond Pickaxe', rate: 100, cost: state.config.pickaxes.diamond.costSol },
    { key: 'netherite', name: 'Netherite Pickaxe', rate: 1000, cost: state.config.pickaxes.netherite.costSol }
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
          <div class="pickaxe-rate">${pickaxe.rate} gold/min</div>
        </div>
      </div>
      <div class="pickaxe-price">${pickaxe.cost} SOL each</div>
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
    $('#shopMsg').textContent = `Transaction submitted: ${sig.signature.slice(0, 8)}...`;
    $('#shopMsg').style.color = '#2196F3';

    // Confirm with server
    const r2 = await fetch('/api/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity, signature: sig.signature }),
    });
    
    if (!r2.ok) {
      const errorText = await r2.text();
      throw new Error(`Purchase confirmation failed: ${errorText}`);
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
    
    // Update with server response
    if (j2.inventory) {
      state.status.inventory = j2.inventory;
      updateDisplay({
        gold: state.status.gold,
        inventory: j2.inventory,
        checkpoint: j2.checkpoint
      });
    }
    
    // Update checkpoint for mining
    if (j2.checkpoint) {
      state.checkpoint = {
        total_mining_power: j2.checkpoint.total_mining_power || j2.totalRate,
        checkpoint_timestamp: j2.checkpoint.checkpoint_timestamp || Math.floor(Date.now() / 1000),
        last_checkpoint_gold: j2.checkpoint.last_checkpoint_gold || j2.gold || state.status.gold
      };
      
      // Start mining if we have mining power
      if (state.checkpoint.total_mining_power > 0) {
        startCheckpointGoldLoop();
      }
    }
    
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
  
  // Start the optimized engine
  if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
    state.optimizedMiningEngine.start(state.checkpoint);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address })
    });
    
    const result = await response.json();
    
    if (result.success && result.referral_completed) {
      console.log('🎉 REFERRAL COMPLETED!', result);
      
      // Show success notification
      showReferralCompletionNotification(result);
      
      // Refresh user data to show updated rewards
      setTimeout(() => {
        if (state.address) {
          refreshStatus(true);
        }
      }, 2000);
      
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
    <div style="font-size: 14px; margin-bottom: 15px;">
      Your referrer received:
    </div>
    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
      <div>🔨 ${rewards.pickaxe_count || 1}x ${(rewards.pickaxe_type || 'silver').toUpperCase()} Pickaxe</div>
      <div>💰 ${rewards.gold_reward || 100} Gold</div>
      <div>🪙 ${rewards.sol_reward || 0.01} SOL</div>
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

function buyPickaxeWithGold(pickaxeType, goldCost) {
  if (!state.address) {
    alert('Please connect your wallet first');
    return;
  }

  const currentGold = state.status.gold || 0;
  if (currentGold < goldCost) {
    alert(`Not enough gold! You need ${goldCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()}`);
    return;
  }

  console.log(`🛒 Buying ${pickaxeType} pickaxe with ${goldCost} gold...`);
  
  // This would connect to your gold purchase API
  fetch('/api/buy-with-gold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: state.address,
      pickaxeType: pickaxeType,
      goldCost: goldCost
    })
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      $('#modalStoreMsg').textContent = `✅ Successfully purchased ${pickaxeType} pickaxe with gold!`;
      $('#modalStoreMsg').style.color = '#4CAF50';
      
      // Update display
      refreshStatus(true);
      updateGoldStoreModal();
    } else {
      throw new Error(result.error || 'Purchase failed');
    }
  })
  .catch(error => {
    console.error('❌ Gold purchase failed:', error);
    $('#modalStoreMsg').textContent = `❌ Purchase failed: ${error.message}`;
    $('#modalStoreMsg').style.color = '#f44336';
  });
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

  const currentGold = state.status.gold || 0;
  if (goldToSell > currentGold) {
    alert(`Not enough gold! You have ${currentGold.toLocaleString()} gold available`);
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
    
    const response = await fetch('/api/sell-working-final', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        goldAmount: goldToSell
      })
    });

    const result = await response.json();

    if (result.success) {
      const solAmount = (goldToSell * state.config.goldPriceSol).toFixed(6);
      $('#sellMsg').textContent = `✅ Successfully sold ${goldToSell.toLocaleString()} gold for ${solAmount} SOL! Pending admin approval.`;
      $('#sellMsg').style.color = '#4CAF50';
      $('#goldToSell').value = '';
      
      // Refresh status to show updated gold
      await refreshStatus(true);
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
    $('#promotersLink').value = `https://gold-mining-game-serverless.vercel.app/?ref=${state.address}`;
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
  const targetDate = new Date('December 10, 2025 00:00:00 UTC').getTime();
  
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
    $('#referralLink').value = `https://gold-mining-game-serverless.vercel.app/?ref=${state.address}`;
  } else {
    $('#referralRequirement').style.display = 'block';
    $('#referralLinkSection').style.display = 'none';
  }
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
    
    // Show success message
    $('#landMsg').textContent = '✅ Land purchased successfully!';
    $('#landMsg').style.color = '#4CAF50';
    
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
  const text = "🚀 Earn 5-50 SOL daily promoting this amazing gold mining game!";
  const url = $('#promotersLink').value || 'https://gold-mining-game-serverless.vercel.app';
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(twitterUrl, '_blank');
}

function sharePromotersOnFacebook() {
  const url = $('#promotersLink').value || 'https://gold-mining-game-serverless.vercel.app';
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(facebookUrl, '_blank');
}

function sharePromotersOnLinkedIn() {
  const url = $('#promotersLink').value || 'https://gold-mining-game-serverless.vercel.app';
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(linkedinUrl, '_blank');
}

function copyPromotersForInstagram() {
  const text = "🚀 Earn 5-50 SOL daily promoting this amazing gold mining game! " + ($('#promotersLink').value || 'https://gold-mining-game-serverless.vercel.app');
  navigator.clipboard.writeText(text).then(() => {
    alert('Text copied for Instagram! Paste it in your Instagram post.');
  });
}

function copyPromotersForTikTok() {
  const text = "🚀 Earn 5-50 SOL daily promoting this amazing gold mining game! " + ($('#promotersLink').value || 'https://gold-mining-game-serverless.vercel.app');
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
      
      // Track the referral session
      const response = await fetch('/api/track-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          referrer_address: referrerAddress,
          timestamp: Math.floor(Date.now() / 1000)
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Referral session tracked successfully');
        
        // Store referrer in localStorage for later use
        localStorage.setItem('gm_referrer', referrerAddress);
        
        // Show referral notification
        showReferralTrackedNotification(referrerAddress);
      } else {
        console.log('⚠️ Failed to track referral:', result.error);
      }
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
      const text = "🚀 Join this amazing gold mining game and earn SOL!";
      const url = $('#referralLink').value || 'https://gold-mining-game-serverless.vercel.app';
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, '_blank');
    });
  }
  
  const shareDiscord = $('#shareDiscord');
  if (shareDiscord) {
    shareDiscord.addEventListener('click', () => {
      const text = "🚀 Join this amazing gold mining game and earn SOL! " + ($('#referralLink').value || 'https://gold-mining-game-serverless.vercel.app');
      navigator.clipboard.writeText(text).then(() => {
        alert('Link copied! Paste it in Discord.');
      });
    });
  }
  
  const shareTelegram = $('#shareTelegram');
  if (shareTelegram) {
    shareTelegram.addEventListener('click', () => {
      const text = "🚀 Join this amazing gold mining game and earn SOL!";
      const url = $('#referralLink').value || 'https://gold-mining-game-serverless.vercel.app';
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
    { id: 'referralModal', closeFunction: closeReferralModal }
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