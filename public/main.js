// Simplified Gold Mining Game - Working Version
let state = {
  connection: null,
  config: null,
  wallet: null,
  address: null,
  intervalId: null,
  status: { gold: 0, inventory: null },
  miningEngine: null,
};

const $ = (sel) => document.querySelector(sel);

// Load configuration
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
    
    // 🔄 AUTO-RECONNECT: Check for saved wallet and reconnect automatically
    await autoReconnectWallet();
    
  } catch (e) {
    console.error('❌ Failed to load config:', e);
  }
}

function updateStaticInfo() {
  if (state.config) {
    $('#goldPrice').textContent = state.config.goldPriceSol + ' SOL';
    $('#minSell').textContent = state.config.minSellGold.toLocaleString();
  }
}

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
    { key: 'netherite', name: 'Netherite Pickaxe', rate: 10000, cost: state.config.pickaxes.netherite.costSol }
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

function changeQuantity(pickaxeType, delta) {
  const input = $(`#qty-${pickaxeType}`);
  const currentValue = parseInt(input.value) || 1;
  const newValue = Math.max(1, Math.min(1000, currentValue + delta));
  input.value = newValue;
}

// Auto-reconnect wallet on page refresh
async function autoReconnectWallet() {
  try {
    // Check if we have a saved address
    const savedAddress = localStorage.getItem('gm_address');
    if (!savedAddress) {
      console.log('🔄 No saved wallet address found');
      return;
    }
    
    console.log('🔄 Found saved wallet address, attempting auto-reconnect...');
    
    // Check if Phantom is available
    const provider = window.solana || window.phantom?.solana;
    if (!provider) {
      console.log('⚠️ Phantom wallet not available for auto-reconnect');
      return;
    }
    
    // Try to connect silently (if wallet is already connected)
    if (provider.isConnected) {
      console.log('✅ Phantom wallet already connected, restoring session...');
      
      const account = provider.publicKey;
      if (account && account.toString() === savedAddress) {
        // Restore wallet state
        state.wallet = provider;
        state.address = savedAddress;
        
        console.log('✅ Wallet auto-reconnected:', savedAddress.slice(0, 8) + '...');
        
        // Update UI
        await updateWalletBalance();
        updateConnectButtonDisplay();
        
        // Load user data
        console.log('📊 Loading user data after auto-reconnect...');
        const userData = await loadInitialUserData();
        
        if (userData) {
          console.log('✅ User data restored after refresh:', userData);
          
          // Update display with restored data
          updateDisplay({
            gold: userData.last_checkpoint_gold || 0,
            inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
            checkpoint: {
              total_mining_power: userData.total_mining_power || 0,
              checkpoint_timestamp: userData.checkpoint_timestamp,
              last_checkpoint_gold: userData.last_checkpoint_gold || 0
            }
          });
          
          // Restore checkpoint for mining
          state.checkpoint = {
            total_mining_power: userData.total_mining_power || 0,
            checkpoint_timestamp: userData.checkpoint_timestamp,
            last_checkpoint_gold: userData.last_checkpoint_gold || 0
          };
          
          // Start mining if user has pickaxes
          if (state.checkpoint.total_mining_power > 0) {
            console.log('⛏️ Resuming mining after page refresh...');
            startCheckpointGoldLoop();
          }
          
          // Check land status
          await checkLandStatusAndShowPopup();
          
          console.log('🎉 Wallet auto-reconnect and data restore complete!');
        } else {
          console.log('ℹ️ New user after auto-reconnect');
          updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
        }
        
        // 🔧 START WALLET SWITCH DETECTION
        setupWalletSwitchDetection(provider);
        
      } else {
        console.log('⚠️ Connected wallet address differs from saved address - wallet switched');
        console.log('🔄 Wallet switched from', savedAddress.slice(0, 8), 'to', account?.toString().slice(0, 8));
        
        // Clear old data and prompt reconnection
        await handleWalletSwitch(account?.toString(), provider);
      }
    } else {
      console.log('ℹ️ Phantom wallet not connected, user needs to connect manually');
    }
    
  } catch (error) {
    console.error('❌ Auto-reconnect failed:', error);
    // Don't show error to user, just let them connect manually
  }
}

// 🔧 NEW: Setup wallet switch detection
function setupWalletSwitchDetection(provider) {
  console.log('🔍 Setting up wallet switch detection...');
  
  // Listen for account changes in Phantom
  if (provider.on) {
    try {
      provider.on('accountChanged', async (publicKey) => {
        console.log('🔄 Phantom accountChanged event fired!', publicKey?.toString()?.slice(0, 8));
        if (publicKey) {
          const newAddress = publicKey.toString();
          const currentAddress = state.address;
          
          console.log('📊 Account change details:', {
            current: currentAddress?.slice(0, 8),
            new: newAddress.slice(0, 8),
            different: newAddress !== currentAddress
          });
          
          if (newAddress !== currentAddress) {
            console.log('👤 Wallet switched from', currentAddress?.slice(0, 8), 'to', newAddress.slice(0, 8));
            await handleWalletSwitch(newAddress, provider);
          }
        } else {
          console.log('👤 Wallet disconnected');
          handleWalletDisconnect();
        }
      });
      
      console.log('✅ Phantom accountChanged listener added');
    } catch (e) {
      console.error('❌ Failed to add accountChanged listener:', e);
    }
  } else {
    console.log('⚠️ Provider.on not available, using polling only');
  }
  
  // Enhanced backup polling with more details
  let pollCount = 0;
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    if (provider.isConnected && provider.publicKey && state.address) {
      const currentPhantomAddress = provider.publicKey.toString();
      const gameAddress = state.address;
      
      // Debug every 10 polls (30 seconds)
      if (pollCount % 10 === 0) {
        console.log(`🔍 Wallet poll #${pollCount}:`, {
          phantom: currentPhantomAddress.slice(0, 8),
          game: gameAddress.slice(0, 8),
          same: currentPhantomAddress === gameAddress
        });
      }
      
      if (currentPhantomAddress !== gameAddress) {
        console.log('🔄 POLLING DETECTED WALLET SWITCH!');
        console.log('   From:', gameAddress?.slice(0, 8));
        console.log('   To:', currentPhantomAddress.slice(0, 8));
        await handleWalletSwitch(currentPhantomAddress, provider);
        clearInterval(pollInterval); // Stop polling after switch detected
      }
    } else {
      // Debug connection issues
      if (pollCount % 20 === 0) { // Every 60 seconds
        console.log(`🔍 Wallet poll #${pollCount} - no connection:`, {
          providerConnected: provider.isConnected,
          hasPublicKey: !!provider.publicKey,
          hasGameAddress: !!state.address
        });
      }
    }
  }, 3000);
  
  console.log('✅ Enhanced wallet polling started');
}

// 🔧 NEW: Handle wallet switch
async function handleWalletSwitch(newAddress, provider) {
  console.log('🔄 Handling wallet switch to:', newAddress?.slice(0, 8) + '...');
  
  // Clear current game state
  state.address = null;
  state.wallet = null;
  state.status = { gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } };
  state.checkpoint = null;
  
  // Stop any mining loops
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
    state.goldUpdateInterval = null;
  }
  
  // Clear any existing land modals
  const existingModal = document.getElementById('mandatoryLandModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Clear existing timers
  if (window.landCheckTimeout) {
    clearTimeout(window.landCheckTimeout);
    window.landCheckTimeout = null;
  }
  
  // Show switching notification
  const notification = document.createElement('div');
  notification.id = 'walletSwitchNotification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(45deg, #4ade80, #22c55e);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-weight: bold;
    text-align: center;
    animation: slideDown 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div>🔄 Wallet Switch Detected!</div>
    <div style="font-size: 14px; margin-top: 5px;">
      Loading data for new wallet...
    </div>
  `;
  
  document.body.appendChild(notification);
  
  try {
    // Automatically set up the new wallet
    state.wallet = provider;
    state.address = newAddress;
    localStorage.setItem('gm_address', newAddress);
    
    console.log('✅ New wallet connected automatically:', newAddress.slice(0, 8) + '...');
    
    // Update balance
    await updateWalletBalance();
    updateConnectButtonDisplay();
    
    // Load user data for the new wallet
    console.log('📊 Loading data for switched wallet...');
    const userData = await loadInitialUserData();
    
    if (userData) {
      console.log('✅ Found existing data for this wallet:', userData);
      
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
      
      // Store checkpoint for mining
      state.checkpoint = {
        total_mining_power: userData.total_mining_power || 0,
        checkpoint_timestamp: userData.checkpoint_timestamp,
        last_checkpoint_gold: userData.last_checkpoint_gold || 0
      };
      
      // Start mining if user has pickaxes
      if (state.checkpoint.total_mining_power > 0) {
        console.log('⛏️ Resuming mining for switched wallet...');
        startCheckpointGoldLoop();
      }
      
      // Update notification
      notification.innerHTML = `
        <div>✅ Wallet Switch Complete!</div>
        <div style="font-size: 14px; margin-top: 5px;">
          Loaded data for ${newAddress.slice(0, 6)}...${newAddress.slice(-4)}
        </div>
      `;
      notification.style.background = 'linear-gradient(45deg, #22c55e, #16a34a)';
      
    } else {
      console.log('ℹ️ No existing data found for this wallet - new user');
      
      // Initialize empty state for new users
      updateDisplay({ 
        gold: 0, 
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } 
      });
      
      // Update notification
      notification.innerHTML = `
        <div>✅ Wallet Switch Complete!</div>
        <div style="font-size: 14px; margin-top: 5px;">
          New wallet detected - ready to start!
        </div>
      `;
      notification.style.background = 'linear-gradient(45deg, #3b82f6, #2563eb)';
    }
    
    // Check land status for the new wallet
    await checkLandStatusAndShowPopup();
    
    console.log('🎉 Wallet switch complete - all data loaded automatically!');
    
  } catch (error) {
    console.error('❌ Failed to load data for switched wallet:', error);
    
    // Reset UI to disconnected state on error
    updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
    
    const connectBtn = $('#connectBtn');
    if (connectBtn) {
      connectBtn.textContent = 'Connect Wallet';
      connectBtn.disabled = false;
    }
    
    // Show error notification
    notification.innerHTML = `
      <div>❌ Wallet Switch Error</div>
      <div style="font-size: 14px; margin-top: 5px;">
        Please click "Connect Wallet" to try again
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        margin-top: 10px;
        cursor: pointer;
      ">OK</button>
    `;
    notification.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
  }
  
  // Auto-remove notification after 4 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 4000);
}

// 🔧 NEW: Handle wallet disconnect
function handleWalletDisconnect() {
  console.log('👤 Wallet disconnected');
  
  // Clear all state
  state.address = null;
  state.wallet = null;
  state.status = { gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } };
  state.checkpoint = null;
  
  // Stop mining
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
    state.goldUpdateInterval = null;
  }
  
  // Clear localStorage
  localStorage.removeItem('gm_address');
  
  // Reset UI
  updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
  
  const connectBtn = $('#connectBtn');
  if (connectBtn) {
    connectBtn.textContent = 'Connect Wallet';
    connectBtn.disabled = false;
  }
}

// Connect wallet - simplified version
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
    
    // Check if this is a different wallet than before
    const previousAddress = state.address;
    if (previousAddress && previousAddress !== address) {
      console.log(`🔄 Wallet switched from ${previousAddress.slice(0, 8)}... to ${address.slice(0, 8)}...`);
      
      // Clear any existing popups
      const existingModal = document.getElementById('mandatoryLandModal');
      if (existingModal) {
        existingModal.remove();
      }
      
      // Clear existing timers
      if (window.landCheckTimeout) {
        clearTimeout(window.landCheckTimeout);
        window.landCheckTimeout = null;
      }
      
      // Stop existing mining and polling
      stopMining();
      stopStatusPolling();
    }
    
    state.wallet = provider;
    state.address = address;
    localStorage.setItem('gm_address', address);
    
    console.log('✅ Wallet connected:', address.slice(0, 8) + '...');
    
    // Update balance first
    await updateWalletBalance();
    
    // Update connect button to show wallet info
    updateConnectButtonDisplay();
    
    // ⚡ FIXED: Load user status and update display properly
    console.log('📊 Loading initial user data from database...');
    const userData = await loadInitialUserData();
    
    if (userData) {
      console.log('✅ User data loaded:', userData);
      
      // Initialize mining with checkpoint system
      console.log('⚡ Initializing mining with loaded data...');
      
      // CRITICAL: Update the display with loaded data
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
      
      console.log('🎉 User data displayed and mining engine ready!');
    } else {
      console.log('ℹ️ New user - starting with empty state');
      
      // Initialize empty state for new users
      const emptyState = {
        gold: 0,
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 }
      };
      
      // Initialize with empty state for new users
      console.log('⚡ Initializing new user with empty state...');
      updateDisplay(emptyState);
    }
    
    // Check land status immediately after wallet connection
    console.log('🔍 Checking land ownership immediately after wallet connection...');
    await checkLandStatusAndShowPopup();
    
  } catch (e) {
    console.error('❌ Wallet connection failed:', e);
    alert('Failed to connect wallet: ' + e.message);
  }
}

async function updateWalletBalance() {
  if (!state.wallet || !state.address) {
    return;
  }
  
  try {
    const publicKey = new solanaWeb3.PublicKey(state.address);
    const balance = await state.connection.getBalance(publicKey);
    const solBalance = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3);
    state.solBalance = solBalance;
    
    // Update the connect button with wallet info
    updateConnectButtonDisplay();
    
  } catch (e) {
    console.error('Failed to fetch balance:', e);
    state.solBalance = 'Error';
    updateConnectButtonDisplay();
  }
}

function updateConnectButtonDisplay() {
  const connectBtn = $('#connectBtn');
  if (!connectBtn) return;
  
  if (state.address && state.solBalance !== undefined) {
    // Show wallet address and balance in button
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
    // Default state
    connectBtn.textContent = '🔗 Connect Wallet';
    connectBtn.style.background = 'linear-gradient(45deg, var(--primary), #00b894)';
    connectBtn.style.padding = '6px 12px';
    connectBtn.style.fontSize = '11px';
  }
}

async function refreshStatus(afterPurchase = false) {
  if (!state.address) {
    console.log('⏭️ Skipping status refresh - no wallet connected');
    return;
  }
  
  try {
    console.log('📊 Refreshing status for:', state.address.slice(0, 8) + '...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Add header to force refresh if after purchase
    const headers = afterPurchase ? { 'x-last-purchase': Date.now().toString() } : {};
    
    const r = await fetch(`/api/status?address=${encodeURIComponent(state.address)}`, {
      signal: controller.signal,
      headers: headers
    });
    clearTimeout(timeoutId);
    
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
    console.log('📊 Checkpoint data:', state.checkpoint);
    
    // Ensure we always call updateDisplay with the loaded data
    console.log('🔄 Forcing display update with loaded data...');
    updateDisplay(json);
    
    // Also update mining display if checkpoint exists
    if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
      console.log('⛏️ Found existing mining power, starting mining...');
      startCheckpointGoldLoop(); // Use existing function instead of missing one
    } else {
      console.log('ℹ️ No mining power found on refresh');
    }
    
    console.log('✅ Status updated successfully');
    
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error('❌ Status refresh timed out after 10 seconds');
    } else {
      console.error('❌ Status refresh failed:', e.message);
    }
    
    // Stop polling if there are repeated failures
    if (state.consecutiveErrors >= 3) {
      console.warn('🛑 Stopping status polling due to repeated failures');
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }
    state.consecutiveErrors = (state.consecutiveErrors || 0) + 1;
  }
}

function updateDisplay(data) {
  console.log('🔄 updateDisplay called with data:', data);
  
  const serverGold = data.gold || 0;
  const serverInventory = data.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  
  console.log('🔄 Processed gold:', serverGold);
  console.log('🔄 Processed inventory:', serverInventory);
  
  // Update gold display with proper formatting
  const totalGoldEl = $('#totalGold');
  if (totalGoldEl) {
    // Ensure gold is a valid number for proper formatting
    const safeGold = parseFloat(serverGold) || 0;
    totalGoldEl.textContent = safeGold.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    console.log('✅ Gold display updated to:', totalGoldEl.textContent, 'from value:', safeGold);
  } else {
    console.error('❌ #totalGold element not found!');
  }
  
  // Update inventory
  const totalPickaxes = Object.values(serverInventory).reduce((sum, count) => sum + count, 0);
  console.log('📊 Calculated totalPickaxes:', totalPickaxes, 'from inventory:', serverInventory);
  
  const totalPickaxesEl = $('#totalPickaxes');
  if (totalPickaxesEl) {
    totalPickaxesEl.textContent = totalPickaxes.toLocaleString();
    console.log('✅ Updated totalPickaxes display to:', totalPickaxes);
  } else {
    console.error('❌ #totalPickaxes element not found!');
  }
  
  // Update mining rate (simple calculation)
  let totalRate = 0;
  totalRate += (serverInventory.silver || 0) * 1;
  totalRate += (serverInventory.gold || 0) * 10;
  totalRate += (serverInventory.diamond || 0) * 100;
  totalRate += (serverInventory.netherite || 0) * 10000;
  
  console.log('📊 Calculated mining rate:', totalRate, '/min from inventory breakdown:',
    'Silver:', (serverInventory.silver || 0), '* 1 =', (serverInventory.silver || 0) * 1,
    'Gold:', (serverInventory.gold || 0), '* 10 =', (serverInventory.gold || 0) * 10,
    'Diamond:', (serverInventory.diamond || 0), '* 100 =', (serverInventory.diamond || 0) * 100,
    'Netherite:', (serverInventory.netherite || 0), '* 10000 =', (serverInventory.netherite || 0) * 10000);
  
  const miningRateEl = $('#miningRate');
  if (miningRateEl) {
    miningRateEl.textContent = totalRate.toLocaleString() + '/min';
    console.log('✅ Updated miningRate display to:', totalRate + '/min');
  } else {
    console.error('❌ #miningRate element not found!');
  }
  
  const currentMiningRateEl = $('#currentMiningRate');
  if (currentMiningRateEl) {
    currentMiningRateEl.textContent = `+${totalRate.toLocaleString()} gold/min`;
    console.log('✅ Updated currentMiningRate display to:', `+${totalRate} gold/min`);
  } else {
    console.error('❌ #currentMiningRate element not found!');
  }
  
  // Update owned pickaxes in shop
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
  
  // Update mining status
  const miningStatusEl = $('#miningStatus');
  if (miningStatusEl) {
    if (totalPickaxes > 0) {
      const statusText = `Total mining power with ${totalPickaxes} pickaxe${totalPickaxes === 1 ? '' : 's'}`;
      miningStatusEl.textContent = statusText;
      miningStatusEl.style.color = 'var(--text-secondary)';
      console.log('✅ Updated miningStatus to:', statusText);
    } else {
      miningStatusEl.textContent = '💤 Buy pickaxes to start mining!';
      miningStatusEl.style.color = 'var(--text-secondary)';
      console.log('✅ Updated miningStatus to: Buy pickaxes message');
    }
  } else {
    console.error('❌ #miningStatus element not found!');
  }
  
  // Update pickaxe inventory grid
  console.log('📦 Updating pickaxe inventory grid with:', serverInventory);
  ['silver', 'gold', 'diamond', 'netherite'].forEach(type => {
    const countEl = $(`#${type}-count`);
    const itemEl = $(`.inventory-item[data-type="${type}"]`);
    const count = serverInventory[type] || 0;
    
    console.log(`🔧 Updating ${type}: count=${count}, countEl=${!!countEl}, itemEl=${!!itemEl}`);
    
    if (countEl) {
      countEl.textContent = count;
      console.log(`✅ Set ${type} count to: ${count}`);
    } else {
      console.error(`❌ #${type}-count element not found!`);
    }
    
    if (itemEl) {
      itemEl.setAttribute('data-count', count);
      if (count > 0) {
        itemEl.style.opacity = '1';
        console.log(`✅ Made ${type} visible (opacity: 1)`);
      } else {
        itemEl.style.opacity = '0.3';
        console.log(`⚫ Made ${type} faded (opacity: 0.3)`);
      }
    } else {
      console.error(`❌ .inventory-item[data-type="${type}"] element not found!`);
    }
  });
}

function startStatusPolling() {
  // 🚀 OPTIMIZATION: No more continuous polling!
  // We now use client-side calculations with the optimized mining engine
  // This eliminates 99% of database requests while providing real-time updates
  
  console.log('⚡ Using optimized client-side mining - no status polling needed!');
  console.log('🎯 Real-time updates without server calls every 5 seconds');
  
  // The optimized mining engine handles all UI updates locally
  // Database is only called when:
  // 1. User connects wallet (load checkpoint)
  // 2. User buys pickaxe (save new checkpoint) 
  // 3. User refreshes page (restore checkpoint)
  
  return; // No polling needed anymore!
}

function stopStatusPolling() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isPolling = false;
    console.log('🛑 Status polling stopped');
  }
}

// Load initial user data ONCE from database (replaces continuous polling)
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
    
    // Return the checkpoint data needed for the mining engine
    console.log('🔄 Processing user data for mining engine:', userData);
    
    const checkpointData = {
      last_checkpoint_gold: userData.gold || 0,
      inventory: userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
      total_mining_power: userData.checkpoint?.total_mining_power || 0,
      checkpoint_timestamp: userData.checkpoint?.checkpoint_timestamp || Math.floor(Date.now() / 1000)
    };
    
    console.log('📊 Checkpoint data for engine:', checkpointData);
    console.log('🎯 Inventory being passed:', checkpointData.inventory);
    
    return checkpointData;
    
  } catch (error) {
    console.error('❌ Failed to load user data:', error.message);
    return null; // Will use default values
  }
}

// Start checkpoint-based gold calculation loop
function startCheckpointGoldLoop() {
  // Clear existing loop if any
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
  }
  
  console.log('🚀 Starting checkpoint gold loop with state:', {
    hasCheckpoint: !!state.checkpoint,
    checkpoint: state.checkpoint
  });
  
  // Update display every second using checkpoint calculation
  state.goldUpdateInterval = setInterval(() => {
    if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
      // Calculate current gold from checkpoint
      const currentGold = calculateGoldFromCheckpoint(state.checkpoint);
      
      // Always update display with proper formatting
      const totalGoldEl = $('#totalGold');
      if (totalGoldEl) {
        const safeGold = parseFloat(currentGold) || 0;
        totalGoldEl.textContent = safeGold.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
        console.log('💰 Updated gold display to:', safeGold.toFixed(2));
      } else {
        console.error('❌ #totalGold element not found!');
      }
      
      // Update state
      state.status.gold = currentGold;
      
      // Update mining rate display
      const miningRateEl = $('#currentMiningRate');
      if (miningRateEl) {
        const miningPower = state.checkpoint.total_mining_power || 0;
        if (miningPower > 0) {
          miningRateEl.textContent = `+${miningPower.toLocaleString()} gold/min`;
        } else {
          miningRateEl.textContent = `+0 gold/min`;
        }
      }
      
      console.log('⏰ Mining tick - Gold:', currentGold.toFixed(2), 'Power:', state.checkpoint.total_mining_power || 0);
    } else {
      console.log('⚠️ Mining loop running but no checkpoint or mining power:', {
        hasCheckpoint: !!state.checkpoint,
        miningPower: state.checkpoint?.total_mining_power || 0
      });
    }
  }, 1000); // Update every second
  
  console.log('⏰ Checkpoint gold loop started with interval ID:', state.goldUpdateInterval);
}

// Calculate current gold from checkpoint data (pure math, no server calls)
function calculateGoldFromCheckpoint(checkpoint) {
  if (!checkpoint || !checkpoint.total_mining_power) {
    return parseFloat(checkpoint?.last_checkpoint_gold) || 0;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const checkpointTime = parseInt(checkpoint.checkpoint_timestamp, 10); // Convert string to number
  const timeSinceCheckpoint = currentTime - checkpointTime;
  const goldPerSecond = parseFloat(checkpoint.total_mining_power) / 60; // Convert per minute to per second
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  const baseGold = parseFloat(checkpoint.last_checkpoint_gold) || 0;
  
  const totalGold = baseGold + goldMined;
  
  // Debug logging to see what's happening
  console.log('⛏️ Mining calculation:', {
    miningPower: checkpoint.total_mining_power,
    checkpointTime: checkpointTime,
    currentTime: currentTime,
    timeSinceCheckpoint: timeSinceCheckpoint,
    goldPerSecond: goldPerSecond,
    goldMined: goldMined,
    baseGold: baseGold,
    totalGold: totalGold
  });
  
  return totalGold;
}

// Sync mining progress to server (prevents data loss on refresh)
async function syncMiningProgress() {
  if (!state.miningEngine || !state.address) return;
  
  try {
    const currentState = state.miningEngine.getState();
    console.log('🔄 Syncing mining progress to server...', currentState.gold);
    
    const response = await fetch('/sync-mining-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        gold: currentState.gold,
        inventory: currentState.inventory || state.status.inventory,
        lastUpdate: Math.floor(Date.now() / 1000),
        totalRate: currentState.totalRatePerMinute
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error('❌ Sync failed:', data.error);
      return;
    }
    
    // Update with server's corrected values if any
    if (data.correctedGold !== undefined) {
      console.log('🔧 Server corrected gold:', data.correctedGold);
      state.miningEngine.gold = data.correctedGold;
      state.status.gold = data.correctedGold;
    }
    
    console.log('✅ Mining progress synced successfully');
    
  } catch (e) {
    console.error('❌ Failed to sync mining progress:', e);
  }
}

// Stop mining (useful for cleanup)
function stopMining() {
  if (state.miningEngine) {
    state.miningEngine.stopMining();
    state.miningEngine = null;
  }
  
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
    state.goldUpdateInterval = null;
  }
  
  console.log('🛑 Mining stopped');
}

async function buyPickaxe(pickaxeType) {
  // Debug wallet connection state
  console.log('🔍 Wallet state check:', {
    address: state.address,
    wallet: !!state.wallet,
    hasAddress: !!state.address,
    addressLength: state.address?.length
  });
  
  if (!state.address) {
    console.log('❌ Wallet not connected - showing error');
    $('#shopMsg').textContent = 'Please connect your wallet first!';
    $('#shopMsg').className = 'msg error';
    return;
  } else {
    console.log('✅ Wallet connected - proceeding with purchase');
  }
  
  // Check if user has land - but don't be overly aggressive
  try {
    // First check if we already verified land in this session
    const landVerifiedKey = `landVerified_${state.address}`;
    if (sessionStorage.getItem(landVerifiedKey) === 'true') {
      console.log('✅ Land already verified in this session - proceeding with pickaxe purchase');
    } else {
      // Check database for land ownership
      const landResponse = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
      
      if (!landResponse.ok) {
        console.warn(`⚠️ Land verification API error: ${landResponse.status} - proceeding anyway`);
        // Don't block on API failure for pickaxe purchases
      } else {
        const landData = await landResponse.json();
        console.log('🔍 Pickaxe purchase land check:', landData);
        
        if (!landData.hasLand) {
          console.log('🚨 BLOCKING pickaxe purchase - no land ownership detected');
          $('#shopMsg').textContent = '🏠 You need to purchase land first before buying pickaxes!';
          $('#shopMsg').className = 'msg error';
          showLandModal();
          return;
        } else {
          console.log('✅ Land verification passed - caching for session');
          // Cache successful land verification
          sessionStorage.setItem(landVerifiedKey, 'true');
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Land verification failed, but allowing pickaxe purchase:', e.message);
    // Don't block pickaxe purchases on verification errors
  }
  
  const quantity = parseInt($(`#qty-${pickaxeType}`).value) || 1;
  
  try {
    $('#shopMsg').textContent = 'Processing purchase...';
    $('#shopMsg').className = 'msg';
    
    // Build transaction
    const r1 = await fetch('/api/purchase-tx', {
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

    // Confirm with detailed logging  
    console.log('🚀 Starting purchase confirmation...', { 
      address: state.address.slice(0, 8), 
      pickaxeType, 
      quantity, 
      signature: sig.signature.slice(0, 8) 
    });
    
    const r2 = await fetch('/api/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity, signature: sig.signature }),
    });
    
    console.log('📊 Purchase confirmation response:', {
      status: r2.status,
      statusText: r2.statusText,
      ok: r2.ok,
      headers: Object.fromEntries(r2.headers.entries())
    });
    
    if (!r2.ok) {
      const errorText = await r2.text();
      console.error('❌ Purchase confirmation failed:', errorText);
      throw new Error(`Purchase confirmation failed: ${errorText}`);
    }
    
    const responseText = await r2.text();
    console.log('📄 Raw response:', responseText.substring(0, 200) + '...');
    
    let j2;
    try {
      j2 = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('❌ Response text:', responseText);
      throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
    }
    
    if (j2.error) throw new Error(j2.error);

    $('#shopMsg').textContent = `✅ Successfully purchased ${quantity}x ${pickaxeType} pickaxe!`;
    $('#shopMsg').className = 'msg success';
    
    console.log('🔄 Processing purchase response:', j2);
    
    // ⚡ ULTRA-FAST: Optimistic UI update BEFORE transaction completes
    console.log('⚡ Optimistic UI update - showing pickaxe immediately...');
    
    // Predict new inventory
    const predictedInventory = { ...state.status.inventory };
    predictedInventory[pickaxeType] = (predictedInventory[pickaxeType] || 0) + quantity;
    
    // Update UI immediately (optimistic)
    state.status.inventory = predictedInventory;
    updateDisplay({
      gold: state.status.gold,
      inventory: predictedInventory,
      checkpoint: state.checkpoint
    });
    console.log('🚀 UI updated INSTANTLY (optimistic)');
    
    // 🔧 VERIFY: Confirm with server response
    if (j2.inventory) {
      // Server confirms - update with actual values
      state.status.inventory = j2.inventory;
      updateDisplay({
        gold: state.status.gold,
        inventory: j2.inventory,
        checkpoint: j2.checkpoint
      });
      console.log('✅ Confirmed with server data:', j2.inventory);
    }
    
    // 2. UPDATE CHECKPOINT: Update local checkpoint for mining calculations
    if (j2.checkpoint) {
      state.checkpoint = {
        total_mining_power: j2.checkpoint.total_mining_power || j2.totalRate,
        checkpoint_timestamp: j2.checkpoint.checkpoint_timestamp || Math.floor(Date.now() / 1000),
        last_checkpoint_gold: j2.checkpoint.last_checkpoint_gold || j2.gold || state.status.gold
      };
      console.log('⚡ Updated checkpoint for mining:', state.checkpoint);
      
      // Start mining if we have mining power
      if (state.checkpoint.total_mining_power > 0) {
        startCheckpointGoldLoop();
      }
    }
    
    // 3. FINAL DISPLAY UPDATE: Ensure UI shows the purchase
    setTimeout(() => {
      console.log('🔄 Final UI update after purchase...');
      updateDisplay({
        gold: state.status.gold,
        inventory: state.status.inventory,
        checkpoint: state.checkpoint
      });
      console.log('✅ Purchase UI update complete!');
    }, 500);
    
    // Update wallet balance 
    await updateWalletBalance();
    
    console.log('🎉 Purchase complete! Mining engine handles everything locally now.')
    
  } catch (e) {
    console.error(e);
    $('#shopMsg').textContent = '❌ Purchase failed: ' + e.message;
    $('#shopMsg').className = 'msg error';
  }
}

async function sellGold() {
  const sellMsgElement = document.getElementById('sellMsg');
  const sellAmountElement = document.getElementById('sellAmount');
  
  if (!state.address) {
    if (sellMsgElement) {
      sellMsgElement.textContent = 'Please connect your wallet first!';
      sellMsgElement.className = 'msg error';
    }
    return;
  }
  
  const amountGold = parseFloat(sellAmountElement?.value || '0');
  if (!isFinite(amountGold) || amountGold <= 0) {
    if (sellMsgElement) {
      sellMsgElement.textContent = 'Please enter a valid gold amount!';
      sellMsgElement.className = 'msg error';
    }
    return;
  }
  
  // First, refresh status to get latest gold amount
  try {
    if (sellMsgElement) {
      sellMsgElement.textContent = '🔍 Checking your gold balance...';
      sellMsgElement.className = 'msg';
    }
    await refreshStatus(); // Get latest gold
    updateGoldDisplay();
  } catch (e) {
    console.error('Failed to refresh status:', e);
    if (sellMsgElement) {
      sellMsgElement.textContent = 'Failed to check your status. Please try again.';
      sellMsgElement.className = 'msg error';
    }
    return;
  }
  
  try {
    if (sellMsgElement) {
      sellMsgElement.textContent = `💰 Selling ${amountGold.toLocaleString()} gold for SOL...`;
      sellMsgElement.className = 'msg';
    }
    
    const response = await fetch('/api/sell-working-final', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, amountGold }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sell failed - Status:', response.status, 'Response:', errorText);
      throw new Error(`Sell failed: ${response.status} - ${errorText.slice(0, 100)}`);
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const responseText = await response.text();
      console.error('JSON Parse Error:', parseError, 'Response:', responseText);
      throw new Error(`Invalid server response. Please try again.`);
    }
    
    if (data.error) throw new Error(data.error);
    
    // Handle successful sale
    if (sellMsgElement) {
      if (data.mode === 'pending') {
        sellMsgElement.textContent = `✅ Sale recorded! Pending payout of ${data.payoutSol} SOL`;
        sellMsgElement.className = 'msg success';
      } else if (data.signature) {
        sellMsgElement.textContent = `✅ Sale complete! Received ${data.payoutSol} SOL (Tx: ${data.signature.slice(0, 8)}...)`;
        sellMsgElement.className = 'msg success';
      } else {
        sellMsgElement.textContent = `✅ ${data.message || 'Sale successful!'}`;
        sellMsgElement.className = 'msg success';
      }
    }
    
    // Update local state
    if (data.newGold !== undefined) {
      state.status.gold = parseFloat(data.newGold);
      updateGoldDisplay();
    }
    
    // Clear input
    if (sellAmountElement) {
      sellAmountElement.value = '';
    }
    
    console.log(`✅ Sold ${amountGold} gold for ${data.payoutSol} SOL`);
    
    // Refresh status and wallet balance
    await refreshStatus();
    if (typeof updateWalletBalance === 'function') {
      await updateWalletBalance();
    }
    
  } catch (e) {
    console.error('Sell gold failed:', e);
    if (sellMsgElement) {
      sellMsgElement.textContent = `❌ Sale failed: ${e.message}`;
      sellMsgElement.className = 'msg error';
    }
  }
}

// Helper function for store messages
function showStoreMessage(message, type = 'info') {
  const storeMsg = document.getElementById('storeMsg');
  if (storeMsg) {
    storeMsg.textContent = message;
    storeMsg.className = `store-message ${type}`;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        storeMsg.textContent = '';
        storeMsg.className = 'store-message';
      }, 3000);
    }
  }
}

// Helper functions for UI updates
function updateGoldDisplay() {
  const goldElement = document.getElementById('totalGold');
  if (goldElement && state.status?.gold !== undefined) {
    goldElement.textContent = Math.floor(state.status.gold).toLocaleString();
    console.log('💰 Updated gold display:', Math.floor(state.status.gold).toLocaleString());
  }
}

function updateInventoryDisplay() {
  if (!state.status?.inventory) return;
  
  const inventory = state.status.inventory;
  Object.keys(inventory).forEach(pickaxeType => {
    const countElement = document.querySelector(`[data-pickaxe="${pickaxeType}"] .pickaxe-count`);
    if (countElement) {
      countElement.textContent = inventory[pickaxeType] || 0;
    }
  });
}

function updateMiningPowerDisplay() {
  const powerElement = document.querySelector('.total-mining-power');
  if (powerElement && state.status?.total_mining_power !== undefined) {
    powerElement.textContent = `${state.status.total_mining_power.toFixed(2)} gold/min`;
  }
}

// Buy pickaxe with gold (for store section)
async function buyPickaxeWithGold(pickaxeType, goldCost) {
  if (!state.address) {
    showStoreMessage('Please connect your wallet first!', 'error');
    return;
  }
  
  // First, fetch the latest status to get current gold amount
  showStoreMessage('🔍 Checking your gold balance...', 'loading');
  try {
    await refreshStatus(); // Refresh status to get latest gold
    updateGoldDisplay(); // Update the gold display immediately
  } catch (e) {
    console.error('Failed to refresh status:', e);
    showStoreMessage('Failed to check your status. Please try again.', 'error');
    return;
  }
  
  // Check if user has land before allowing pickaxe purchase
  try {
    const landResponse = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
    const landData = await landResponse.json();
    
    if (!landData.hasLand) {
      showStoreMessage('🏠 You need to purchase land first before buying pickaxes!', 'error');
      showMandatoryLandPurchaseModal();
      return;
    }
  } catch (e) {
    console.error('Failed to check land status:', e);
    showStoreMessage('Failed to verify land ownership. Please try again.', 'error');
    return;
  }
  
  // Check if user has enough gold (after fetching latest status)
  const currentGold = state.status?.gold || 0;
  console.log(`💰 Current gold balance: ${currentGold}, Required: ${goldCost}`);
  
  if (currentGold < goldCost) {
    showStoreMessage(`❌ Not enough gold! You need ${goldCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()} gold.`, 'error');
    return;
  }
  
  try {
    showStoreMessage(`🛒 Buying ${pickaxeType} pickaxe for ${goldCost.toLocaleString()} gold...`, 'loading');
    
    const response = await fetch('/api/buy-with-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address, 
        pickaxeType: pickaxeType,
        goldCost: goldCost
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Purchase failed - Status:', response.status, 'Response:', errorText);
      throw new Error(`Purchase failed: ${response.status} - ${errorText.slice(0, 100)}`);
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const responseText = await response.text();
      console.error('JSON Parse Error:', parseError, 'Response:', responseText);
      throw new Error(`Invalid server response. Please try again.`);
    }
    
    if (data.error) throw new Error(data.error);
    
    showStoreMessage(`✅ Successfully bought ${pickaxeType} pickaxe for ${goldCost.toLocaleString()} gold!`, 'success');
    
    // Update local state with server response
    if (data.checkpoint) {
      state.status.gold = data.newGold;
      state.status.inventory = data.inventory;
      state.status.total_mining_power = data.checkpoint.total_mining_power;
      state.status.checkpoint_timestamp = data.checkpoint.checkpoint_timestamp;
      state.status.last_checkpoint_gold = data.checkpoint.last_checkpoint_gold;
    }
    
    // Update UI immediately
    updateGoldDisplay();
    updateInventoryDisplay();
    updateMiningPowerDisplay();
    
    console.log(`✅ Purchased ${pickaxeType} pickaxe - New gold: ${data.newGold}, Inventory:`, data.inventory);
    if (data.checkpoint) {
      state.checkpoint = data.checkpoint;
      console.log('📊 Updated checkpoint after gold purchase:', state.checkpoint);
    }
    
    // Refresh status to show updated gold and inventory
    await refreshStatus();
    
  } catch (e) {
    console.error('Buy with gold failed:', e);
    showStoreMessage(`❌ Purchase failed: ${e.message}`, 'error');
  }
}

// Check land status and show popup for users without land
async function checkLandStatusAndShowPopup() {
  if (!state.address) return;
  
  try {
    console.log('🔍 Checking land status for:', state.address.slice(0, 8) + '...');
    
    const response = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
    
    if (!response.ok) {
      console.error(`❌ Land status API error: ${response.status}`);
      showLandModal();
      return;
    }
    
    const data = await response.json();
    console.log('🏠 Land status response:', data);
    
    if (!data.hasLand) {
      console.log('🏠 User has no land, showing land purchase modal');
      showLandModal();
    } else {
      console.log('✅ User has land, can proceed with game');
      hideLandModal();
      
      // Mark as verified for this wallet in this session
      const landVerifiedKey = `landVerified_${state.address}`;
      sessionStorage.setItem(landVerifiedKey, 'true');
    }
  } catch (e) {
    console.error('❌ Failed to check land status:', e);
    showLandModal();
  }
}

// Show the land modal using the existing HTML modal
function showLandModal() {
  const landModal = document.getElementById('landModal');
  if (landModal) {
    landModal.style.display = 'flex';
    landModal.classList.add('show');
    console.log('🏠 Showing land modal');
  } else {
    console.error('❌ Land modal not found in HTML');
  }
}

// Hide the land modal
function hideLandModal() {
  const landModal = document.getElementById('landModal');
  if (landModal) {
    landModal.style.display = 'none';
    landModal.classList.remove('show');
    console.log('🏠 Hiding land modal');
  }
}

// Purchase land using the HTML modal button
async function purchaseLand() {
  if (!state.address) {
    showLandMessage('Please connect your wallet first!', 'error');
    return;
  }
  
  try {
    showLandMessage('Creating land purchase transaction...', 'info');
    
    // Create land purchase transaction
    const response = await fetch('/api/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    showLandMessage('Please sign the transaction in your wallet...', 'info');
    
    // Sign and send transaction
    const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);
    
    const sig = await state.wallet.signAndSendTransaction(tx);
    showLandMessage(`Transaction submitted: ${sig.signature.slice(0, 8)}...`, 'info');
    
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
    
    // Mark as verified IMMEDIATELY
    const landVerifiedKey = `landVerified_${state.address}`;
    sessionStorage.setItem(landVerifiedKey, 'true');
    
    // Show success message
    showLandMessage('✅ Land purchased successfully!', 'success');
    
    // 🚀 AGGRESSIVE MODAL CLOSING - Multiple attempts for reliability
    console.log('🚪 FORCE CLOSING ALL MODALS IMMEDIATELY after successful land purchase...');
    
    // Attempt 1: Close HTML modal immediately
    try {
      hideLandModal();
      console.log('✅ Attempt 1: HTML modal hidden');
    } catch (e) {
      console.error('❌ Attempt 1 failed:', e);
    }
    
    // Attempt 2: Close mandatory modal immediately
    try {
      const mandatoryModal = document.getElementById('mandatoryLandModal');
      if (mandatoryModal) {
        mandatoryModal.remove();
        console.log('✅ Attempt 2: Mandatory modal removed');
      }
    } catch (e) {
      console.error('❌ Attempt 2 failed:', e);
    }
    
    // Attempt 3: Force close after 200ms
    setTimeout(() => {
      try {
        console.log('🚪 Attempt 3: Force closing after 200ms...');
        
        const htmlModal = document.getElementById('landModal');
        if (htmlModal) {
          htmlModal.style.display = 'none';
          htmlModal.remove();
          console.log('✅ Attempt 3: HTML modal force removed');
        }
        
        const mandatoryModal = document.getElementById('mandatoryLandModal');
        if (mandatoryModal) {
          mandatoryModal.remove();
          console.log('✅ Attempt 3: Mandatory modal force removed');
        }
        
        // Clear all land messages
        const landMsg = document.getElementById('landMsg');
        if (landMsg) {
          landMsg.style.display = 'none';
        }
        
        const mandatoryLandMsg = document.getElementById('mandatoryLandMsg');
        if (mandatoryLandMsg) {
          mandatoryLandMsg.style.display = 'none';
        }
        
        console.log('✅ Land purchase confirmed - enabling gameplay');
        
      } catch (e) {
        console.error('❌ Attempt 3 failed:', e);
      }
    }, 200);
    
    // Attempt 4: Final cleanup after 1 second
    setTimeout(() => {
      try {
        console.log('🚪 Attempt 4: Final cleanup after 1s...');
        
        // Remove any remaining modals
        document.querySelectorAll('#landModal, #mandatoryLandModal').forEach(modal => {
          modal.remove();
          console.log('✅ Attempt 4: Cleaned up modal');
        });
        
        console.log('🎮 Game functionality enabled - user can now buy pickaxes');
        
      } catch (e) {
        console.error('❌ Attempt 4 failed:', e);
      }
    }, 1000);
    
    // Refresh status to update land ownership
    await refreshStatus();
    await updateWalletBalance();
    
  } catch (e) {
    console.error('❌ Land purchase failed:', e);
    showLandMessage('❌ Purchase failed: ' + e.message, 'error');
  }
}

// Show message in land modal
function showLandMessage(message, type) {
  console.log(`🏠 Land message: ${message} (${type})`);
  
  // Try multiple possible message elements
  let landMsg = document.getElementById('landMsg');
  if (!landMsg) {
    landMsg = document.getElementById('mandatoryLandMsg');
  }
  
  if (landMsg) {
    landMsg.textContent = message;
    landMsg.className = `msg ${type}`;
    landMsg.style.display = 'block';
    
    // Style based on message type
    if (type === 'success') {
      landMsg.style.background = 'linear-gradient(45deg, #00ff88, #00cc6a)';
      landMsg.style.color = 'white';
    } else if (type === 'error') {
      landMsg.style.background = 'linear-gradient(45deg, #ff6b6b, #ff4757)';
      landMsg.style.color = 'white';
    } else {
      landMsg.style.background = 'linear-gradient(45deg, #3498db, #2980b9)';
      landMsg.style.color = 'white';
    }
    
    console.log('✅ Land message displayed successfully');
  } else {
    console.error('❌ Land message element not found!');
    // Fallback to alert for critical messages
    if (type === 'error') {
      alert('Error: ' + message);
    }
  }
}

// Legacy function for compatibility
async function checkLandStatus() {
  return await checkLandStatusAndShowPopup();
}

// Show mandatory land purchase modal (cannot be closed)
function showMandatoryLandPurchaseModal() {
  // Remove any existing modal first
  const existingModal = document.getElementById('mandatoryLandModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  createMandatoryLandPurchaseModal();
}

// Legacy function for compatibility
function showLandPurchaseModal() {
  showMandatoryLandPurchaseModal();
}

// Create working land purchase modal using DOM methods
function createMandatoryLandPurchaseModal() {
  // Create modal container
  const modal = document.createElement('div');
  modal.id = 'mandatoryLandModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.95);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(10px);
  `;

  // Create content container
  const content = document.createElement('div');
  content.style.cssText = `
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    border: 2px solid #00ff88;
    color: white;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(45deg, #00ff88, #00cc6a);
    padding: 30px 25px;
    border-radius: 18px 18px 0 0;
    text-align: center;
  `;

  const title = document.createElement('h2');
  title.textContent = '👑 Gold Mining Empire';
  title.style.cssText = `
    margin: 0 0 10px 0;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Land purchase required to start';
  subtitle.style.cssText = `
    margin: 0;
    opacity: 0.9;
    font-size: 14px;
  `;

  header.appendChild(title);
  header.appendChild(subtitle);

  // Create body
  const body = document.createElement('div');
  body.style.cssText = `padding: 30px;`;

  // Land image
  const landSection = document.createElement('div');
  landSection.style.cssText = `
    text-align: center;
    margin-bottom: 25px;
    padding: 25px;
    background: rgba(255,255,255,0.05);
    border-radius: 15px;
    border: 1px solid rgba(255,255,255,0.1);
  `;

  const landIcon = document.createElement('div');
  landIcon.textContent = '🏞️';
  landIcon.style.cssText = `
    font-size: 50px;
    margin-bottom: 15px;
  `;

  const landTitle = document.createElement('h3');
  landTitle.textContent = 'Premium Mining Land';
  landTitle.style.cssText = `
    margin: 0 0 15px 0;
    color: #00ff88;
    font-size: 20px;
  `;

  const priceInfo = document.createElement('div');
  priceInfo.textContent = '0.01 SOL - One time purchase';
  priceInfo.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    color: #FFD700;
    margin-bottom: 15px;
  `;

  landSection.appendChild(landIcon);
  landSection.appendChild(landTitle);
  landSection.appendChild(priceInfo);

  // Benefits
  const benefitsTitle = document.createElement('h4');
  benefitsTitle.textContent = '🎁 What you get:';
  benefitsTitle.style.cssText = `
    color: #00ff88;
    font-size: 18px;
    margin-bottom: 15px;
  `;

  const benefitsList = document.createElement('ul');
  benefitsList.style.cssText = `
    list-style: none;
    padding: 0;
    margin: 0 0 25px 0;
  `;

  const benefits = [
    '⛏️ Access to buy pickaxes',
    '💰 Start mining gold immediately', 
    '🏆 Permanent land ownership',
    '🎮 Full game access forever'
  ];

  benefits.forEach(benefit => {
    const li = document.createElement('li');
    li.textContent = benefit;
    li.style.cssText = `
      padding: 8px 0;
      font-size: 16px;
    `;
    benefitsList.appendChild(li);
  });

  // Warning
  const warning = document.createElement('div');
  warning.textContent = '🚨 Required to play the game!';
  warning.style.cssText = `
    background: linear-gradient(45deg, #ff6b6b, #ffa500);
    color: white;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    font-weight: bold;
    margin-bottom: 25px;
  `;

  // Purchase button
  const button = document.createElement('button');
  button.id = 'mandatoryLandPurchaseBtn';
  button.textContent = '🏠 Purchase Land (0.01 SOL)';
  button.style.cssText = `
    width: 100%;
    padding: 15px;
    font-size: 18px;
    font-weight: bold;
    border: none;
    border-radius: 12px;
    background: linear-gradient(45deg, #00ff88, #00cc6a);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 15px;
  `;

  button.addEventListener('click', async (e) => {
    console.log('🏠 Land purchase button clicked!');
    e.preventDefault();
    e.stopPropagation();
    
    // Disable button during transaction
    button.disabled = true;
    button.style.opacity = '0.6';
    button.textContent = '⏳ Processing...';
    
    try {
      await purchaseLand();
    } catch (error) {
      console.error('❌ Land purchase button error:', error);
      alert('Error: ' + error.message);
    } finally {
      // Re-enable button
      button.disabled = false;
      button.style.opacity = '1';
      button.textContent = '🏠 Purchase Land (0.01 SOL)';
    }
  });
  button.addEventListener('mouseover', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 8px 25px rgba(0,255,136,0.3)';
  });
  button.addEventListener('mouseout', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = 'none';
  });

  // Security note
  const security = document.createElement('div');
  security.textContent = '🔒 Secure payment via Phantom wallet';
  security.style.cssText = `
    text-align: center;
    font-size: 12px;
    color: rgba(255,255,255,0.7);
    margin-bottom: 15px;
  `;

  // Message area
  const messageArea = document.createElement('div');
  messageArea.id = 'mandatoryLandMsg';
  messageArea.style.cssText = `
    display: none;
    margin-top: 15px;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    font-weight: bold;
  `;

  // Assemble everything
  body.appendChild(landSection);
  body.appendChild(benefitsTitle);
  body.appendChild(benefitsList);
  body.appendChild(warning);
  body.appendChild(button);
  body.appendChild(security);
  body.appendChild(messageArea);

  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);

  document.body.appendChild(modal);

  // PREVENT ALL WAYS TO CLOSE THE MODAL UNTIL LAND IS PURCHASED
  modal.addEventListener('contextmenu', (e) => e.preventDefault());
  modal.addEventListener('click', (e) => e.stopPropagation());
  
  // Block ALL escape methods
  const blockEscape = (e) => {
    if (document.getElementById('mandatoryLandModal')) {
      if (e.key === 'Escape' || e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        console.log('🚨 Popup cannot be closed until land is purchased!');
        showMandatoryLandMessage('🔒 You must purchase land to continue playing!', 'error');
        return false;
      }
    }
  };
  
  document.addEventListener('keydown', blockEscape);
  
  // Prevent page refresh when popup is showing
  window.addEventListener('beforeunload', (e) => {
    if (document.getElementById('mandatoryLandModal')) {
      e.preventDefault();
      e.returnValue = 'You must purchase land before leaving. Your progress will be lost!';
      return e.returnValue;
    }
  });
}

// Create land purchase modal dynamically (legacy)
function createLandPurchaseModal() {
  const modalHTML = `
    <div id="landPurchaseModal" class="modal-overlay show" style="background: rgba(0,0,0,0.9); z-index: 10000;">
      <div class="modal-content" style="
        max-width: 500px; 
        margin: 5% auto; 
        background: var(--bg-secondary);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        border: 2px solid var(--primary);
        animation: modalSlideIn 0.3s ease-out;">
        <div class="modal-header" style="
          background: var(--gradient);
          color: white;
          padding: 25px;
          border-radius: 18px 18px 0 0;
          text-align: center;
          position: relative;">
          <h2 style="margin: 0; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏠 Welcome to Gold Mining!</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Land purchase required to start</p>
        </div>
        <div class="modal-body" style="padding: 30px;">
          <div class="land-info">
            <div style="text-align: center; margin-bottom: 25px;">
              <div style="
                background: var(--gradient);
                color: white;
                padding: 15px 25px;
                border-radius: 15px;
                display: inline-block;
                font-size: 18px;
                font-weight: bold;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
                🎯 STEP 1: Purchase Land
              </div>
            </div>
            
            <div class="land-cost" style="
              background: var(--bg-primary);
              padding: 20px;
              border-radius: 15px;
              border: 2px solid var(--primary);
              margin-bottom: 20px;
              text-align: center;">
              <div style="font-size: 16px; color: var(--text-secondary); margin-bottom: 10px;">Land Cost</div>
              <div style="font-size: 32px; font-weight: bold; color: var(--primary);">0.01 SOL</div>
              <div style="font-size: 14px; color: var(--text-secondary); margin-top: 5px;">≈ $2 USD (one-time purchase)</div>
            </div>
            
            <div class="land-benefits">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: var(--primary);">🎁 What you get:</div>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 8px 0; font-size: 16px;">⛏️ Access to buy pickaxes</li>
                <li style="padding: 8px 0; font-size: 16px;">💰 Start mining gold immediately</li>
                <li style="padding: 8px 0; font-size: 16px;">🏆 Permanent land ownership</li>
                <li style="padding: 8px 0; font-size: 16px;">🎮 Full game access forever</li>
              </ul>
            </div>
            
            <div style="
              background: linear-gradient(45deg, #ff6b6b, #ffa500);
              color: white;
              padding: 15px;
              border-radius: 10px;
              margin: 20px 0;
              text-align: center;
              font-weight: bold;
              animation: pulse 2s infinite;">
              🚨 Required to play the game!
            </div>
            
            <div id="landMsg" class="msg" style="display: none; margin-top: 15px;"></div>
          </div>
        </div>
        <div class="modal-footer" style="padding: 0 30px 30px 30px;">
          <button id="purchaseLandBtn" class="primary-btn" onclick="purchaseLand()" style="
            width: 100%;
            padding: 15px;
            font-size: 18px;
            font-weight: bold;
            border-radius: 12px;
            background: var(--gradient);
            border: none;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
            🏠 Purchase Land (0.01 SOL)
          </button>
          <div style="text-align: center; margin-top: 15px; font-size: 12px; color: var(--text-secondary);">
            Secure payment via Phantom wallet
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-50px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }
      
      #purchaseLandBtn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
      }
      
      #landPurchaseModal .modal-overlay {
        pointer-events: all !important;
      }
    </style>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Prevent closing by clicking outside
  const modal = document.getElementById('landPurchaseModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// Purchase land function (mandatory version)
async function purchaseMandatoryLand() {
  if (!state.address) {
    showMandatoryLandMessage('Please connect your wallet first!', 'error');
    return;
  }
  
  try {
    showMandatoryLandMessage('Creating land purchase transaction...', 'info');
    
    // Create transaction
    const response = await fetch('/api/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);

    // Sign and send
    showMandatoryLandMessage('Please sign the transaction in Phantom...', 'info');
    
    if (!state.wallet || !state.wallet.signAndSendTransaction) {
      throw new Error('Wallet not properly connected. Please reconnect your wallet.');
    }
    
    const sig = await state.wallet.signAndSendTransaction(tx);
    if (!sig || !sig.signature) {
      throw new Error('Transaction was not signed properly.');
    }
    
    showMandatoryLandMessage(`Transaction submitted: ${sig.signature.slice(0, 8)}...`, 'info');

    // Confirm
    const confirmResponse = await fetch('/api/confirm-land-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, signature: sig.signature }),
    });
    
    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text();
      throw new Error(`Confirmation failed: ${confirmResponse.status} - ${errorText}`);
    }
    
    const confirmData = await confirmResponse.json();
    if (confirmData.error) throw new Error(confirmData.error);

    showMandatoryLandMessage('🎉 Land purchased successfully! Welcome to the game!', 'success');
    
    // 🚀 IMMEDIATELY CLOSE MODAL after successful purchase
    console.log('✅ Land purchase confirmed - immediately closing modal');
    
    // Mark land as verified for this wallet FIRST
    const landVerifiedKey = `landVerified_${state.address}`;
    sessionStorage.setItem(landVerifiedKey, 'true');
    
    // Force close modal immediately - multiple attempts
    setTimeout(() => {
      console.log('🚪 Attempt 1: Direct modal removal...');
      const modal = document.getElementById('mandatoryLandModal');
      if (modal) {
        modal.remove();
        console.log('✅ Mandatory land modal removed successfully!');
      }
    }, 500);
    
    // Backup removal
    setTimeout(() => {
      console.log('🚪 Attempt 2: Cleanup any remaining modals...');
      document.querySelectorAll('#mandatoryLandModal, [id*="landModal"]').forEach(modal => {
        modal.remove();
        console.log('✅ Modal cleaned up');
      });
      
      // Clear any existing land check timers
      if (window.landCheckTimeout) {
        clearTimeout(window.landCheckTimeout);
        window.landCheckTimeout = null;
      }
      
      console.log('🎮 Game functionality enabled - user can now buy pickaxes');
    }, 1000);
    
    // Background status refresh
    setTimeout(async () => {
      await refreshStatus();
      await updateWalletBalance();
    }, 1500);
    
  } catch (e) {
    console.error('Mandatory land purchase failed:', e);
    let errorMessage = 'Land purchase failed';
    
    if (e.message.includes('User rejected')) {
      errorMessage = 'Transaction was rejected in wallet';
    } else if (e.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient SOL balance. You need at least 0.01 SOL.';
    } else if (e.message.includes('Network Error') || e.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (e.message.includes('already owns land')) {
      errorMessage = 'You already own land! Refreshing...';
      setTimeout(() => {
        closeMandatoryLandModal();
        refreshStatus();
      }, 2000);
    } else if (e.message) {
      errorMessage = e.message;
    }
    
    showMandatoryLandMessage(`❌ ${errorMessage}`, 'error');
  }
}

// Legacy purchase land function


// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 DOM loaded, initializing Gold Mining Game...');
  
  try {
    // Load game configuration and start
    await loadConfig();
    console.log('🎉 Game initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize game:', error);
  }
});


// Debug: Test if functions are accessible globally
window.testFunctions = function() {
  console.log('🔧 Testing function accessibility...');
  console.log('connectWallet exists:', typeof connectWallet);
  console.log('buyPickaxe exists:', typeof buyPickaxe);
  console.log('purchaseLand exists:', typeof purchaseLand);
  console.log('showHowItWorksModal exists:', typeof showHowItWorksModal);
};

// Debug: Simple click test
window.testClick = function() {
  console.log('🔧 Button click test - this should appear when any button is clicked');
  alert('Button click detected!');
};

console.log('🔧 Debug functions added - call testFunctions() in console to check');
console.log('🔧 All functions defined, checking global scope...');
console.log('🔧 window.connectWallet:', typeof window.connectWallet);
console.log('🔧 window.buyPickaxe:', typeof window.buyPickaxe);



// Missing function: showHowItWorksModal
function showHowItWorksModal() {
  console.log('📖 Showing How It Works modal...');
  const modal = document.getElementById('howItWorksModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.log('❌ How It Works modal not found in DOM');
  }
}

// Missing function: hideHowItWorksModal
function hideHowItWorksModal() {
  console.log('📖 Hiding How It Works modal...');
  const modal = document.getElementById('howItWorksModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Missing function: closeV2Modal
function closeV2Modal() {
  console.log('🎃 Closing V2 modal...');
  const modal = document.getElementById('v2ComingSoonModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ V2 modal closed');
  }
}

// Missing function: joinWaitlist
function joinWaitlist() {
  console.log('🔔 Joining V2 waitlist...');
  alert('Thank you for your interest! We\'ll notify you when V2.0 launches! 🎃');
}

console.log('🔧 Added missing modal functions');



// Fix: Explicitly bind functions to global window object
window.connectWallet = connectWallet;
window.buyPickaxe = buyPickaxe;
window.purchaseLand = purchaseLand;
window.showHowItWorksModal = showHowItWorksModal;
window.hideHowItWorksModal = hideHowItWorksModal;
window.closeV2Modal = closeV2Modal;
window.joinWaitlist = joinWaitlist;

// Fix: Add proper event listeners to override onclick issues
function bindEventListeners() {
  console.log('🔧 Binding event listeners...');
  
  // Connect Wallet button
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    connectBtn.onclick = null; // Clear existing onclick
    connectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔗 Connect Wallet button clicked via event listener');
      connectWallet();
    });
    console.log('✅ Connected connectBtn event listener');
  }
  
  // Refer button  
  const referBtn = document.getElementById('referBtn');
  if (referBtn) {
    referBtn.onclick = null;
    referBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🎁 Refer button clicked');
      showReferModal();
    });
    console.log('✅ Connected referBtn event listener');
  }
  
  // V2 button
  const v2Btn = document.getElementById('v2ComingSoonBtn');
  if (v2Btn) {
    v2Btn.onclick = null;
    v2Btn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🎃 V2 button clicked');
      showV2Modal();
    });
    console.log('✅ Connected v2Btn event listener');
  }
  
  console.log('🔧 Event listeners binding complete');
}

// Call binding after DOM is ready
setTimeout(bindEventListeners, 1000);

console.log('🔧 Global function binding added');



// Show Refer & Earn modal
function showReferModal() {
  console.log('🎁 Showing Refer & Earn modal...');
  const modal = document.getElementById('referralModal');
  if (modal) {
    modal.style.display = 'flex';
    console.log('✅ Referral modal displayed');
    
    // Generate referral link
    const currentUser = getCurrentWalletAddress();
    if (currentUser) {
      const referralLink = `${window.location.origin}?ref=${currentUser}`;
      const linkElement = document.getElementById('referralLink');
      if (linkElement) {
        linkElement.value = referralLink;
      }
    }
  } else {
    console.log('❌ Referral modal not found in DOM');
  }
}

// Show V2.0 modal  
function showV2Modal() {
  console.log('🎃 Showing V2.0 modal...');
  const modal = document.getElementById('v2ComingSoonModal');
  if (modal) {
    modal.style.display = 'flex';
    console.log('✅ V2 modal displayed');
  } else {
    console.log('❌ V2ComingSoonModal not found in DOM');
  }
}

// Close Refer modal
function closeReferModal() {
  console.log('🎁 Closing Refer modal...');
  const modal = document.getElementById('referralModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ Referral modal closed');
  }
}

// Create Refer modal if it doesn't exist
function createReferModal() {
  const modal = document.createElement('div');
  modal.id = 'referModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>🎁 Refer & Earn</h2>
        <button class="modal-close" onclick="closeReferModal()">×</button>
      </div>
      <div class="modal-body">
        <p>Invite friends and earn rewards!</p>
        <div class="refer-stats">
          <div class="stat-item">
            <div class="stat-number">0</div>
            <div class="stat-label">Friends Referred</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">0</div>
            <div class="stat-label">SOL Earned</div>
          </div>
        </div>
        <div class="refer-link-section">
          <label>Your Referral Link:</label>
          <div class="refer-link-container">
            <input type="text" id="referLink" value="https://yourgame.com/?ref=YOUR_CODE" readonly>
            <button onclick="copyReferLink()" class="copy-btn">📋 Copy</button>
          </div>
        </div>
        <p class="refer-terms">
          💰 Earn 10% of your friends' land purchases!<br>
          🎁 Get bonus rewards when they start mining!
        </p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Copy referral link
function copyReferLink() {
  const linkInput = document.getElementById('referLink');
  if (linkInput) {
    linkInput.select();
    document.execCommand('copy');
    alert('📋 Referral link copied to clipboard!');
  }
}

// Bind these functions to global scope
window.showReferModal = showReferModal;
window.showV2Modal = showV2Modal;
window.closeReferModal = closeReferModal;
window.copyReferLink = copyReferLink;
window.showHowItWorksModal = showHowItWorksModal;
window.hideHowItWorksModal = hideHowItWorksModal;
window.closeV2Modal = closeV2Modal;

// Add event listeners for modal close buttons
document.addEventListener('DOMContentLoaded', () => {
  // Close referral modal when close button is clicked
  const closeModalBtn = document.getElementById('closeModal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeReferModal);
    console.log('✅ Added close modal event listener');
  }
  
  // Close modal when clicking outside of it - REFERRAL MODAL
  const referralModal = document.getElementById('referralModal');
  if (referralModal) {
    referralModal.addEventListener('click', (e) => {
      if (e.target === referralModal) {
        closeReferModal();
      }
    });
    console.log('✅ Added click-outside-to-close functionality for Referral modal');
  }
  
  // Close modal when clicking outside of it - HOW IT WORKS MODAL
  const howItWorksModal = document.getElementById('howItWorksModal');
  if (howItWorksModal) {
    howItWorksModal.addEventListener('click', (e) => {
      if (e.target === howItWorksModal) {
        hideHowItWorksModal();
      }
    });
    console.log('✅ Added click-outside-to-close functionality for How It Works modal');
  }
  
  // Close modal when clicking outside of it - V2.0 MODAL
  const v2ComingSoonModal = document.getElementById('v2ComingSoonModal');
  if (v2ComingSoonModal) {
    v2ComingSoonModal.addEventListener('click', (e) => {
      if (e.target === v2ComingSoonModal) {
        closeV2Modal();
      }
    });
    console.log('✅ Added click-outside-to-close functionality for V2.0 modal');
  }
  
  // Add sell button event listener
  const sellBtn = document.getElementById('sellBtn');
  if (sellBtn) {
    sellBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('💰 Sell button clicked');
      sellGold();
    });
    console.log('✅ Added sell button event listener');
  } else {
    console.log('❌ Sell button not found in DOM');
  }
});

console.log('🔧 Added modal functions for Refer & V2 popups');

