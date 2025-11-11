// Modern Gold Mining Game JavaScript
let state = {
  connection: null,
  config: null,
  wallet: null,
  address: null,
  intervalId: null,
  status: { gold: 0, inventory: null },
  hasLand: false,
  isWindowActive: true, // Track window activity for anti-idle system
  idleMiningLimit: 10000, // Gold limit for idle mining
  miningEngine: null, // Client-side mining engine
  lastServerSync: Date.now(), // Last time we synced with server
  syncInterval: 30000, // Sync with server every 30 seconds
};

const $ = (sel) => document.querySelector(sel);

async function loadConfig() {
  try {
    const res = await fetch('/config');
    state.config = await res.json();
    
    // Initialize Solana connection
    const clusterUrl = state.config.clusterUrl || 'https://api.devnet.solana.com';
    state.connection = new solanaWeb3.Connection(clusterUrl);
    
    // Initialize client-side mining engine
    if (typeof MiningEngine === 'undefined') {
      console.error('❌ MiningEngine class not found! Check if mining-engine.js is loaded.');
      return;
    }
    
    state.miningEngine = new MiningEngine();
    console.log('⚡ Client-side mining engine initialized:', state.miningEngine);
    
    renderShop();
    updateStaticInfo();
    tryAutoConnect();
  } catch (e) {
    console.error('Failed to load config:', e);
    // Fallback connection
    state.connection = new solanaWeb3.Connection('https://api.devnet.solana.com');
  }
}

function updateStaticInfo() {
  if (state.config) {
    $('#goldPrice').textContent = state.config.goldPriceSol + ' SOL';
    $('#minSell').textContent = state.config.minSellGold.toLocaleString();
  }
}

function renderShop() {
  if (!state.config || !state.config.pickaxes) return;
  
  const grid = $('#pickaxeGrid');
  grid.innerHTML = '';
  
  const pickaxes = [
    { 
      key: 'silver', 
      name: 'Silver Pickaxe', 
      icon: '🥈', 
      rate: 1,
      cost: state.config.pickaxes.silver.costSol 
    },
    { 
      key: 'gold', 
      name: 'Gold Pickaxe', 
      icon: '🥇', 
      rate: 10,
      cost: state.config.pickaxes.gold.costSol 
    },
    { 
      key: 'diamond', 
      name: 'Diamond Pickaxe', 
      icon: '💎', 
      rate: 100,
      cost: state.config.pickaxes.diamond.costSol 
    },
    { 
      key: 'netherite', 
      name: 'Netherite Pickaxe', 
      icon: '🌟', 
      rate: 10000,
      cost: state.config.pickaxes.netherite.costSol 
    }
  ];
  
  pickaxes.forEach(pickaxe => {
    const item = document.createElement('div');
    item.className = 'pickaxe-item';
    const iconContent = pickaxe.key === 'silver' ? 
      `<img src="assets/pickaxes/pickaxe-silver.png" alt="Silver Pickaxe" style="width: 48px; height: 48px; object-fit: contain;">` : 
      pickaxe.key === 'diamond' ?
      `<img src="assets/pickaxes/pickaxe-diamond.png" alt="Diamond Pickaxe" style="width: 48px; height: 48px; object-fit: contain;">` :
      pickaxe.key === 'gold' ?
      `<img src="assets/pickaxes/pickaxe-gold.png" alt="Gold Pickaxe" style="width: 48px; height: 48px; object-fit: contain;">` :
      pickaxe.key === 'netherite' ?
      `<img src="assets/pickaxes/pickaxe-netherite.gif" alt="Netherite Pickaxe" style="width: 64px; height: 64px; object-fit: contain;">` :
      pickaxe.icon;
    
    item.innerHTML = `
      <div class="pickaxe-header">
        <div class="pickaxe-icon ${pickaxe.key}">${iconContent}</div>
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
      <button class="buy-btn" onclick="buyPickaxe('${pickaxe.key}')">
        Buy
      </button>
    `;
    grid.appendChild(item);
  });
}

function changeQuantity(pickaxeType, delta) {
  const input = $(`#qty-${pickaxeType}`);
  const currentValue = parseInt(input.value) || 1;
  const newValue = Math.max(1, Math.min(1000, currentValue + delta));
  input.value = newValue;
}

function disconnectWallet() {
    state.address = null;
    state.status = null;
    localStorage.removeItem('gm_address');
    $('#connectBtn').textContent = '🔗 Connect Wallet';
}

async function connectWallet(auto = false) {
  console.log('🔗 Connecting wallet... (auto:', auto, ')');
  
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    console.log('❌ No wallet provider found');
    if (!auto) alert('Phantom wallet not found. Please install Phantom.');
    return;
  }
  
  try {
    let account;
    
    // If auto-connecting and wallet is already connected, use existing connection
    if (auto && provider.isConnected && provider.publicKey) {
      account = provider.publicKey;
      console.log('✅ Using existing wallet connection');
    } else {
      // Manual connection or fresh auto-connect
      const resp = await provider.connect({ onlyIfTrusted: auto });
      account = resp?.publicKey || provider.publicKey;
      
      if (!account && !auto) {
        // Try again without onlyIfTrusted for manual connections
        const resp2 = await provider.connect();
        account = resp2?.publicKey || provider.publicKey;
      }
    }
    
    if (!account) {
      console.log('❌ No account found after connection attempt');
      return;
    }
    
    const newAddress = account.toString();
    console.log('🎯 Connected to wallet:', newAddress.slice(0, 8) + '...' + newAddress.slice(-4));
    
    // Check if wallet address changed
    const cachedAddress = localStorage.getItem('gm_address');
    if (cachedAddress && cachedAddress !== newAddress) {
      console.log('🔄 Wallet changed detected! Clearing previous data...');
      await clearPreviousUserData();
    }
    
    // Store wallet connection
    state.wallet = provider;
    state.address = newAddress;
    localStorage.setItem('gm_address', state.address);
    
    console.log('📊 Updating wallet display...');
    
    // Update connect button to show wallet info
    updateConnectButtonDisplay();
    
    // Update wallet address display
    const walletAddressEl = $('#walletAddress');
    if (walletAddressEl) {
      walletAddressEl.textContent = state.address.slice(0, 8) + '...' + state.address.slice(-4);
      console.log('✅ Wallet address displayed');
    }
    
    // Initialize connection for balance checking
    if (!state.connection && state.config) {
      const clusterUrl = state.config.clusterUrl || 'https://api.devnet.solana.com';
      state.connection = new solanaWeb3.Connection(clusterUrl);
    }
    
    // Update wallet balance
    console.log('💰 Fetching wallet balance...');
    await updateWalletBalance();
    
    // Register user with referral if applicable
    console.log('👥 Registering user...');
    await registerUserWithReferral();
    
    // Check if user has purchased land and load full status
    console.log('🏞️ Checking land ownership...');
    await checkLandOwnership();
    
    console.log('📈 Loading user data...');
    await refreshStatus();
    
    // Start polling if not already started
    if (!state.intervalId) {
      console.log('⏰ Starting status polling...');
      startStatusPolling();
    }
    
    console.log('🎉 Wallet connection complete!');
    
  } catch (e) {
    console.error('❌ Wallet connection failed:', e);
    if (!auto) alert('Failed to connect wallet: ' + e.message);
  }
}

async function tryAutoConnect() {
  console.log('🔍 Attempting auto-connect...');
  
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    console.log('❌ No Solana wallet provider found');
    return;
  }
  
  // Check if wallet is already connected
  if (provider.isConnected && provider.publicKey) {
    console.log('🟢 Wallet already connected, auto-connecting...');
    const currentAddress = provider.publicKey.toString();
    
    // Check cached address
    const cachedAddress = localStorage.getItem('gm_address');
    if (cachedAddress && cachedAddress !== currentAddress) {
      console.log('🔄 Different wallet detected! Clearing previous data...');
      await clearPreviousUserData();
    }
    
    // Connect to current wallet
    await connectWallet(true);
    return;
  }
  
  // Check if we have a cached address and try to auto-connect
  const cached = localStorage.getItem('gm_address');
  if (cached) {
    console.log('🔄 Found cached address, attempting auto-connect...');
    try {
      await connectWallet(true);
    } catch (e) {
      console.log('❌ Auto-connect failed:', e.message);
      // Clear invalid cached data
      localStorage.removeItem('gm_address');
    }
  } else {
    console.log('ℹ️ No cached wallet found - user needs to connect manually');
  }
}

// Clear previous user data when wallet changes
async function clearPreviousUserData() {
  console.log('🧹 Clearing previous user data...');
  
  // Clear intervals
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.serverSyncId) {
    clearInterval(state.serverSyncId);
    state.serverSyncId = null;
  }
  
  // Reset state to fresh user
  state.address = null;
  state.wallet = null;
  state.status = { gold: 0, inventory: null };
  state.hasLand = false;
  state.balance = undefined;
  
  // Clear localStorage data
  localStorage.removeItem('gm_address');
  localStorage.removeItem('gm_inventory');
  localStorage.removeItem('gm_gold');
  localStorage.removeItem('gm_purchases');
  localStorage.removeItem('gm_referral');
  
  // Reset UI to default state
  resetToFreshState();
  
  console.log('✅ Previous user data cleared - ready for new wallet');
}

// Reset UI to fresh state for new user
function resetToFreshState() {
  // Reset connect button
  const connectBtn = $('#connectBtn');
  if (connectBtn) {
    connectBtn.textContent = '🔗 Connect Wallet';
    connectBtn.disabled = false;
    connectBtn.style.fontSize = '11px';
    connectBtn.style.padding = '6px 12px';
    connectBtn.style.background = 'linear-gradient(45deg, var(--primary), #00b894)';
  }
  
  // Reset all display elements to default
  const elements = {
    '#walletAddress': 'Not connected',
    '#walletBalance': '0 SOL',
    '#totalGold': '0.00',
    '#totalPickaxes': '0',
    '#miningRate': '0/min',
    '#currentMiningRate': '+0 gold/min',
    '#miningStatus': '💤 Connect wallet to start!',
    '#ownedPickaxes': 'No pickaxes owned',
    '#pickaxeInventory': 'No pickaxes owned'
  };
  
  Object.entries(elements).forEach(([selector, text]) => {
    const el = $(selector);
    if (el) el.textContent = text;
  });
  
  // Clear all messages
  const messageElements = ['#shopMsg', '#sellMsg', '#landMsg', '#storeMsg'];
  messageElements.forEach(selector => {
    const el = $(selector);
    if (el) {
      el.textContent = '';
      el.className = '';
    }
  });
  
  // Hide owned pickaxe displays in shop
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const ownedEl = $(`#owned-${type}`);
    if (ownedEl) {
      ownedEl.style.display = 'none';
    }
  });
  
  // Hide land modal if it's showing
  const landModal = $('#landModal');
  if (landModal) {
    landModal.classList.remove('show');
  }
  document.body.style.overflow = 'auto';
  
  console.log('✅ UI reset to fresh state');
}

async function updateWalletBalance() {
  if (!state.wallet || !state.address) {
    $('#walletBalance').textContent = '0 SOL';
    return;
  }
  
  try {
    const connection = new solanaWeb3.Connection(state.config?.clusterUrl || 'https://api.devnet.solana.com');
    const publicKey = new solanaWeb3.PublicKey(state.address);
    const balance = await connection.getBalance(publicKey);
    const solBalance = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3);
    $('#walletBalance').textContent = `${solBalance} SOL`;
  } catch (e) {
    console.error('Failed to fetch balance:', e);
    $('#walletBalance').textContent = 'Error';
  }
}

async function startStatusPolling() {
  // Initial status refresh to get current gold amount and initialize mining engine
  await refreshStatus();
  
  if (state.intervalId) clearInterval(state.intervalId);
  if (state.serverSyncId) clearInterval(state.serverSyncId);
  
  // CLIENT-SIDE mining with real-time UI updates every second
  state.intervalId = setInterval(() => {
    if (state.miningEngine && state.miningEngine.isRunning) {
      // Mine gold on client-side
      const goldEarned = state.miningEngine.mine();
      
      // Update UI with current mining state
      updateMiningDisplay();
      
      // Log mining progress for debugging (only when actually mining)
      if (goldEarned > 0) {
        console.log(`⛏️ Mined ${goldEarned.toFixed(4)} gold (Total: ${state.miningEngine.gold.toFixed(2)})`);
      }
    } else if (state.miningEngine) {
      // Just update display even if not mining
      updateMiningDisplay();
    }
  }, 1000); // Update every 1 second for real-time feel
  
  // Sync with server every 30 seconds to save progress and validate
  state.serverSyncId = setInterval(async () => {
    if (state.address && state.miningEngine) {
      await syncWithServer(); // Save and validate client progress
    }
  }, state.syncInterval);
  
  console.log('⚡ Client-side mining with real-time updates started');
}

// Check if user should see pause message (only for display purposes)
function shouldShowPauseMessage() {
  if (!state.hasLand) return false;
  
  const currentGold = state.status?.gold || 0;
  
  // Show pause message if gold >= 10,000 and window is not active
  return currentGold >= state.idleMiningLimit && !state.isWindowActive;
}

// Setup anti-idle detection system
function setupAntiIdleSystem() {
  // Track window visibility
  document.addEventListener('visibilitychange', () => {
    state.isWindowActive = !document.hidden;
    if (state.isWindowActive) {
      sendHeartbeat(); // Send heartbeat when user comes back
    }
    updateMiningStatusDisplay();
  });
  
  // Track window focus/blur
  window.addEventListener('focus', () => {
    state.isWindowActive = true;
    sendHeartbeat(); // Send heartbeat when window gets focus
    updateMiningStatusDisplay();
  });
  
  window.addEventListener('blur', () => {
    state.isWindowActive = false;
    updateMiningStatusDisplay();
  });
  
  // Track page visibility (for browser tab switches)
  window.addEventListener('beforeunload', () => {
    state.isWindowActive = false;
  });
  
  // Send periodic heartbeats when user is active
  setInterval(() => {
    if (state.isWindowActive && state.address) {
      sendHeartbeat();
    }
  }, 15000); // Send heartbeat every 15 seconds when active
}

// Send heartbeat to server to indicate user activity
async function sendHeartbeat() {
  if (!state.address) return;
  
  try {
    await fetch('/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address }),
    });
  } catch (e) {
    // Ignore heartbeat errors to avoid spamming console
  }
}

// Update mining display with real-time client-side data
function updateMiningDisplay() {
  if (!state.miningEngine) {
    console.warn('❌ Mining engine not available in updateMiningDisplay');
    return;
  }
  
  const miningState = state.miningEngine.getState();
  const miningStatus = state.miningEngine.getMiningStatus();
  
  // Debug logging
  const totalPickaxes = Object.values(miningState.inventory).reduce((sum, count) => sum + count, 0);
  if (totalPickaxes > 0 && miningState.gold !== undefined) {
    // Only log occasionally to avoid spam
    if (Math.floor(Date.now() / 5000) % 1 === 0) { // Every 5 seconds
      console.log('🔍 Mining Debug:', {
        gold: miningState.gold.toFixed(2),
        pickaxes: totalPickaxes,
        rate: miningState.totalRatePerMinute.toFixed(2) + '/min',
        shouldMine: miningState.isActiveMining,
        engineRunning: state.miningEngine.isRunning
      });
    }
  }
  
  // Update gold display with real-time values from client mining
  updateGoldDisplay(miningState.gold);
  
  // Update mining rate display
  const ratePerMinute = miningState.totalRatePerMinute;
  $('#miningRate').textContent = ratePerMinute.toLocaleString() + '/min';
  $('#currentMiningRate').textContent = `+${ratePerMinute.toLocaleString()} gold/min`;
  
  // Update total pickaxes
  const totalPickaxes = Object.values(miningState.inventory).reduce((sum, count) => sum + count, 0);
  $('#totalPickaxes').textContent = totalPickaxes.toLocaleString();
  
  // Update mining status with real-time feedback
  const statusElement = $('#miningStatus');
  if (statusElement) {
    statusElement.textContent = miningStatus.message;
    statusElement.className = `mining-status ${miningStatus.status}`;
    statusElement.style.color = miningStatus.color;
    statusElement.style.fontWeight = miningStatus.status === 'paused' ? 'bold' : 'normal';
  }
  
  // Update owned pickaxes display
  updateOwnedPickaxesDisplay(miningState.inventory);
  
  // Update shop owned counts
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const ownedEl = $(`#owned-${type}`);
    const count = miningState.inventory[type] || 0;
    if (count > 0) {
      ownedEl.textContent = `Owned: ${count}`;
      ownedEl.style.display = 'block';
    } else {
      ownedEl.style.display = 'none';
    }
  });
  
  // Update inventory text display
  const inventoryItems = Object.entries(miningState.inventory)
    .filter(([k, v]) => v > 0)
    .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
    .join(' • ');
  
  const pickaxeInventoryEl = $('#pickaxeInventory');
  if (pickaxeInventoryEl) {
    pickaxeInventoryEl.textContent = inventoryItems || 'No pickaxes owned';
  }
}

// Update gold display (can accept custom value for real-time updates)
function updateGoldDisplay(goldAmount = null) {
  const displayGold = goldAmount !== null ? goldAmount : (state.status?.gold || 0);
  const goldEl = $('#totalGold');
  if (goldEl) {
    goldEl.textContent = displayGold.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
}

// Sync client mining progress with server (with anti-cheat validation)
async function syncWithServer() {
  if (!state.address || !state.miningEngine) return;
  
  try {
    const miningState = state.miningEngine.getState();
    
    // Send current client state to server for validation
    const response = await fetch('/sync-mining-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        gold: miningState.gold,
        inventory: miningState.inventory,
        lastUpdate: miningState.lastUpdate,
        totalRate: miningState.totalRatePerMinute
      }),
    });
    
    if (response.ok) {
      const serverData = await response.json();
      state.lastServerSync = Date.now();
      
      console.log('💾 Synced mining progress with server:', {
        clientGold: miningState.gold.toFixed(2),
        serverGold: serverData.syncedGold?.toFixed(2) || 'unchanged',
        totalRate: miningState.totalRatePerMinute.toFixed(2) + '/min'
      });
      
      // Handle server corrections (anti-cheat validation)
      if (serverData.correctedGold !== undefined) {
        state.miningEngine.gold = serverData.correctedGold;
        console.log('🛡️ Anti-cheat: Server corrected gold to:', serverData.correctedGold);
      }
      
      // Sync inventory if server has updates (from purchases, etc.)
      if (serverData.syncedInventory) {
        state.miningEngine.inventory = serverData.syncedInventory;
        console.log('🔄 Synced inventory from server:', serverData.syncedInventory);
      }
    } else {
      console.warn('Failed to sync with server:', response.status);
    }
  } catch (e) {
    console.error('Failed to sync with server:', e);
    // Continue mining locally even if sync fails
  }
}

// Legacy function for backward compatibility  
function updateMiningStatusDisplay() {
  if (state.miningEngine) {
    updateMiningDisplay();
  }
}

async function refreshStatus() {
  if (!state.address) return;
  
  try {
    const r = await fetch(`/status?address=${encodeURIComponent(state.address)}`);
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    
    // Initialize mining engine with server data
    if (state.miningEngine) {
      const goldAmount = json.gold || 0;
      const inventory = json.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
      
      state.miningEngine.init({
        gold: goldAmount,
        inventory: inventory
      });
      
      console.log('⚡ Mining engine initialized with server data:', {
        gold: goldAmount,
        inventory: inventory,
        miningRate: state.miningEngine.getTotalMiningRatePerMinute() + '/min'
      });
      
      // Start mining engine
      state.miningEngine.startMiningLoop();
      
      // Start mining immediately if user has pickaxes
      const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + count, 0);
      if (totalPickaxes > 0) {
        console.log('🏁 Starting mining with', totalPickaxes, 'pickaxe(s)');
        console.log('Mining rate:', state.miningEngine.getTotalMiningRatePerMinute(), 'gold/min');
      }
    }
    
    // Update state with server data (initial sync)
    state.status = {
      gold: json.gold || 0,
      inventory: json.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }
    };
    
    updateDisplay(json);
  } catch (e) {
    console.error('Status refresh failed:', e);
  }
}

function updateDisplay(data) {
  // Server data is authoritative - always use it
  const serverGold = data.gold || 0;
  const serverInventory = data.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  
  // Update state with server data (authoritative)
  state.status.gold = serverGold;
  state.status.inventory = serverInventory;
  
  // Update gold display
  updateGoldDisplay();
  
  // Update inventory and totals
  const totalPickaxes = Object.values(serverInventory).reduce((sum, count) => sum + count, 0);
  $('#totalPickaxes').textContent = totalPickaxes.toLocaleString();
  
  // Update mining rate display (show per minute) - use mining engine if available
  const currentRatePerMinute = state.miningEngine ? state.miningEngine.getTotalMiningRatePerMinute() : 0;
  $('#miningRate').textContent = currentRatePerMinute.toLocaleString() + '/min';
  $('#currentMiningRate').textContent = `+${currentRatePerMinute.toLocaleString()} gold/min`;
  
  // Update inventory and pickaxe displays - now handled by updateOwnedPickaxesDisplay
  // updateInventoryDisplay();
  // updatePickaxeCountsDisplay();
  
  // Update mining status
  updateMiningStatusDisplay();
  
  // Update owned pickaxes display in shop
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const ownedEl = $(`#owned-${type}`);
    const count = serverInventory[type] || 0;
    if (count > 0) {
      ownedEl.textContent = `Owned: ${count}`;
      ownedEl.style.display = 'block';
    } else {
      ownedEl.style.display = 'none';
    }
  });
  
  // Update old inventory display for backwards compatibility
  const inventoryItems = Object.entries(serverInventory)
    .filter(([k, v]) => v > 0)
    .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
    .join(' • ');
  
  const pickaxeInventoryEl = $('#pickaxeInventory');
  if (pickaxeInventoryEl) {
    pickaxeInventoryEl.textContent = inventoryItems || 'No pickaxes owned';
  }
  
  // Update "Your Pickaxes" display with colored background icons
  updateOwnedPickaxesDisplay(serverInventory);
}

// Function to update "Your Pickaxes" section with colored background icons
function updateOwnedPickaxesDisplay(inventory) {
  const ownedPickaxesEl = $('#ownedPickaxes');
  if (!ownedPickaxesEl) return;
  
  const pickaxeTypes = ['silver', 'gold', 'diamond', 'netherite'];
  const ownedPickaxes = pickaxeTypes.filter(type => inventory[type] > 0);
  
  if (ownedPickaxes.length === 0) {
    ownedPickaxesEl.textContent = 'No pickaxes owned';
    return;
  }
  
  // Create colored background icons for each owned pickaxe type with count beside
  const pickaxeIconsHTML = ownedPickaxes.map(type => {
    const count = inventory[type];
    return `<div class="owned-pickaxe-item" title="${type.charAt(0).toUpperCase() + type.slice(1)} Pickaxe: ${count}">
      <div class="owned-pickaxe-icon ${type}"></div>
      <span class="pickaxe-count-text">${count}</span>
    </div>`;
  }).join('');
  
  ownedPickaxesEl.innerHTML = pickaxeIconsHTML;
}

async function buyPickaxe(pickaxeType) {
  if (!state.address) {
    $('#shopMsg').textContent = 'Please connect your wallet first!';
    $('#shopMsg').className = 'msg error';
    return;
  }
  
  const quantity = parseInt($(`#qty-${pickaxeType}`).value) || 1;
  
  try {
    $('#shopMsg').textContent = 'Processing purchase...';
    $('#shopMsg').className = 'msg';
    
    // Build transaction
    const r1 = await fetch('/purchase-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity }),
    });
    const j1 = await r1.json();
    if (j1.error) throw new Error(j1.error);

    const txBytes = Uint8Array.from(atob(j1.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);

    // Sign and send
    const sig = await state.wallet.signAndSendTransaction(tx);
    $('#shopMsg').textContent = `Transaction submitted: ${sig.signature.slice(0, 8)}...`;

    // Confirm
    const r2 = await fetch('/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity, signature: sig.signature }),
    });
    const j2 = await r2.json();
    if (j2.error) throw new Error(j2.error);

    $('#shopMsg').textContent = `✅ Successfully purchased ${quantity}x ${pickaxeType} pickaxe!`;
    $('#shopMsg').className = 'msg success';
    
    // Server confirmed purchase - update client mining engine with server data
    if (state.miningEngine && j2.inventory) {
      // Use server inventory as authoritative source
      state.miningEngine.inventory = j2.inventory;
      console.log('✅ Updated client mining engine with server inventory:', j2.inventory);
    }
    
    // Refresh status to sync everything
    await refreshStatus();
    updateWalletBalance();
  } catch (e) {
    console.error(e);
    $('#shopMsg').textContent = '❌ Purchase failed: ' + e.message;
    $('#shopMsg').className = 'msg error';
  }
}

async function sellGold() {
  if (!state.address) {
    $('#sellMsg').textContent = 'Please connect your wallet first!';
    $('#sellMsg').className = 'msg error';
    return;
  }
  
  const amountGold = parseFloat($('#sellAmount').value || '0');
  if (!isFinite(amountGold) || amountGold <= 0) {
    $('#sellMsg').textContent = 'Please enter a valid gold amount!';
    $('#sellMsg').className = 'msg error';
    return;
  }
  
  try {
    $('#sellMsg').textContent = 'Processing sale...';
    $('#sellMsg').className = 'msg';
    
    // Check client-side gold amount first
    if (state.miningEngine && state.miningEngine.gold < amountGold) {
      throw new Error(`Insufficient gold. You have ${Math.floor(state.miningEngine.gold)} gold but need ${amountGold} gold.`);
    }
    
    // Send sell request to server with client gold amount for validation
    const r = await fetch('/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address, 
        amountGold,
        clientGold: state.miningEngine ? state.miningEngine.gold : 0,
        clientInventory: state.miningEngine ? state.miningEngine.inventory : {}
      }),
    });
    const j = await r.json();
    if (j.error) {
      throw new Error(j.error);
    }
    
    // Server validated and processed sale - update client mining engine
    if (state.miningEngine && j.newGold !== undefined) {
      state.miningEngine.gold = j.newGold;
      console.log('✅ Updated client gold after sale:', j.newGold);
    }
    
    if (j.mode === 'pending') {
      $('#sellMsg').textContent = `✅ Sale recorded! Pending payout of ${j.payoutSol} SOL`;
      $('#sellMsg').className = 'msg success';
    } else {
      $('#sellMsg').textContent = `✅ Sale complete! Received ${j.payoutSol} SOL`;
      $('#sellMsg').className = 'msg success';
    }
    
    $('#sellAmount').value = '';
    
    // Force sync with server after sale to ensure everything is consistent
    if (state.miningEngine) {
      await syncWithServer();
    }
    
    updateWalletBalance();
  } catch (e) {
    console.error(e);
    $('#sellMsg').textContent = '❌ Sale failed: ' + e.message;
    $('#sellMsg').className = 'msg error';
  }
}

// Navigation functionality
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));
      // Add active class to clicked link
      link.classList.add('active');
      
      // You can add page switching logic here
      const page = link.getAttribute('href').substring(1);
      console.log(`Navigating to: ${page}`);
    });
  });
}

// Update footer stats
async function updateFooterStats() {
  try {
    // You can add an API endpoint to get global stats
    const totalPlayers = Math.floor(Math.random() * 1000) + 500; // Mock data for now
    $('#footerStats').textContent = `Total Players: ${totalPlayers.toLocaleString()}`;
  } catch (e) {
    $('#footerStats').textContent = 'Total Players: -';
  }
}

// Referral Modal Functions
function openReferralModal() {
  const modal = $('#referralModal');
  modal.classList.add('show');
  updateReferralData();
}

function closeReferralModal() {
  const modal = $('#referralModal');
  modal.classList.remove('show');
}

// How it Works Modal functions
function showHowItWorksModal() {
  $('#howItWorksModal').classList.add('show');
}

function hideHowItWorksModal() {
  $('#howItWorksModal').classList.remove('show');
}

async function updateReferralData() {
  // Generate referral link based on wallet address
  if (state.address) {
    try {
      const response = await fetch(`/referral-link?address=${encodeURIComponent(state.address)}`);
      const data = await response.json();
      $('#referralLink').value = data.referralLink;
    } catch (e) {
      // Fallback to generating link locally
      const referralLink = `${window.location.origin}/?ref=${encodeURIComponent(state.address)}`;
      $('#referralLink').value = referralLink;
    }
  } else {
    $('#referralLink').value = 'Connect wallet to get your referral link';
  }
  
  // Get real referral stats from server
  if (state.address) {
    try {
      const response = await fetch(`/referral-stats?address=${encodeURIComponent(state.address)}`);
      const stats = await response.json();
      
      $('#totalReferrals').textContent = stats.total_referrals || 0;
      
    } catch (e) {
      console.error('Failed to fetch referral stats:', e);
      $('#totalReferrals').textContent = '0';
    }
  }
}

function getTierInfo(totalReferrals) {
  if (totalReferrals >= 25) {
    return {
      currentTier: 'Netherite (25+)',
      nextReward: 'Netherite Pickaxe',
      nextRewardAt: 'Every referral'
    };
  } else if (totalReferrals >= 18) {
    return {
      currentTier: 'Diamond (18-24)',
      nextReward: 'Netherite Pickaxe',
      nextRewardAt: 'at 25 referrals'
    };
  } else if (totalReferrals >= 11) {
    return {
      currentTier: 'Gold (11-17)',
      nextReward: 'Diamond Pickaxe',
      nextRewardAt: 'at 18 referrals'
    };
  } else if (totalReferrals >= 1) {
    return {
      currentTier: 'Silver (1-10)',
      nextReward: 'Gold Pickaxe',
      nextRewardAt: 'at 11 referrals'
    };
  } else {
    return {
      currentTier: 'None',
      nextReward: 'Silver Pickaxe',
      nextRewardAt: 'at 1 referral'
    };
  }
}

function copyReferralLink() {
  const linkInput = $('#referralLink');
  linkInput.select();
  linkInput.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    document.execCommand('copy');
    const copyBtn = $('#copyLinkBtn');
    copyBtn.textContent = '✅ Copied!';
    copyBtn.classList.add('copied');
    
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
}

function shareOnTwitter() {
  const referralLink = $('#referralLink').value;
  const text = encodeURIComponent('🎮 Join me in this amazing Gold Mining game and earn SOL! 💰 Mine with pickaxes, get free rewards, and make real money! 🚀');
  const url = encodeURIComponent(referralLink);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareOnX() {
  const referralLink = $('#referralLink').value;
  const text = encodeURIComponent('🎮 Just started mining gold and earning SOL! 💰 This blockchain game is amazing - join me and get free pickaxes! 🚀⛏️');
  const url = encodeURIComponent(referralLink);
  window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareOnDiscord() {
  const referralLink = $('#referralLink').value;
  // Copy link for Discord sharing
  navigator.clipboard.writeText(referralLink).then(() => {
    alert('Referral link copied! Paste it in Discord to share with your friends! 🎮');
  });
}

function shareOnTelegram() {
  const referralLink = $('#referralLink').value;
  const text = encodeURIComponent('🎮 Join me in this amazing Gold Mining game and earn SOL! 💰');
  const url = encodeURIComponent(referralLink);
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

// Land Purchase Functions
async function checkLandOwnership() {
  if (!state.address) return;
  
  try {
    // Check with server if user has purchased land
    const response = await fetch(`/land-status?address=${encodeURIComponent(state.address)}`);
    const data = await response.json();
    
    state.hasLand = data.hasLand || false;
    
    if (state.hasLand) {
      // User has land, proceed to normal game
      startStatusPolling();
    } else {
      // User needs to purchase land first
      showLandModal();
    }
  } catch (e) {
    console.error('Failed to check land ownership:', e);
    // Default to showing land modal for new users
    showLandModal();
  }
}

function showLandModal() {
  const modal = $('#landModal');
  modal.classList.add('show');
  
  // Disable all other interactions
  document.body.style.overflow = 'hidden';
}

function hideLandModal() {
  const modal = $('#landModal');
  modal.classList.remove('show');
  document.body.style.overflow = 'auto';
}

async function purchaseLand() {
  try {
    // Safely update landMsg if it exists
    const landMsgEl = $('#landMsg');
    const purchaseLandBtnEl = $('#purchaseLandBtn');
    
    if (landMsgEl) {
      landMsgEl.textContent = 'Opening wallet extension...';
      landMsgEl.className = 'msg';
    }
    
    if (purchaseLandBtnEl) {
      purchaseLandBtnEl.disabled = true;
      purchaseLandBtnEl.textContent = 'Opening Wallet...';
    }
    
    // Detect available wallet
    const provider = window.solana || window.phantom?.solana;
    if (!provider) {
      throw new Error('No Solana wallet found. Please install Phantom or another Solana wallet.');
    }
    
    // Connect wallet - this will open the wallet extension
    if (landMsgEl) {
      landMsgEl.textContent = 'Please approve wallet connection and transaction...';
    }
    
    const resp = await provider.connect();
    const account = resp?.publicKey || provider.publicKey;
    if (!account) throw new Error('Wallet connection cancelled');
    
    // Store wallet connection
    state.wallet = provider;
    state.address = account.toString();
    localStorage.setItem('gm_address', state.address);
    
    if (landMsgEl) {
      landMsgEl.textContent = 'Wallet connected! Creating land purchase transaction...';
    }
    
    if (purchaseLandBtnEl) {
      purchaseLandBtnEl.textContent = 'Processing...';
    }
    
    // Request land purchase transaction from server
    const response = await fetch('/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address }),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    // Create transaction from server response
    const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);
    
    // Sign and send transaction - this will open wallet extension again for approval
    if (landMsgEl) {
      landMsgEl.textContent = 'Please approve the transaction in your wallet...';
    }
    
    const signature = await state.wallet.signAndSendTransaction(tx);
    
    if (landMsgEl) {
      landMsgEl.textContent = `Transaction submitted: ${signature.signature.slice(0, 8)}...`;
    }
    
    // Confirm land purchase with server
    const confirmResponse = await fetch('/confirm-land-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address, 
        signature: signature.signature 
      }),
    });
    
    const confirmData = await confirmResponse.json();
    if (confirmData.error) throw new Error(confirmData.error);
    
    // Success! Update UI to show connected state
    state.hasLand = true;
    
    // Safely update connect button
    const connectBtnEl = $('#connectBtn');
    if (connectBtnEl) {
      connectBtnEl.textContent = '✅ Connected';
      connectBtnEl.disabled = true;
    }
    
    // Safely update wallet address
    const walletAddressEl = $('#walletAddress');
    if (walletAddressEl) {
      walletAddressEl.textContent = state.address.slice(0, 8) + '...' + state.address.slice(-4);
    }
    
    if (landMsgEl) {
      landMsgEl.textContent = '🎉 Land purchased successfully! Wallet connected! Welcome to Gold Mining!';
      landMsgEl.className = 'msg success';
    }
    
    // Update wallet balance since we just spent SOL
    updateWalletBalance();
    
    // Hide modal after short delay and start the game
    setTimeout(() => {
      hideLandModal();
      startStatusPolling();
    }, 3000);
    
  } catch (e) {
    console.error('Land purchase failed:', e);
    
    // Handle specific error cases
    let errorMessage = e.message;
    if (e.message.includes('User rejected')) {
      errorMessage = 'Transaction was cancelled by user';
    } else if (e.message.includes('Insufficient funds')) {
      errorMessage = 'Insufficient SOL balance. You need at least 0.01 SOL.';
    }
    
    // Safely update error message
    const landMsgEl = $('#landMsg');
    if (landMsgEl) {
      landMsgEl.textContent = '❌ ' + errorMessage;
      landMsgEl.className = 'msg error';
    }
    
    // Re-enable button safely
    const purchaseLandBtnEl = $('#purchaseLandBtn');
    if (purchaseLandBtnEl) {
      purchaseLandBtnEl.disabled = false;
      purchaseLandBtnEl.textContent = '🏞️ Purchase Mining Land (0.01 SOL)';
    }
  }
}

// Check for referral code in URL
function checkReferralCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get('ref');
  
  if (referralCode) {
    // Store referral code for when user connects wallet
    localStorage.setItem('gm_referral', referralCode);
    console.log('Referral code detected:', referralCode);
    
    // Show a welcome message
    setTimeout(() => {
      alert('🎉 Welcome! You were referred by a friend. Connect your wallet to start mining and earn bonus rewards!');
    }, 1000);
  }
}

// Register user with referral system
async function registerUserWithReferral() {
  if (!state.address) return;
  
  try {
    // Check if there's a stored referral code
    const referrerAddress = localStorage.getItem('gm_referral');
    
    // Register user with the server
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address,
        referrerAddress: referrerAddress 
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      if (data.referred && referrerAddress) {
        console.log('✅ User registered with referral from:', referrerAddress);
        
        // Show success message
        setTimeout(() => {
          alert('🎉 Welcome! You\'ve been successfully referred and both you and your referrer will earn bonus rewards!');
        }, 500);
        
        // Clear the referral code since it's been used
        localStorage.removeItem('gm_referral');
      } else {
        console.log('✅ User registered successfully');
      }
    }
    
  } catch (e) {
    console.error('Registration failed:', e);
    // Don't show error to user as this is not critical
  }
}

// Setup wallet change detection
function setupWalletChangeDetection() {
  // Check for wallet changes every 2 seconds
  setInterval(() => {
    const provider = window.solana || window.phantom?.solana;
    if (!provider || !provider.publicKey) return;
    
    const currentWalletAddress = provider.publicKey.toString();
    const cachedAddress = localStorage.getItem('gm_address');
    
    // If we have a cached address and it's different from current wallet
    if (cachedAddress && currentWalletAddress !== cachedAddress && state.address) {
      console.log('🔄 Wallet switch detected during session!');
      console.log(`Previous: ${cachedAddress.slice(0, 8)}...`);
      console.log(`Current: ${currentWalletAddress.slice(0, 8)}...`);
      
      // Clear previous data and treat as new user
      clearPreviousUserData();
      
      // Show fresh start message
      setTimeout(() => {
        alert('🔄 Wallet changed detected! Starting fresh for new wallet...');
      }, 500);
      
      // Automatically connect the new wallet after a short delay
      setTimeout(() => {
        connectWallet(false);
      }, 2000);
    }
  }, 2000);
  
  // Also listen for wallet disconnect events
  const provider = window.solana || window.phantom?.solana;
  if (provider) {
    provider.on('disconnect', () => {
      console.log('👋 Wallet disconnected');
      clearPreviousUserData();
    });
    
    provider.on('accountChanged', (publicKey) => {
      if (publicKey) {
        const newAddress = publicKey.toString();
        const cachedAddress = localStorage.getItem('gm_address');
        
        if (cachedAddress && newAddress !== cachedAddress) {
          console.log('🔄 Account changed event detected!');
          clearPreviousUserData();
          
          setTimeout(() => {
            alert('🔄 Account changed! Starting fresh for new account...');
            connectWallet(false);
          }, 1000);
        }
      }
    });
  }
}

// Update connect button display
function updateConnectButtonDisplay() {
  const connectBtn = $('#connectBtn');
  if (connectBtn && state.address) {
    connectBtn.textContent = '✅ Connected';
    connectBtn.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
  }
}

// V2.0 Coming Soon Modal Functions
function openV2Modal() {
  const modal = $('#v2ComingSoonModal');
  modal.classList.add('show');
  startCountdown();
}

function closeV2Modal() {
  const modal = $('#v2ComingSoonModal');
  modal.classList.remove('show');
}

function startCountdown() {
  const launchDate = new Date('December 15, 2025 00:00:00').getTime();
  
  const countdownInterval = setInterval(() => {
    const now = new Date().getTime();
    const distance = launchDate - now;
    
    if (distance < 0) {
      clearInterval(countdownInterval);
      $('#days').textContent = '000';
      $('#hours').textContent = '00';
      $('#minutes').textContent = '00';
      $('#seconds').textContent = '00';
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

function joinWaitlist() {
  // Store user interest in V2.0
  if (state.address) {
    localStorage.setItem('gm_v2_waitlist', state.address);
  }
  
  alert('🎉 You\'ve been added to the V2.0 waitlist! We\'ll notify you when the Halloween Edition launches on December 15, 2025!');
  closeV2Modal();
}

// Event listeners
// Connect/Disconnect wallet button
$('#connectBtn').addEventListener('click', () => {
    if (state.address) {
        disconnectWallet();
    } else {
        connectWallet(false);
    }
});
$('#sellBtn').addEventListener('click', sellGold);
$('#v2ComingSoonBtn').addEventListener('click', openV2Modal);
$('#referBtn').addEventListener('click', openReferralModal);
$('#closeModal').addEventListener('click', closeReferralModal);
$('#copyLinkBtn').addEventListener('click', copyReferralLink);
$('#shareX').addEventListener('click', shareOnX);
$('#shareDiscord').addEventListener('click', shareOnDiscord);
$('#shareTelegram').addEventListener('click', shareOnTelegram);
$('#purchaseLandBtn').addEventListener('click', purchaseLand);

// Close modal when clicking outside
$('#referralModal').addEventListener('click', (e) => {
  if (e.target === $('#referralModal')) {
    closeReferralModal();
  }
});

$('#v2ComingSoonModal').addEventListener('click', (e) => {
  if (e.target === $('#v2ComingSoonModal')) {
    closeV2Modal();
  }
});

$('#howItWorksModal').addEventListener('click', (e) => {
  if (e.target === $('#howItWorksModal')) {
    hideHowItWorksModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeReferralModal();
    closeV2Modal();
    hideHowItWorksModal();
  }
});

// Initialize navigation
initNavigation();

// Update footer stats periodically
updateFooterStats();
setInterval(updateFooterStats, 30000); // Update every 30 seconds

// Check for referral code on page load
checkReferralCode();

// Setup wallet change detection
setupWalletChangeDetection();

// REMOVED - duplicate initialization, using existing initializeApp() at end of file

// REMOVED - duplicate function, using updateClientSideDisplay() instead

// Reset user data function
async function resetUserData() {
  try {
    // First, try to reset server-side data if user is connected
    if (state.address) {
      const response = await fetch('/reset-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: state.address }),
      });
      
      if (response.ok) {
        console.log('✅ Server data reset successfully');
      } else {
        console.log('⚠️ Server reset failed, continuing with client reset');
      }
    }
  } catch (e) {
    console.log('⚠️ Server reset not available, continuing with client reset');
  }
  
  // Clear all localStorage data
  localStorage.removeItem('gm_address');
  localStorage.removeItem('gm_referral');
  localStorage.clear();
  
  // Reset state completely
  state.wallet = null;
  state.address = null;
  state.status = { gold: 0, inventory: null };
  state.hasLand = false;
  state.isWindowActive = true;
  
  // Clear intervals
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  
  // Reset UI elements
  $('#connectBtn').textContent = '🔗 Connect Wallet';
  $('#connectBtn').disabled = false;
  $('#walletAddress').textContent = 'Not connected';
  $('#walletBalance').textContent = '0 SOL';
  $('#totalGold').textContent = '0.00';
  $('#totalPickaxes').textContent = '0';
  $('#miningRate').textContent = '0/sec';
  $('#currentMiningRate').textContent = '+0 gold/sec';
  $('#miningStatus').textContent = '💤 Connect wallet to start!';
  $('#pickaxeInventory').textContent = 'No pickaxes owned';
  
  // Clear all messages
  $('#shopMsg').textContent = '';
  $('#shopMsg').className = '';
  $('#sellMsg').textContent = '';
  $('#sellMsg').className = '';
  $('#landMsg').textContent = '';
  $('#landMsg').className = '';
  
  // Reset owned pickaxe displays
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const ownedEl = $(`#owned-${type}`);
    if (ownedEl) {
      ownedEl.style.display = 'none';
    }
  });
  
  // Force disconnect from Phantom wallet
  if (window.solana) {
    try {
      await window.solana.disconnect();
    } catch (e) {
      console.log('Wallet disconnect error (normal):', e.message);
    }
  }
  
  console.log('✅ Complete user data reset finished!');
  alert('✅ All data reset! Page will reload to ensure fresh start.');
  
  // Force page reload to ensure completely fresh state
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Add reset button functionality (you can call this from browser console)
window.resetUserData = resetUserData;

// Debug functions for testing mining (call from browser console)
window.debugMining = {
  // Test if mining engine is working
  testMining: () => {
    if (!state.miningEngine) {
      console.log('❌ No mining engine found');
      return;
    }
    
    console.log('🧪 Testing mining engine...');
    console.log('Current state:', state.miningEngine.getState());
    console.log('Should mine:', state.miningEngine.shouldMine());
    console.log('Engine running:', state.miningEngine.isRunning);
    
    // Add a test pickaxe if none exist
    const totalPickaxes = Object.values(state.miningEngine.inventory).reduce((sum, count) => sum + count, 0);
    if (totalPickaxes === 0) {
      console.log('➕ Adding test silver pickaxe...');
      state.miningEngine.addPickaxe('silver', 1);
      if (!state.miningEngine.isRunning) {
        state.miningEngine.startMiningLoop();
      }
    }
    
    console.log('Updated state:', state.miningEngine.getState());
  },
  
  // Force start mining
  startMining: () => {
    if (state.miningEngine) {
      state.miningEngine.startMiningLoop();
      console.log('✅ Mining started');
    }
  },
  
  // Check current status
  status: () => {
    if (!state.miningEngine) {
      console.log('❌ No mining engine');
      return;
    }
    
    const state_data = state.miningEngine.getState();
    console.log('Current mining status:', {
      gold: state_data.gold.toFixed(4),
      pickaxes: state_data.inventory,
      rate: state_data.totalRatePerMinute.toFixed(2) + '/min',
      mining: state_data.isActiveMining,
      running: state.miningEngine.isRunning
    });
  }
};

// Buy pickaxe with gold function
async function buyPickaxeWithGold(pickaxeType, goldCost) {
  if (!state.address) {
    $('#storeMsg').textContent = 'Please connect your wallet first!';
    $('#storeMsg').className = 'msg error';
    return;
  }
  
  try {
    $('#storeMsg').textContent = 'Processing purchase...';
    $('#storeMsg').className = 'msg';
    
    const response = await fetch('/buy-pickaxe-with-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address, 
        pickaxeType, 
        goldCost 
      }),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    $('#storeMsg').textContent = `✅ ${data.message}`;
    $('#storeMsg').className = 'msg success';
    
    // Refresh status to show updated gold and inventory
    await refreshStatus();
    
    // Force update the "Your Pickaxes" display with new colored icons
    if (state.status?.inventory) {
      updateOwnedPickaxesDisplay(state.status.inventory);
    }
    
  } catch (e) {
    console.error(e);
    $('#storeMsg').textContent = '❌ Purchase failed: ' + e.message;
    $('#storeMsg').className = 'msg error';
  }
}

// Emergency complete reset - wipes everything
async function emergencyCompleteReset() {
  console.log('🚨 EMERGENCY COMPLETE RESET INITIATED...');
  
  try {
    // Step 1: Disconnect wallet completely
    if (window.solana && window.solana.isConnected) {
      await window.solana.disconnect();
      console.log('✅ Wallet disconnected');
    }
    
    // Step 2: Clear ALL localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ All browser storage cleared');
    
    // Step 3: Clear all cookies for this domain
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    console.log('✅ All cookies cleared');
    
    // Step 4: Reset all state variables
    state = {
      connection: null,
      config: null,
      wallet: null,
      address: null,
      intervalId: null,
      status: { gold: 0, inventory: null },
      hasLand: false,
      isWindowActive: true,
      idleMiningLimit: 10000,
    };
    console.log('✅ State reset to default');
    
    // Step 5: Clear all intervals
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    
    // Step 6: Try to reset server database for all possible addresses
    const resetRequests = [];
    
    // Try current address if available
    if (state.address) {
      resetRequests.push(fetch('/reset-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: state.address }),
      }));
    }
    
    // Try to reset any stored addresses
    const possibleAddresses = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('address') || key.includes('wallet')) {
        const value = localStorage.getItem(key);
        if (value && value.length > 20) { // Likely a wallet address
          possibleAddresses.push(value);
        }
      }
    }
    
    // Reset server data for all found addresses
    possibleAddresses.forEach(addr => {
      resetRequests.push(fetch('/reset-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      }));
    });
    
    // Global database reset request
    resetRequests.push(fetch('/reset-all-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAll: true }),
    }));
    
    // Also try the specific reset endpoints
    resetRequests.push(fetch('/reset-user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAll: true }),
    }));
    
    await Promise.allSettled(resetRequests);
    console.log('✅ Server reset requests sent');
    
    // Step 7: Reset all UI elements to default state
    resetAllUI();
    
    // Step 8: Clear any cached data in memory
    if (window.caches) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('✅ Browser caches cleared');
    }
    
    console.log('🎉 EMERGENCY COMPLETE RESET FINISHED!');
    alert('🚨 EMERGENCY RESET COMPLETE!\n\nEverything has been wiped:\n- Frontend data\n- Server database\n- Browser storage\n- Wallet connection\n\nPage will reload in 2 seconds...');
    
    // Force complete page reload
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname;
    }, 2000);
    
  } catch (error) {
    console.error('Reset error:', error);
    alert('Reset completed with some errors. Page will reload...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

function resetAllUI() {
  // Reset connection UI
  const connectBtn = $('#connectBtn');
  if (connectBtn) {
    connectBtn.textContent = '🔗 Connect Wallet';
    connectBtn.disabled = false;
  }
  
  // Reset wallet display
  const elements = {
    '#walletAddress': 'Not connected',
    '#walletBalance': '0 SOL',
    '#totalGold': '0.00',
    '#totalPickaxes': '0',
    '#miningRate': '0/sec',
    '#currentMiningRate': '+0 gold/sec',
    '#miningStatus': '💤 Connect wallet to start!',
    '#pickaxeInventory': 'No pickaxes owned',
  };
  
  Object.entries(elements).forEach(([selector, text]) => {
    const el = $(selector);
    if (el) el.textContent = text;
  });
  
  // Clear all messages
  const messageElements = ['#shopMsg', '#sellMsg', '#landMsg'];
  messageElements.forEach(selector => {
    const el = $(selector);
    if (el) {
      el.textContent = '';
      el.className = '';
    }
  });
  
  // Reset pickaxe owned displays
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const ownedEl = $(`#owned-${type}`);
    if (ownedEl) {
      ownedEl.style.display = 'none';
    }
  });
  
  console.log('✅ All UI elements reset');
}

// Store functionality - Buy pickaxes with gold
async function buyPickaxeWithGold(pickaxeType, goldCost) {
  try {
    if (!state.address) {
      $('#storeMsg').textContent = 'Please connect your wallet first!';
      $('#storeMsg').className = 'msg error';
      return;
    }
    
    // Check if user has enough gold
    const currentGold = state.status?.gold || 0;
    if (currentGold < goldCost) {
      $('#storeMsg').textContent = `Not enough gold! You need ${goldCost.toLocaleString()} gold but only have ${Math.floor(currentGold).toLocaleString()} gold.`;
      $('#storeMsg').className = 'msg error';
      return;
    }
    
    $('#storeMsg').textContent = `Purchasing ${pickaxeType} pickaxe...`;
    $('#storeMsg').className = 'msg';
    
    // Try the gold purchase endpoint first
    let response;
    try {
      response = await fetch('/purchase-pickaxe-with-gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: state.address, 
          pickaxeType: pickaxeType,
          goldCost: goldCost
        }),
      });
      
      // Check if server endpoint exists and works
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Endpoint not found');
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }
      
      // Server endpoint exists and works
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Update local state with server response
      state.status.gold = data.newGold;
      state.status.inventory = data.newInventory;
      
      // Success with server!
      $('#storeMsg').textContent = `✅ Successfully purchased ${pickaxeType} pickaxe for ${goldCost.toLocaleString()} gold!`;
      $('#storeMsg').className = 'msg success';
      
      // Update displays
      updateGoldDisplay();
      // updateInventoryDisplay(); // Disabled - using updateOwnedPickaxesDisplay
      // updatePickaxeCountsDisplay(); // Disabled - using updateOwnedPickaxesDisplay
      updateMiningStatusDisplay();
      
      // Update mining rate display after inventory change
      const newRatePerMinute = getTotalMiningRatePerMinute();
      $('#miningRate').textContent = newRatePerMinute.toLocaleString() + '/min';
      $('#currentMiningRate').textContent = `+${newRatePerMinute.toLocaleString()} gold/min`;
      
      // Save to localStorage for persistence
      savePurchaseToStorage(pickaxeType, goldCost);
      
      console.log('✅ Server purchase successful:', data);
      
    } catch (e) {
      // If endpoint doesn't exist or fails, simulate the purchase locally
      console.log('Gold purchase endpoint not available, simulating locally...', e.message);
      
      // Deduct gold locally
      state.status.gold -= goldCost;
      
      // Add pickaxe locally
      if (!state.status.inventory) {
        state.status.inventory = { silver: 0, gold: 0, diamond: 0, netherite: 0 };
      }
      state.status.inventory[pickaxeType] = (state.status.inventory[pickaxeType] || 0) + 1;
      
      // Update displays
      updateGoldDisplay();
      updateMiningStatusDisplay();
      // updateInventoryDisplay(); // Disabled - using updateOwnedPickaxesDisplay
      // updatePickaxeCountsDisplay(); // Disabled - using updateOwnedPickaxesDisplay
      
      // Update mining rate display after inventory change
      const newRatePerMinute = getTotalMiningRatePerMinute();
      $('#miningRate').textContent = newRatePerMinute.toLocaleString() + '/min';
      $('#currentMiningRate').textContent = `+${newRatePerMinute.toLocaleString()} gold/min`;
      
      // Save to localStorage for persistence
      savePurchaseToStorage(pickaxeType, goldCost);
      
      $('#storeMsg').textContent = `✅ Successfully purchased ${pickaxeType} pickaxe for ${goldCost.toLocaleString()} gold!`;
      $('#storeMsg').className = 'msg success';
      
      // Clear message after 3 seconds
      setTimeout(() => {
        $('#storeMsg').textContent = '';
        $('#storeMsg').className = '';
      }, 3000);
      return;
    }
    
    // Clear message after 3 seconds
    setTimeout(() => {
      $('#storeMsg').textContent = '';
      $('#storeMsg').className = '';
    }, 3000);
    
  } catch (e) {
    console.error('Store purchase failed:', e);
    $('#storeMsg').textContent = '❌ Purchase failed: ' + e.message;
    $('#storeMsg').className = 'msg error';
  }
}

// Update connect button display
function updateConnectButtonDisplay() {
  const connectBtn = $('#connectBtn');
  if (!connectBtn) return;
  
  if (state.address && state.balance !== undefined) {
    // Show shortened address with balance and checkmark
    const shortAddress = state.address.slice(0, 4) + '...' + state.address.slice(-4);
    connectBtn.innerHTML = `✅ ${shortAddress} | ${state.balance} SOL`;
    connectBtn.disabled = true;
    connectBtn.style.fontSize = '10px';
    connectBtn.style.padding = '6px 10px';
    connectBtn.style.background = 'linear-gradient(45deg, #00b894, var(--primary))';
  } else if (state.address) {
    // Address connected but balance not loaded yet
    const shortAddress = state.address.slice(0, 4) + '...' + state.address.slice(-4);
    connectBtn.innerHTML = `✅ ${shortAddress} | Loading...`;
    connectBtn.disabled = true;
    connectBtn.style.fontSize = '10px';
    connectBtn.style.padding = '6px 10px';
  } else {
    // Not connected
    connectBtn.textContent = '🔗 Connect Wallet';
    connectBtn.disabled = false;
    connectBtn.style.fontSize = '11px';
    connectBtn.style.padding = '6px 12px';
    connectBtn.style.background = 'linear-gradient(45deg, var(--primary), #00b894)';
  }
}

async function updateWalletBalance() {
  if (!state.address) return;
  
  try {
    // Initialize connection if not exists
    if (!state.connection) {
      const clusterUrl = state.config?.clusterUrl || 'https://api.devnet.solana.com';
      state.connection = new solanaWeb3.Connection(clusterUrl);
    }
    
    const publicKey = new solanaWeb3.PublicKey(state.address);
    const balance = await state.connection.getBalance(publicKey);
    const solBalance = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3);
    
    // Store balance in state for connect button display
    state.balance = solBalance;
    
    const balanceEl = $('#walletBalance');
    if (balanceEl) {
      balanceEl.textContent = `${solBalance} SOL`;
    }
    
    // Update connect button display with new balance
    updateConnectButtonDisplay();
  } catch (e) {
    console.error('Failed to fetch balance:', e);
    // Still update button with address even if balance fails
    updateConnectButtonDisplay();
  }
}

// Update gold display - only show server data (no local calculations)
function updateGoldDisplay() {
  const currentGold = state.status?.gold || 0;
  const goldElement = $('#totalGold');
  
  // Get the current displayed value to prevent jumping
  const currentDisplayed = parseFloat(goldElement.textContent.replace(/,/g, '')) || 0;
  
  // Only update if there's a meaningful change (more than 0.01 difference)
  if (Math.abs(currentGold - currentDisplayed) >= 0.01) {
    // Format with 2 decimal places to show .00
    goldElement.textContent = currentGold.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

// Get total mining rate per MINUTE
function getTotalMiningRatePerMinute() {
  const inv = state.status?.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  
  // Pickaxe rates per MINUTE
  const rates = {
    silver: 1,       // 1 gold per minute
    gold: 10,        // 10 gold per minute  
    diamond: 100,    // 100 gold per minute
    netherite: 10000 // 10,000 gold per minute
  };
  
  return (inv.silver * rates.silver) + 
         (inv.gold * rates.gold) + 
         (inv.diamond * rates.diamond) + 
         (inv.netherite * rates.netherite);
}

// Get display rate per minute for UI
function getDisplayMiningRate() {
  return getTotalMiningRatePerMinute().toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

// Update inventory display
function updateInventoryDisplay() {
  const inv = state.status?.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  const totalPickaxes = Object.values(inv).reduce((sum, count) => sum + count, 0);
  
  // Update total pickaxes count
  const totalPickaxesEl = $('#totalPickaxes');
  if (totalPickaxesEl) {
    totalPickaxesEl.textContent = totalPickaxes;
  }
  
  // Update simple owned pickaxes display
  const ownedPickaxesEl = $('#ownedPickaxes');
  if (ownedPickaxesEl) {
    if (totalPickaxes === 0) {
      ownedPickaxesEl.textContent = 'No pickaxes owned';
    } else {
      const ownedParts = [];
      if (inv.silver > 0) ownedParts.push(`🥈${inv.silver}`);
      if (inv.gold > 0) ownedParts.push(`🥇${inv.gold}`);
      if (inv.diamond > 0) ownedParts.push(`💎${inv.diamond}`);
      if (inv.netherite > 0) ownedParts.push(`🌟${inv.netherite}`);
      
      ownedPickaxesEl.textContent = ownedParts.join(' • ');
    }
  }
  
  // Keep old display for backwards compatibility
  const inventoryEl = $('#pickaxeInventory');
  if (inventoryEl) {
    if (totalPickaxes === 0) {
      inventoryEl.textContent = 'No pickaxes owned';
    } else {
      const inventoryParts = [];
      if (inv.silver > 0) inventoryParts.push(`${inv.silver}x Silver`);
      if (inv.gold > 0) inventoryParts.push(`${inv.gold}x Gold`);
      if (inv.diamond > 0) inventoryParts.push(`${inv.diamond}x Diamond`);
      if (inv.netherite > 0) inventoryParts.push(`${inv.netherite}x Netherite`);
      
      inventoryEl.textContent = inventoryParts.join(', ');
    }
  }
}

// Update individual pickaxe counts
function updatePickaxeCountsDisplay() {
  const inv = state.status?.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  
  // Update individual pickaxe count displays if they exist
  const silverEl = $('#silverCount');
  if (silverEl) silverEl.textContent = inv.silver;
  
  const goldEl = $('#goldPickaxeCount');
  if (goldEl) goldEl.textContent = inv.gold;
  
  const diamondEl = $('#diamondCount');
  if (diamondEl) diamondEl.textContent = inv.diamond;
  
  const netheriteEl = $('#netheriteCount');
  if (netheriteEl) netheriteEl.textContent = inv.netherite;
}

// Save purchase to localStorage for persistence
function savePurchaseToStorage(pickaxeType, goldCost) {
  try {
    // Get existing purchases or create new array
    const purchases = JSON.parse(localStorage.getItem('gm_purchases') || '[]');
    
    // Add new purchase with timestamp
    purchases.push({
      pickaxeType: pickaxeType,
      goldCost: goldCost,
      timestamp: Date.now(),
      address: state.address
    });
    
    // Save back to localStorage
    localStorage.setItem('gm_purchases', JSON.stringify(purchases));
    
    // Also save current inventory state
    localStorage.setItem('gm_inventory', JSON.stringify(state.status.inventory));
    localStorage.setItem('gm_gold', state.status.gold.toString());
    
    console.log('✅ Purchase saved to localStorage');
  } catch (e) {
    console.error('Failed to save purchase:', e);
  }
}

// Load purchases from localStorage on startup
function loadPurchasesFromStorage() {
  try {
    console.log('🔄 Loading purchases from localStorage...');
    
    // Initialize status if it doesn't exist
    if (!state.status) {
      state.status = { gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } };
    }
    
    // Load inventory
    const savedInventory = localStorage.getItem('gm_inventory');
    if (savedInventory) {
      const inventory = JSON.parse(savedInventory);
      state.status.inventory = inventory;
      console.log('✅ Loaded inventory:', inventory);
    } else {
      // Initialize empty inventory
      state.status.inventory = { silver: 0, gold: 0, diamond: 0, netherite: 0 };
    }
    
    // Load gold
    const savedGold = localStorage.getItem('gm_gold');
    if (savedGold) {
      state.status.gold = parseFloat(savedGold);
      console.log('✅ Loaded gold:', state.status.gold);
    } else {
      state.status.gold = 0;
    }
    
    // Always update displays with current state
    setTimeout(() => {
      updateGoldDisplay();
      // updateInventoryDisplay(); // Disabled - using updateOwnedPickaxesDisplay
      // updatePickaxeCountsDisplay(); // Disabled - using updateOwnedPickaxesDisplay
      updateMiningStatusDisplay();
      
      // Update mining rate
      const currentRatePerMinute = getTotalMiningRatePerMinute();
      const rateEl = $('#miningRate');
      const currentRateEl = $('#currentMiningRate');
      
      if (rateEl) rateEl.textContent = currentRatePerMinute.toLocaleString() + '/min';
      if (currentRateEl) currentRateEl.textContent = `+${currentRatePerMinute.toLocaleString()} gold/min`;
      
      console.log('✅ All displays updated with saved data');
      console.log('Current state:', {
        gold: state.status.gold,
        inventory: state.status.inventory,
        miningRate: currentRatePerMinute
      });
    }, 100); // Small delay to ensure DOM is ready
    
  } catch (e) {
    console.error('Failed to load purchases:', e);
  }
}

// Make emergency reset available globally
window.emergencyCompleteReset = emergencyCompleteReset;

// Show welcome modal for new users
function showWelcomeForNewUsers() {
  // Always show land modal after 2 seconds for new visitors
  // Check if user doesn't have land ownership already
  setTimeout(async () => {
    // Check if we need to show the modal
    const hasStoredAddress = localStorage.getItem('gm_address');
    
    if (hasStoredAddress) {
      // User has wallet stored, check if they have land
      try {
        const response = await fetch(`/land-status?address=${encodeURIComponent(hasStoredAddress)}`);
        const data = await response.json();
        
        if (!data.hasLand) {
          // User has wallet but no land, show modal
          showLandModal();
        }
      } catch (e) {
        // If check fails, show modal to be safe
        console.log('Land status check failed, showing modal anyway');
        showLandModal();
      }
    } else {
      // No stored wallet, definitely show modal for new user
      console.log('No stored wallet found, showing land modal for new user');
      showLandModal();
    }
  }, 2000); // 2 second delay as requested
}

// Force show modal for testing (override server checks)
function forceShowLandModal() {
  console.log('🎪 Force showing land modal for testing...');
  showLandModal();
}

// Make it available globally for testing
window.forceShowLandModal = forceShowLandModal;

// Initialize the application properly
async function initializeApp() {
  await loadConfig();
  
  // Check if user was previously connected
  const storedAddress = localStorage.getItem('gm_address');
  if (storedAddress) {
    // Set address in state for localStorage loading
    state.address = storedAddress;
    
    // Load saved purchases before anything else
    loadPurchasesFromStorage();
    
    // Try to auto-reconnect wallet
    await connectWallet(true); // true = auto-connect
    
    // If wallet connected, start loading data immediately
    if (state.address) {
      // Don't override local data with server data immediately
      // await refreshStatus();
      startStatusPolling();
    }
  } else {
    // New user - still try to load any saved data
    loadPurchasesFromStorage();
  }
  
  // Show welcome modal for new users only
  showWelcomeForNewUsers();
}

// Function to give users test data for demonstration
async function giveTestData() {
  if (!state.address) {
    alert('Please connect your wallet first!');
    return;
  }
  
  try {
    const response = await fetch('/give-test-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address }),
    });
    
    const data = await response.json();
    if (data.success) {
      alert('✅ Test data added! You now have pickaxes and gold to test the game!');
      await refreshStatus();
    } else {
      alert('❌ Failed to add test data: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    console.error('Failed to give test data:', e);
    alert('❌ Failed to add test data');
  }
}

// Add test data button to help users see mining in action
function addTestDataButton() {
  const headerButtons = document.querySelector('.header-buttons');
  if (headerButtons && !document.getElementById('testDataBtn')) {
    const testBtn = document.createElement('button');
    testBtn.id = 'testDataBtn';
    testBtn.className = 'refer-btn';
    testBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ffa726)';
    testBtn.textContent = '🎮 Get Test Data';
    testBtn.addEventListener('click', giveTestData);
    headerButtons.insertBefore(testBtn, headerButtons.firstChild);
    console.log('✅ Test data button added');
  }
}

// Function to immediately check wallet status
function checkWalletStatus() {
  const provider = window.solana || window.phantom?.solana;
  if (provider && provider.isConnected && provider.publicKey) {
    console.log('🟢 Wallet is already connected!');
    const address = provider.publicKey.toString();
    $('#walletAddress').textContent = address.slice(0, 8) + '...' + address.slice(-4);
    $('#connectBtn').textContent = '✅ Connected';
    return true;
  } else {
    console.log('🔴 Wallet not connected');
    $('#walletAddress').textContent = 'Not connected';
    $('#connectBtn').textContent = '🔗 Connect Wallet';
    return false;
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Gold Mining Game Starting...');
  
  try {
    // Check wallet status immediately
    checkWalletStatus();
    
    // First initialize the app and load config
    await initializeApp();
    
    console.log('📝 Setting up event listeners...');
    
    // Connect Wallet Button
    const connectBtn = $('#connectBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => connectWallet(false));
      console.log('✅ Connect wallet button event listener added');
    } else {
      console.warn('❌ Connect button not found!');
    }
    
    // Referral Button
    const referBtn = $('#referBtn');
    if (referBtn) {
      referBtn.addEventListener('click', openReferralModal);
      console.log('✅ Referral button event listener added');
    }
    
    // V2 Coming Soon Button
    const v2Btn = $('#v2ComingSoonBtn');
    if (v2Btn) {
      v2Btn.addEventListener('click', openV2Modal);
      console.log('✅ V2 button event listener added');
    }
    
    // Sell Button
    const sellBtn = $('#sellBtn');
    if (sellBtn) {
      sellBtn.addEventListener('click', sellGold);
      console.log('✅ Sell button event listener added');
    }
    
    // Land Purchase Button
    const purchaseLandBtn = $('#purchaseLandBtn');
    if (purchaseLandBtn) {
      purchaseLandBtn.addEventListener('click', purchaseLand);
      console.log('✅ Land purchase button event listener added');
    }
    
    // Modal Close Buttons
    const closeModal = $('#closeModal');
    if (closeModal) {
      closeModal.addEventListener('click', closeReferralModal);
    }
    
    // Copy Referral Link Button
    const copyLinkBtn = $('#copyLinkBtn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', copyReferralLink);
    }
    
    // Social Share Buttons
    const shareX = $('#shareX');
    if (shareX) {
      shareX.addEventListener('click', shareOnX);
    }
    
    const shareDiscord = $('#shareDiscord');
    if (shareDiscord) {
      shareDiscord.addEventListener('click', shareOnDiscord);
    }
    
    const shareTelegram = $('#shareTelegram');
    if (shareTelegram) {
      shareTelegram.addEventListener('click', shareOnTelegram);
    }
    
    // Add test data button for easy testing
    addTestDataButton();
    
    // Initialize other systems
    initNavigation();
    setupAntiIdleSystem();
    setupWalletChangeDetection();
    checkReferralCode();
    updateFooterStats();
    
    console.log('✅ All event listeners and systems initialized!');
    console.log('🎮 Gold Mining Game ready to play!');
    
  } catch (error) {
    console.error('❌ Failed to initialize game:', error);
    // Show error message to user
    const connectBtn = $('#connectBtn');
    if (connectBtn) {
      connectBtn.textContent = '❌ Error Loading';
      connectBtn.disabled = true;
    }
  }
});