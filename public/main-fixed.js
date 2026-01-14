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
  consecutiveErrors: 0,
  landFlags: { hasLand: false, lastChecked: 0 }
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

// 🔍 Get Phantom provider with proper detection and waiting
async function getPhantomProvider() {
  // Check if Phantom is already available
  if ('phantom' in window) {
    const phantomProvider = window.phantom?.solana;
    if (phantomProvider?.isPhantom) {
      console.log('✅ Phantom wallet detected');
      return phantomProvider;
    }
  }
  
  // Check for standalone Solana provider (old Phantom versions)
  if ('solana' in window) {
    const provider = window.solana;
    if (provider?.isPhantom) {
      console.log('✅ Phantom wallet detected (legacy)');
      return provider;
    }
  }
  
  // Wait up to 3 seconds for Phantom to initialize
  console.log('⏳ Waiting for Phantom wallet to initialize...');
  
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds (30 x 100ms)
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Check phantom object
      if ('phantom' in window) {
        const phantomProvider = window.phantom?.solana;
        if (phantomProvider?.isPhantom) {
          clearInterval(checkInterval);
          console.log('✅ Phantom wallet detected after waiting');
          resolve(phantomProvider);
          return;
        }
      }
      
      // Check legacy solana object
      if ('solana' in window) {
        const provider = window.solana;
        if (provider?.isPhantom) {
          clearInterval(checkInterval);
          console.log('✅ Phantom wallet detected (legacy) after waiting');
          resolve(provider);
          return;
        }
      }
      
      // Timeout after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.log('❌ Phantom wallet not found after 3 seconds');
        resolve(null);
      }
    }, 100); // Check every 100ms
  });
}

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
    $('#minSell').textContent = '5,000'; // Fixed display value
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
  
  // Wait for Phantom to be ready
  const provider = await getPhantomProvider();
  if (!provider) {
    alert('Phantom wallet not found. Please install Phantom from https://phantom.app');
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
    
    // 🎁 CHECK AND LINK REFERRAL SESSION
    await checkAndLinkReferralSession(address);
    
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
    
    // 🔥 SCHEDULE NETHERITE CHALLENGE POPUP (30 seconds after connect)
    console.log('🔍 About to call scheduleNetheriteChallengePopup, function exists?', typeof scheduleNetheriteChallengePopup);
    try {
      scheduleNetheriteChallengePopup();
      console.log('✅ scheduleNetheriteChallengePopup called successfully');
    } catch (popupError) {
      console.error('❌ Error calling scheduleNetheriteChallengePopup:', popupError);
    }
    
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
      credentials: 'include', // 🔧 CRITICAL: Include cookies for Netherite challenge
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
    
    // ✅ AUTO-TRIGGER REFERRAL COMPLETION (client-side backup)
    autoCheckReferralCompletion().catch(err => {
      console.log('⚠️ Client-side referral check failed:', err);
    });
    
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

// 🎁 CHECK AND LINK REFERRAL SESSION - Links wallet to referral cookie/session
async function checkAndLinkReferralSession(address) {
  if (!address) {
    console.log('⚠️ No address provided for referral session check');
    return;
  }
  
  try {
    console.log('🔗 Checking for referral session...');
    
    // Call check-referral-session API to link wallet to cookie session
    const response = await fetch(`/api/check-referral-session?address=${encodeURIComponent(address)}`);
    const result = await response.json();
    
    if (result.success && result.referrer_found) {
      console.log('✅ Referral session linked!', {
        referrer: result.referrer_address?.slice(0, 8) + '...',
        session: result.session_id?.slice(0, 20) + '...'
      });
      
      // Store referrer info for UI display
      localStorage.setItem('linked_referrer', result.referrer_address);
      
      // Show notification (use alert as fallback if showNotification doesn't exist)
      if (typeof showNotification === 'function') {
        showNotification('🎁 Referral link detected! Complete land + pickaxe purchase to reward your referrer.', 'success');
      } else {
        console.log('🎁 Referral link detected! Complete land + pickaxe purchase to reward your referrer.');
      }
    } else {
      console.log('ℹ️ No referral session found or already used');
    }
  } catch (error) {
    console.error('❌ Failed to check referral session:', error);
  }
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
      credentials: 'include', // 🔧 CRITICAL: Include cookies for session tracking
      body: JSON.stringify({ address: state.address })
    });
    
    const result = await response.json();
    
    // Only show notification if NEW reward was given (not if already rewarded)
    if (result.success && result.referral_completed && !result.already_rewarded) {
      console.log('🎉 REFERRAL COMPLETED - NEW REWARD GIVEN!', result);
      
      // Show success notification only for new rewards
      showReferralCompletionNotification(result);
      
      // Update display without triggering land status checks
      setTimeout(() => {
        if (state.address) {
          console.log('🎁 Referral completed - updating display without land checks');
          // Just reload user data directly without refreshStatus to avoid infinite loops
          loadInitialUserData().then(userData => {
            if (userData) {
              updateDisplay({
                gold: userData.last_checkpoint_gold || 0,
                inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }
              });
            }
          });
        }
      }, 2000);
      
    } else if (result.success && result.already_rewarded) {
      console.log('ℹ️ Referral already completed previously - no new reward given');
    } else if (result.success && !result.referral_completed) {
      console.log('ℹ️ No referral completion needed:', result.message);
    } else {
      console.log('⚠️ Referral completion check failed:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Auto referral completion check failed:', error);
  }
}

// 🎁 Show referral bonus notification (for new users who used referral link)
function showReferralBonusNotification(goldAmount) {
  const notification = document.createElement('div');
  notification.id = 'referralBonusNotification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(45deg, #fbbf24, #f59e0b);
    color: #1a1a1a;
    padding: 25px 35px;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(251, 191, 36, 0.5);
    z-index: 10002;
    font-family: Arial, sans-serif;
    text-align: center;
    animation: slideDown 0.5s ease-out, glow 2s ease-in-out infinite;
    max-width: 450px;
    border: 3px solid rgba(255, 255, 255, 0.5);
  `;
  
  notification.innerHTML = `
    <div style="font-size: 50px; margin-bottom: 10px;">🎁</div>
    <div style="font-size: 22px; font-weight: bold; margin-bottom: 12px;">
      Welcome Bonus!
    </div>
    <div style="font-size: 16px; margin-bottom: 10px;">
      You were referred by another player!
    </div>
    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; margin: 15px 0;">
      <div style="font-size: 32px; font-weight: bold; color: #fff;">💰 ${goldAmount.toLocaleString()} GOLD</div>
      <div style="font-size: 14px; margin-top: 5px; color: rgba(0,0,0,0.7);">Added to your balance!</div>
    </div>
    <div style="font-size: 13px; color: rgba(0,0,0,0.6);">
      Use this gold to buy pickaxes and start mining! ⛏️
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 6 seconds
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.5s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 6000);
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

  // Calculate current gold including mined gold (same as UI display)
  const currentGold = state.checkpoint ? calculateGoldFromCheckpoint(state.checkpoint) : (state.status.gold || 0);
  
  console.log(`💰 Current gold check: ${currentGold.toFixed(2)} (checkpoint-based), need: ${goldCost}`);
  
  if (currentGold < goldCost) {
    const msgDiv = $('#modalStoreMsg');
    msgDiv.textContent = `❌ Not enough gold! You need ${goldCost.toLocaleString()} gold but only have ${currentGold.toFixed(0).toLocaleString()}`;
    msgDiv.style.color = '#ff4444';
    msgDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
      msgDiv.style.display = 'none';
    }, 5000);
    return;
  }

  console.log(`🛒 Buying ${pickaxeType} pickaxe with ${goldCost} gold...`);
  
  // This would connect to your gold purchase API
  fetch('/api/buy-with-gold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // 🔧 CRITICAL: Include cookies for Netherite challenge detection
    body: JSON.stringify({
      address: state.address,
      pickaxeType: pickaxeType,
      quantity: 1  // 🐛 FIX: API expects "quantity", not "goldCost"
    })
  })
  .then(async response => {
    // 🐛 FIX: Get detailed error message from server
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Server error (${response.status})`);
    }
    return response.json();
  })
  .then(result => {
    const msgDiv = $('#modalStoreMsg');
    msgDiv.style.display = 'block';
    
    if (result.success) {
      msgDiv.textContent = `✅ Successfully purchased ${pickaxeType} pickaxe with gold!`;
      msgDiv.style.color = '#4CAF50';
      
      // Update state and UI immediately with the new gold value from API
      if (result.goldRemaining !== undefined) {
        state.status.gold = result.goldRemaining;
        
        // Update checkpoint with new gold value for mining calculations
        if (result.checkpoint) {
          state.checkpoint = {
            total_mining_power: result.checkpoint.total_mining_power,
            checkpoint_timestamp: result.checkpoint.checkpoint_timestamp,
            last_checkpoint_gold: result.checkpoint.last_checkpoint_gold
          };
          
          // Restart mining engine with updated checkpoint
          if (state.optimizedMiningEngine && state.checkpoint.total_mining_power > 0) {
            state.optimizedMiningEngine.checkpoint = state.checkpoint;
          }
        }
        
        // Update inventory if returned
        if (result.newInventory) {
          state.status.pickaxes = {
            silver: result.newInventory.silver || 0,
            gold: result.newInventory.gold || 0,
            diamond: result.newInventory.diamond || 0,
            netherite: result.newInventory.netherite || 0
          };
        }
        
        // CRITICAL FIX: Update total mining power after purchase
        let newTotalMiningPower = result.miningPower || 0;
        
        // Update checkpoint with new mining power
        if (state.checkpoint) {
          state.checkpoint.total_mining_power = newTotalMiningPower;
          
          // Restart mining engine with updated power
          if (state.optimizedMiningEngine && newTotalMiningPower > 0) {
            state.optimizedMiningEngine.checkpoint = state.checkpoint;
            console.log(`⛏️ Updated mining power to ${newTotalMiningPower}/min`);
          }
        }
        
        // Update UI with new values
        updateDisplay({
          gold: result.goldRemaining,
          inventory: result.newInventory || state.status.pickaxes,
          checkpoint: state.checkpoint
        });
        
        console.log(`✅ Gold deducted: ${currentGold.toFixed(2)} → ${result.goldRemaining.toFixed(2)}`);
        console.log(`✅ Mining power updated to: ${newTotalMiningPower}/min`);
      }
      
      // Also refresh from server to ensure consistency
      refreshStatus(true);
      updateGoldStoreModal();
      
      // ✅ AUTO-TRIGGER REFERRAL COMPLETION (client-side backup)
      autoCheckReferralCompletion().catch(err => {
        console.log('⚠️ Client-side referral check failed:', err);
      });
      
      // Hide success message after 3 seconds and close modal
      setTimeout(() => {
        msgDiv.style.display = 'none';
        closeGoldStoreModal();
      }, 3000);
    } else {
      throw new Error(result.error || 'Purchase failed');
    }
  })
  .catch(error => {
    console.error('❌ Gold purchase failed:', error);
    const msgDiv = $('#modalStoreMsg');
    msgDiv.textContent = `❌ Purchase failed: ${error.message}`;
    msgDiv.style.color = '#f44336';
    msgDiv.style.display = 'block';
    
    // Hide error message after 5 seconds
    setTimeout(() => {
      msgDiv.style.display = 'none';
    }, 5000);
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

  // Calculate real-time gold including mined gold
  let currentGold = 0;
  
  // Use the mining engine's checkpoint to calculate current gold
  if (state.optimizedMiningEngine && state.optimizedMiningEngine.checkpoint) {
    currentGold = calculateGoldFromCheckpoint(state.optimizedMiningEngine.checkpoint);
    console.log(`💰 Current gold from checkpoint calculation: ${currentGold}`);
  } 
  // Fallback to checkpoint directly
  else if (state.checkpoint) {
    currentGold = calculateGoldFromCheckpoint(state.checkpoint);
    console.log(`💰 Current gold from state.checkpoint: ${currentGold}`);
  }
  // Last resort: use status gold
  else {
    currentGold = state.status.gold || 0;
    console.log(`💰 Current gold from status (fallback): ${currentGold}`);
  }
  
  console.log(`💰 Final gold for selling check: ${currentGold}`);
  console.log(`💰 User wants to sell: ${goldToSell}`);
  
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
      amountGold: goldToSell  // Backend expects 'amountGold' not 'goldAmount'
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
      
      // CRITICAL FIX: Update gold immediately after selling
      if (result.newGold !== undefined) {
        state.status.gold = result.newGold;
        
        // Update checkpoint with new gold value
        if (state.checkpoint) {
          state.checkpoint.last_checkpoint_gold = result.newGold;
          state.checkpoint.checkpoint_timestamp = Math.floor(Date.now() / 1000);
          
          // Update mining engine checkpoint
          if (state.optimizedMiningEngine) {
            state.optimizedMiningEngine.checkpoint = state.checkpoint;
          }
        }
        
        // Update UI display immediately
        const totalGoldEl = $('#totalGold');
        if (totalGoldEl) {
          totalGoldEl.textContent = result.newGold.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }
        
        console.log(`✅ Gold updated after sell: ${result.newGold}`);
      }
      
      // Refresh status to show updated gold from server
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
  // 🔍 REAL-TIME WALLET CHECK - Works on refresh and wallet changes
  const currentAddress = state.address || window.solana?.publicKey?.toString() || window.phantom?.solana?.publicKey?.toString();
  const walletConnected = !!(currentAddress && currentAddress.length > 20);
  let hasLand = false;
  
  console.log('📈 PROMOTER UPDATE: Real-time wallet check -', {
    stateAddress: state.address?.slice(0, 8) + '...',
    phantomAddress: window.solana?.publicKey?.toString()?.slice(0, 8) + '...',
    currentAddress: currentAddress?.slice(0, 8) + '...',
    walletConnected: walletConnected
  });
  
  // 🚩 CACHE-ONLY CHECK - NO API CALLS
  if (walletConnected) {
    console.log('📈 PROMOTER UPDATE: Using memory cache only (no API)...');
    
    // Check cache with current address (not state.address)
    const cachedData = LAND_STATUS_CACHE.memoryCache.get(currentAddress);
    if (cachedData && cachedData.hasLand !== undefined) {
      hasLand = cachedData.hasLand;
      console.log('📦 PROMOTER: Cache shows hasLand =', hasLand);
    } else {
      console.log('📦 PROMOTER: No valid cache found, checking localStorage...');
      // Try localStorage as backup with current address
      try {
        const storageKey = `${LAND_STATUS_CACHE.CACHE_KEY_PREFIX}${currentAddress}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          if (data && data.hasLand !== undefined) {
            hasLand = data.hasLand;
            console.log('📦 PROMOTER: localStorage shows hasLand =', hasLand);
          }
        }
      } catch (e) {
        console.log('📦 PROMOTER: localStorage check failed, assuming false');
      }
    }
  } else {
    console.log('⚠️ PROMOTER: Wallet not properly connected');
  }
  
  $('#walletStatusPromoters').textContent = walletConnected ? '✅ Connected' : '❌ Not Connected';
  $('#walletStatusPromoters').style.color = walletConnected ? '#4CAF50' : '#f44336';
  
  $('#landStatusPromoters').textContent = hasLand ? '✅ Owned' : '❌ No Land';
  $('#landStatusPromoters').style.color = hasLand ? '#4CAF50' : '#f44336';
  
  if (walletConnected && hasLand) {
    $('#promotersRequirement').style.display = 'none';
    $('#promotersLinkSection').style.display = 'block';
    // 🚀 Generate dynamic promoter link with latest deployment
    try {
      const response = await fetch('/api/generate-dynamic-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerAddress: state.address })
      });
      
      const data = await response.json();
      if (data.success) {
        $('#promotersLink').value = data.referralLink;
        console.log('🚀 Dynamic promoter link:', data.referralLink);
      } else {
        $('#promotersLink').value = `https://www.thegoldmining.com/?ref=${state.address}`;
      }
    } catch (error) {
      console.log('⚠️ Using fallback promoter link');
      $('#promotersLink').value = `https://www.thegoldmining.com/?ref=${state.address}`;
    }
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
  const targetDate = new Date('January 10, 2026 00:00:00 UTC').getTime();
  
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
  // 🔍 REAL-TIME WALLET CHECK - Works on refresh and wallet changes
  const currentAddress = state.address || window.solana?.publicKey?.toString() || window.phantom?.solana?.publicKey?.toString();
  const walletConnected = !!(currentAddress && currentAddress.length > 20);
  let hasLand = false;
  
  console.log('🎁 REFERRAL UPDATE: Real-time wallet check -', {
    stateAddress: state.address?.slice(0, 8) + '...',
    phantomAddress: window.solana?.publicKey?.toString()?.slice(0, 8) + '...',
    currentAddress: currentAddress?.slice(0, 8) + '...',
    walletConnected: walletConnected
  });
  
  // 🚩 CACHE-ONLY CHECK - NO API CALLS
  if (walletConnected) {
    console.log('🎁 REFERRAL UPDATE: Using memory cache only (no API)...');
    
    // Check cache with current address (not state.address)
    const cachedData = LAND_STATUS_CACHE.memoryCache.get(currentAddress);
    if (cachedData && cachedData.hasLand !== undefined) {
      hasLand = cachedData.hasLand;
      console.log('📦 REFERRAL: Cache shows hasLand =', hasLand);
    } else {
      console.log('📦 REFERRAL: No valid cache found, checking localStorage...');
      // Try localStorage as backup with current address
      try {
        const storageKey = `${LAND_STATUS_CACHE.CACHE_KEY_PREFIX}${currentAddress}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          if (data && data.hasLand !== undefined) {
            hasLand = data.hasLand;
            console.log('📦 REFERRAL: localStorage shows hasLand =', hasLand);
          }
        }
      } catch (e) {
        console.log('📦 REFERRAL: localStorage check failed, assuming false');
      }
    }
  } else {
    console.log('⚠️ REFERRAL: Wallet not properly connected');
  }
  
  $('#walletStatusReferral').textContent = walletConnected ? '✅ Connected' : '❌ Not Connected';
  $('#walletStatusReferral').style.color = walletConnected ? '#4CAF50' : '#f44336';
  
  $('#landStatusReferral').textContent = hasLand ? '✅ Owned' : '❌ No Land';
  $('#landStatusReferral').style.color = hasLand ? '#4CAF50' : '#f44336';
  
  if (walletConnected && hasLand) {
    $('#referralRequirement').style.display = 'none';
    $('#referralLinkSection').style.display = 'block';
    // 🚀 Generate dynamic referral link with latest deployment
    try {
      const response = await fetch('/api/generate-dynamic-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerAddress: currentAddress })
      });
      
      const data = await response.json();
      if (data.success) {
        $('#referralLink').value = data.referralLink;
        console.log('🚀 Dynamic referral link:', data.referralLink);
      } else {
        $('#referralLink').value = `https://www.thegoldmining.com/?ref=${currentAddress}`;
      }
    } catch (error) {
      console.log('⚠️ Using fallback referral link');
      $('#referralLink').value = `https://www.thegoldmining.com/?ref=${currentAddress}`;
    }
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
    
    // 🎁 CHECK IF REFERRAL BONUS WAS GIVEN
    if (confirmData.referral_bonus_given && confirmData.referral_bonus_amount > 0) {
      console.log('🎁 Referral bonus received:', confirmData.referral_bonus_amount, 'gold');
      
      // Show referral bonus popup
      showReferralBonusNotification(confirmData.referral_bonus_amount);
      
      // Update gold display immediately
      if (state.status) {
        state.status.gold = (parseFloat(state.status.gold) || 0) + confirmData.referral_bonus_amount;
      }
      if (state.checkpoint) {
        state.checkpoint.last_checkpoint_gold = (parseFloat(state.checkpoint.last_checkpoint_gold) || 0) + confirmData.referral_bonus_amount;
      }
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
      const text = "🚀 Join this amazing gold mining game and earn SOL! Get 1000 gold signup bonus to start! " + ($('#referralLink').value || `https://www.thegoldmining.com/?ref=${state.address || 'signup'}`);
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
// ===================================
// 🔥 NETHERITE CHALLENGE POPUP
// ===================================

let netheritePopupShown = false;
let netheritePopupTimeout = null;
let countdownInterval = null;

// Show Netherite Challenge popup 30 seconds after wallet connect
function scheduleNetheriteChallengePopup() {
  if (netheritePopupShown) {
    console.log('ℹ️ Netherite popup already shown, skipping');
    return;
  }
  
  console.log('⏰ Scheduling Netherite Challenge popup in 30 seconds...');
  
  netheritePopupTimeout = setTimeout(async () => {
    // Check if user has already accepted challenge
    try {
      const response = await fetch(`/api/check-netherite-challenge?address=${encodeURIComponent(state.address)}`);
      const result = await response.json();
      
      if (result.challenge_accepted) {
        console.log('ℹ️ User already accepted challenge, showing active timer instead');
        netheritePopupShown = true;
        return;
      }
      
      showNetheriteChallengePopup();
    } catch (error) {
      console.error('❌ Error checking challenge status:', error);
      showNetheriteChallengePopup();
    }
  }, 30000); // 30 seconds
}

// Create and show the Netherite Challenge popup
function showNetheriteChallengePopup() {
  if (netheritePopupShown) return;
  
  netheritePopupShown = true;
  console.log('🔥 Showing Netherite Challenge popup!');
  
  const referralLink = `https://www.thegoldmining.com/?ref=${state.address}`;
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'netheriteChallengeModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease-in;
  `;
  
  // Create modal content
  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 3px solid #ff6b00;
      border-radius: 20px;
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 30px;
      box-shadow: 0 0 50px rgba(255, 107, 0, 0.5);
      animation: slideIn 0.5s ease-out;
    ">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="
          font-size: 48px;
          animation: pulse 2s infinite;
        ">🎁</div>
        <h2 style="
          color: #ff6b00;
          font-size: 32px;
          margin: 15px 0;
          text-shadow: 0 0 10px rgba(255, 107, 0, 0.5);
        ">SECRET DROP FOR YOU!</h2>
        <p style="color: #ffd700; font-size: 18px; font-weight: bold;">
          🔥 Limited Time Offer! 🔥
        </p>
      </div>
      
      <!-- Timer Display -->
      <div style="
        background: linear-gradient(135deg, #ff6b00, #ff8c00);
        border-radius: 15px;
        padding: 20px;
        text-align: center;
        margin-bottom: 25px;
        box-shadow: 0 5px 20px rgba(255, 107, 0, 0.3);
      ">
        <div style="color: white; font-size: 18px; margin-bottom: 10px;">
          ⏰ Challenge Duration
        </div>
        <div style="
          font-size: 48px;
          font-weight: bold;
          color: white;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
          font-family: 'Courier New', monospace;
        ">01:00:00</div>
        <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 5px;">
          One Hour to Win!
        </div>
      </div>
      
      <!-- Netherite Pickaxe Display -->
      <div style="text-align: center; margin: 25px 0;">
        <div style="
          display: inline-block;
          background: rgba(255, 107, 0, 0.1);
          border: 2px solid #ff6b00;
          border-radius: 15px;
          padding: 20px;
        ">
          <div style="font-size: 80px; margin-bottom: 10px;">🔥</div>
          <div style="color: #ffd700; font-size: 24px; font-weight: bold;">
            FREE NETHERITE PICKAXE
          </div>
          <div style="color: #aaa; font-size: 14px; margin-top: 5px;">
            Worth 1,000,000 Gold!
          </div>
        </div>
      </div>
      
      <!-- How It Works -->
      <div style="
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        margin: 25px 0;
      ">
        <h3 style="color: #ff6b00; font-size: 20px; margin-bottom: 15px;">
          📋 How It Works:
        </h3>
        <ol style="color: #ddd; line-height: 1.8; padding-left: 20px;">
          <li style="margin-bottom: 10px;">
            <strong style="color: #ffd700;">Accept this challenge</strong> to start 1-hour timer
          </li>
          <li style="margin-bottom: 10px;">
            <strong style="color: #ffd700;">Share your referral link</strong> on social media
          </li>
          <li style="margin-bottom: 10px;">
            If <strong style="color: #ff6b00;">anyone buys Netherite pickaxe</strong> using your link within 1 hour:
            <div style="
              background: rgba(255, 215, 0, 0.1);
              border-left: 3px solid #ffd700;
              padding: 10px;
              margin-top: 8px;
              border-radius: 5px;
            ">
              🎉 <strong>YOU GET FREE NETHERITE PICKAXE!</strong>
            </div>
          </li>
          <li style="margin-bottom: 10px;">
            If time expires: You still get <strong style="color: #4CAF50;">regular referral rewards</strong>
          </li>
          <li>
            Your referred friend gets <strong style="color: #4CAF50;">1000 FREE GOLD</strong>
          </li>
        </ol>
      </div>
      
      <!-- Referral Link Section -->
      <div style="
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 20px;
        margin: 25px 0;
      ">
        <h3 style="color: #ff6b00; font-size: 18px; margin-bottom: 12px;">
          🔗 Your Referral Link:
        </h3>
        <div style="
          display: flex;
          gap: 10px;
          align-items: center;
        ">
          <input 
            type="text" 
            id="netheriteReferralLink"
            value="${referralLink}"
            readonly
            style="
              flex: 1;
              padding: 12px;
              border: 2px solid #444;
              border-radius: 8px;
              background: #1a1a1a;
              color: #fff;
              font-size: 14px;
              font-family: monospace;
            "
          />
          <button 
            onclick="copyNetheriteLink()"
            style="
              padding: 12px 24px;
              background: linear-gradient(135deg, #4CAF50, #45a049);
              border: none;
              border-radius: 8px;
              color: white;
              font-weight: bold;
              cursor: pointer;
              transition: transform 0.2s;
              white-space: nowrap;
            "
            onmouseover="this.style.transform='scale(1.05)'"
            onmouseout="this.style.transform='scale(1)'"
          >
            📋 Copy
          </button>
        </div>
        <div style="
          margin-top: 12px;
          display: flex;
          gap: 10px;
          justify-content: center;
        ">
          <button 
            onclick="shareOnTwitter()"
            style="
              padding: 10px 20px;
              background: #1DA1F2;
              border: none;
              border-radius: 8px;
              color: white;
              font-weight: bold;
              cursor: pointer;
            "
          >
            <span style="font-size: 14px;">𝕏</span> X
          </button>
          <button 
            onclick="shareOnDiscord()"
            style="
              padding: 10px 20px;
              background: #5865F2;
              border: none;
              border-radius: 8px;
              color: white;
              font-weight: bold;
              cursor: pointer;
            "
          >
            💬 Discord
          </button>
        </div>
      </div>
      
      <!-- Important Note -->
      <div style="
        background: rgba(255, 107, 0, 0.1);
        border-left: 4px solid #ff6b00;
        padding: 15px;
        margin: 25px 0;
        border-radius: 5px;
      ">
        <div style="color: #ff6b00; font-weight: bold; margin-bottom: 5px;">
          ⚠️ Important:
        </div>
        <div style="color: #ddd; font-size: 14px; line-height: 1.6;">
          • This is a <strong>ONE-TIME opportunity</strong> per account<br/>
          • Timer starts immediately when you accept<br/>
          • You can earn this bonus only once (even if 5 people buy Netherite)<br/>
          • After timer expires, you get regular rewards instead
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div style="
        display: flex;
        gap: 15px;
        margin-top: 30px;
      ">
        <button 
          onclick="declineNetheriteChallenge()"
          style="
            flex: 1;
            padding: 15px;
            background: #555;
            border: 2px solid #777;
            border-radius: 10px;
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#666'"
          onmouseout="this.style.background='#555'"
        >
          ❌ No Thanks
        </button>
        <button 
          onclick="acceptNetheriteChallenge()"
          style="
            flex: 2;
            padding: 15px;
            background: linear-gradient(135deg, #ff6b00, #ff8c00);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 5px 20px rgba(255, 107, 0, 0.4);
          "
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 7px 25px rgba(255, 107, 0, 0.6)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 20px rgba(255, 107, 0, 0.4)'"
        >
          🔥 ACCEPT CHALLENGE! 🔥
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translateY(-50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
}

// Copy referral link to clipboard
window.copyNetheriteLink = function() {
  const input = document.getElementById('netheriteReferralLink');
  input.select();
  document.execCommand('copy');
  
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.innerHTML = '✅ Copied!';
  setTimeout(() => {
    btn.innerHTML = originalText;
  }, 2000);
};

// Share on X (Twitter)
window.shareOnTwitter = function() {
  const link = `https://www.thegoldmining.com/?ref=${state.address}`;
  const text = `🔥 Join me on Gold Mining Game and get 1000 FREE GOLD! I'm doing the Netherite Challenge - if you buy Netherite pickaxe in the next hour, I get one FREE! ⏰ ${link}`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'width=600,height=400');
};

// Share on Discord
window.shareOnDiscord = function() {
  const link = `https://www.thegoldmining.com/?ref=${state.address}`;
  alert('Copy this message and share it on Discord:\n\n🔥 Join me on Gold Mining Game!\n✨ Use my link and get 1000 FREE GOLD!\n⏰ I\'m doing the Netherite Challenge - join now!\n\n' + link);
};

// Accept Netherite Challenge
window.acceptNetheriteChallenge = async function() {
  console.log('🔥 User accepted Netherite Challenge!');
  
  const modal = document.getElementById('netheriteChallengeModal');
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '⏳ Starting Challenge...';
  
  try {
    const response = await fetch('/api/start-netherite-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ referrer_address: state.address })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Netherite Challenge started!', result);
      
      // Show success message using alert
      alert('🔥 Challenge Started! Share your link now!\n\n⏰ Timer: 1 hour\n🔗 Your referral link is ready to share!');
      
      // Close modal
      if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => modal.remove(), 300);
      }
      
      // Log challenge details
      console.log('⏰ Challenge expires at:', result.challenge.expires_at);
      
    } else {
      alert('❌ ' + result.error);
      btn.disabled = false;
      btn.innerHTML = '🔥 ACCEPT CHALLENGE! 🔥';
    }
    
  } catch (error) {
    console.error('❌ Error starting challenge:', error);
    alert('❌ Failed to start challenge. Please try again.\n\nError: ' + error.message);
    btn.disabled = false;
    btn.innerHTML = '🔥 ACCEPT CHALLENGE! 🔥';
  }
};

// Decline Netherite Challenge
window.declineNetheriteChallenge = function() {
  console.log('ℹ️ User declined Netherite Challenge');
  
  const modal = document.getElementById('netheriteChallengeModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => modal.remove(), 300);
  }
  
  showNotification('You can always start the challenge later from your profile!', 'info');
};

// Add fadeOut animation
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(fadeOutStyle);


// ================================
// 🎰 SPIN WHEEL FUNCTIONALITY
// ================================

// Wheel prizes configuration (must match backend)
const WHEEL_PRIZES = [
  { id: 'silver', name: 'Silver Pickaxe', shortName: 'Silver', color: '#C0C0C0', emoji: '🥈', rarity: 'common' },
  { id: 'gold_pickaxe', name: 'Gold Pickaxe', shortName: 'Gold', color: '#FFD700', emoji: '🥇', rarity: 'rare' },
  { id: 'diamond', name: 'Diamond Pickaxe', shortName: 'Diamond', color: '#00FFFF', emoji: '💎', rarity: 'epic' },
  { id: 'netherite', name: 'Netherite Pickaxe', shortName: 'Netherite', color: '#FF00FF', emoji: '⛏️', rarity: 'legendary' },
  { id: 'gold_100', name: '100 Gold', shortName: '100', color: '#4CAF50', emoji: '💰', rarity: 'gold' },
  { id: 'gold_500', name: '500 Gold', shortName: '500', color: '#66BB6A', emoji: '💰', rarity: 'gold' },
  { id: 'gold_1000', name: '1000 Gold', shortName: '1K', color: '#81C784', emoji: '💰', rarity: 'gold' },
  { id: 'gold_10000', name: '10000 Gold', shortName: '10K', color: '#A5D6A7', emoji: '💰', rarity: 'gold' },
  { id: 'better_luck', name: 'Better Luck', shortName: 'Try Again', color: '#666666', emoji: '😢', rarity: 'common' },
  { id: 'retry', name: 'Free Retry', shortName: 'Retry', color: '#2196F3', emoji: '🔄', rarity: 'special' }
];

let wheelCanvas = null;
let wheelCtx = null;
let currentRotation = 0;
let isSpinning = false;

// Show spin wheel modal
window.showSpinWheelModal = function() {
  console.log('🎰 Opening spin wheel modal');
  
  const modal = document.getElementById('spinWheelModal');
  if (!modal) {
    console.error('❌ Spin wheel modal not found');
    return;
  }
  
  modal.style.display = 'flex';
  
  // Initialize wheel canvas
  setTimeout(() => {
    initializeWheel();
    updateSpinGoldDisplay();
  }, 100);
};

// Close spin wheel modal
window.closeSpinWheelModal = function() {
  const modal = document.getElementById('spinWheelModal');
  if (modal) {
    modal.style.display = 'none';
  }
  isSpinning = false;
};

// Initialize wheel canvas
function initializeWheel() {
  wheelCanvas = document.getElementById('wheelCanvas');
  if (!wheelCanvas) {
    console.error('❌ Wheel canvas not found');
    return;
  }
  
  wheelCtx = wheelCanvas.getContext('2d');
  drawWheel(0);
}

// Draw the premium wheel with 3D effects
function drawWheel(rotation) {
  if (!wheelCtx || !wheelCanvas) return;
  
  const centerX = wheelCanvas.width / 2;
  const centerY = wheelCanvas.height / 2;
  const outerRadius = (wheelCanvas.width / 2) - 20;
  const innerRadius = 50;
  const numSegments = WHEEL_PRIZES.length;
  const anglePerSegment = (2 * Math.PI) / numSegments;
  
  // Clear canvas
  wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
  
  // Draw outer glow ring
  wheelCtx.save();
  wheelCtx.shadowColor = 'rgba(255, 215, 0, 0.8)';
  wheelCtx.shadowBlur = 40;
  wheelCtx.beginPath();
  wheelCtx.arc(centerX, centerY, outerRadius + 10, 0, 2 * Math.PI);
  wheelCtx.strokeStyle = '#FFD700';
  wheelCtx.lineWidth = 10;
  wheelCtx.stroke();
  wheelCtx.restore();
  
  // Draw segments with gradients
  for (let i = 0; i < numSegments; i++) {
    const startAngle = rotation + i * anglePerSegment - Math.PI / 2;
    const endAngle = startAngle + anglePerSegment;
    const prize = WHEEL_PRIZES[i];
    
    // Create radial gradient for 3D effect
    const gradient = wheelCtx.createRadialGradient(
      centerX, centerY, innerRadius,
      centerX, centerY, outerRadius
    );
    
    // Set colors based on rarity
    if (prize.rarity === 'legendary') {
      gradient.addColorStop(0, '#8B00FF');
      gradient.addColorStop(1, '#FF00FF');
    } else if (prize.rarity === 'epic') {
      gradient.addColorStop(0, '#0080FF');
      gradient.addColorStop(1, '#00FFFF');
    } else if (prize.rarity === 'rare') {
      gradient.addColorStop(0, '#FF8C00');
      gradient.addColorStop(1, '#FFD700');
    } else if (prize.rarity === 'gold') {
      gradient.addColorStop(0, '#2E7D32');
      gradient.addColorStop(1, '#66BB6A');
    } else if (prize.rarity === 'special') {
      gradient.addColorStop(0, '#1565C0');
      gradient.addColorStop(1, '#42A5F5');
    } else {
      gradient.addColorStop(0, '#757575');
      gradient.addColorStop(1, '#BDBDBD');
    }
    
    // Draw segment
    wheelCtx.beginPath();
    wheelCtx.moveTo(centerX, centerY);
    wheelCtx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    wheelCtx.closePath();
    wheelCtx.fillStyle = gradient;
    wheelCtx.fill();
    
    // Segment border with shadow
    wheelCtx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    wheelCtx.lineWidth = 4;
    wheelCtx.stroke();
    
    // Add shine effect
    wheelCtx.save();
    wheelCtx.clip();
    const shineGradient = wheelCtx.createRadialGradient(
      centerX - outerRadius * 0.3,
      centerY - outerRadius * 0.3,
      0,
      centerX,
      centerY,
      outerRadius
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    wheelCtx.fillStyle = shineGradient;
    wheelCtx.fill();
    wheelCtx.restore();
    
    // Draw text and emoji
    drawPrizeText(wheelCtx, centerX, centerY, startAngle, anglePerSegment, outerRadius, prize);
  }
  
  // Draw decorative pins
  drawPins(wheelCtx, centerX, centerY, outerRadius, rotation, numSegments, anglePerSegment);
  
  // Draw center hub with 3D effect
  drawCenterHub(wheelCtx, centerX, centerY, innerRadius);
}

// Draw prize text on segment
function drawPrizeText(ctx, centerX, centerY, startAngle, anglePerSegment, outerRadius, prize) {
  ctx.save();
  
  const angle = startAngle + anglePerSegment / 2;
  const textRadius = outerRadius * 0.7;
  const x = centerX + Math.cos(angle) * textRadius;
  const y = centerY + Math.sin(angle) * textRadius;
  
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  
  // Text shadow for readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  // Draw emoji
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFF';
  ctx.fillText(prize.emoji, 0, -20);
  
  // Draw prize name
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#FFF';
  ctx.fillText(prize.shortName, 0, 15);
  
  ctx.restore();
}

// Draw decorative pins around wheel
function drawPins(ctx, centerX, centerY, outerRadius, rotation, numSegments, anglePerSegment) {
  const pinCount = numSegments;
  const pinRadius = 8;
  
  for (let i = 0; i < pinCount; i++) {
    const angle = rotation + (i * anglePerSegment) - Math.PI / 2;
    const x = centerX + Math.cos(angle) * (outerRadius - 8);
    const y = centerY + Math.sin(angle) * (outerRadius - 8);
    
    // Pin shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    
    // Pin gradient
    const pinGradient = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, pinRadius);
    pinGradient.addColorStop(0, '#FFD700');
    pinGradient.addColorStop(1, '#B8860B');
    
    ctx.beginPath();
    ctx.arc(x, y, pinRadius, 0, 2 * Math.PI);
    ctx.fillStyle = pinGradient;
    ctx.fill();
    
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

// Draw center hub with 3D effect
function drawCenterHub(ctx, centerX, centerY, innerRadius) {
  // Outer shadow ring
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius + 15, 0, 2 * Math.PI);
  ctx.fillStyle = '#2C2C2C';
  ctx.fill();
  ctx.restore();
  
  // Main hub with gradient
  const hubGradient = ctx.createRadialGradient(
    centerX - 15, centerY - 15, 0,
    centerX, centerY, innerRadius
  );
  hubGradient.addColorStop(0, '#FFD700');
  hubGradient.addColorStop(0.7, '#FFA500');
  hubGradient.addColorStop(1, '#FF8C00');
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = hubGradient;
  ctx.fill();
  
  // Hub border
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 5;
  ctx.stroke();
  
  // Inner shine
  ctx.beginPath();
  ctx.arc(centerX - 12, centerY - 12, innerRadius * 0.5, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();
  
  // Center text
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
  ctx.shadowBlur = 3;
  ctx.fillText('SPIN', centerX, centerY);
}

// Update gold display
function updateSpinGoldDisplay() {
  const goldDisplay = document.getElementById('spinGoldDisplay');
  if (goldDisplay && window.currentGold !== undefined) {
    goldDisplay.textContent = Math.floor(window.currentGold).toLocaleString();
  }
}

// Spin the wheel
window.spinWheel = async function() {
  if (isSpinning) {
    console.log('⚠️ Wheel is already spinning');
    return;
  }
  
  if (!window.userWallet) {
    alert('❌ Please connect your wallet first!');
    return;
  }
  
  if (!window.hasLand) {
    alert('❌ You must own land to use the spin wheel!');
    return;
  }
  
  const currentGold = window.currentGold || 0;
  if (currentGold < 1000) {
    alert(`❌ Insufficient gold! You have ${Math.floor(currentGold)} gold but need 1000 gold to spin.`);
    return;
  }
  
  const spinButton = document.getElementById('spinButton');
  if (spinButton) {
    spinButton.disabled = true;
    spinButton.classList.add('spinning');
    spinButton.textContent = '🎰 SPINNING...';
  }
  
  isSpinning = true;
  
  try {
    console.log('🎰 Sending spin request to server...');
    
    const response = await fetch('/api/spin-wheel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: window.userWallet })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Spin failed');
    }
    
    console.log('🎁 Spin result:', result);
    
    // Find the prize index
    const prizeIndex = WHEEL_PRIZES.findIndex(p => p.id === result.prize.id);
    if (prizeIndex === -1) {
      throw new Error('Prize not found in wheel');
    }
    
    // Calculate rotation to land on prize
    const anglePerSegment = (2 * Math.PI) / WHEEL_PRIZES.length;
    const targetAngle = prizeIndex * anglePerSegment;
    const spins = 5; // Number of full rotations
    const totalRotation = currentRotation + (spins * 2 * Math.PI) + (2 * Math.PI - targetAngle);
    
    // Animate the wheel
    animateWheel(currentRotation, totalRotation, 4000, () => {
      // Animation complete
      currentRotation = totalRotation % (2 * Math.PI);
      
      // Update gold display
      window.currentGold = result.goldAfter;
      updateSpinGoldDisplay();
      updateGoldDisplay();
      
      // Update inventory if pickaxe won
      if (result.newInventory) {
        window.inventory = result.newInventory;
        updateInventoryDisplay();
      }
      
      // Show result
      showSpinResult(result);
      
      // Re-enable button
      if (spinButton) {
        spinButton.disabled = false;
        spinButton.classList.remove('spinning');
        spinButton.textContent = '🎰 Pay 1000 Gold & Spin';
      }
      
      isSpinning = false;
    });
    
  } catch (error) {
    console.error('❌ Spin error:', error);
    alert('❌ Spin failed: ' + error.message);
    
    if (spinButton) {
      spinButton.disabled = false;
      spinButton.classList.remove('spinning');
      spinButton.textContent = '🎰 Pay 1000 Gold & Spin';
    }
    
    isSpinning = false;
  }
};

// Animate wheel rotation
function animateWheel(startRotation, endRotation, duration, callback) {
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    const currentAngle = startRotation + (endRotation - startRotation) * easeOut;
    drawWheel(currentAngle);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      callback();
    }
  }
  
  animate();
}

// Show spin result with premium styling
function showSpinResult(result) {
  const resultDiv = document.getElementById('spinResult');
  if (!resultDiv) return;
  
  resultDiv.style.display = 'block';
  resultDiv.className = 'spin-result-premium';
  
  let resultClass = 'win';
  let resultText = result.message;
  let prizeEmoji = '🎁';
  
  // Determine result class and emoji
  if (result.prize.type === 'nothing') {
    resultClass = 'lose';
    prizeEmoji = '😢';
  } else if (result.prize.type === 'pickaxe' && result.prize.value === 'netherite') {
    resultClass = 'legendary-win';
    prizeEmoji = '⛏️';
  } else if (result.prize.type === 'pickaxe') {
    prizeEmoji = '⛏️';
  } else if (result.prize.type === 'gold') {
    prizeEmoji = '💰';
  } else if (result.prize.type === 'retry') {
    prizeEmoji = '🔄';
  }
  
  resultDiv.classList.add(resultClass);
  resultDiv.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 15px; animation: prizeFloat 1s ease-in-out infinite;">
      ${prizeEmoji}
    </div>
    <div style="font-size: 24px; font-weight: bold; color: #ffd700; margin-bottom: 10px; text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);">
      ${resultText}
    </div>
    <div style="display: flex; justify-content: space-around; margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(255, 215, 0, 0.3);">
      <div style="text-align: center;">
        <div style="font-size: 12px; color: #aaa; text-transform: uppercase;">Before</div>
        <div style="font-size: 20px; font-weight: bold; color: #fff;">${result.goldBefore.toLocaleString()}</div>
      </div>
      <div style="font-size: 24px; color: #ffd700;">→</div>
      <div style="text-align: center;">
        <div style="font-size: 12px; color: #aaa; text-transform: uppercase;">After</div>
        <div style="font-size: 20px; font-weight: bold; color: #4CAF50;">${result.goldAfter.toLocaleString()}</div>
      </div>
    </div>
    ${result.freeRetry ? '<div style="margin-top: 15px; padding: 10px; background: rgba(33, 150, 243, 0.2); border: 2px solid #2196F3; border-radius: 10px; font-weight: bold; color: #2196F3;">🔄 FREE SPIN! Click again!</div>' : ''}
  `;
  
  // Add floating animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes prizeFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
  `;
  if (!document.getElementById('prizeFloatStyle')) {
    style.id = 'prizeFloatStyle';
    document.head.appendChild(style);
  }
  
  // Show notification
  showNotification(resultText, result.prize.type === 'nothing' ? 'error' : 'success');
  
  // Auto-hide result after 8 seconds
  setTimeout(() => {
    resultDiv.style.display = 'none';
  }, 8000);
}

console.log('🎰 Spin wheel functions loaded');
