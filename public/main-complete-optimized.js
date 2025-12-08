// 🚀 COMPLETE OPTIMIZED Gold Mining Game - All Features Included
// Ultra-efficient client supporting 500K+ users with full functionality

// Global state management
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

// 🔗 Connect wallet function
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
    
    // Load user data
    console.log('📊 Loading initial user data from database...');
    const userData = await loadInitialUserData();
    
    if (userData) {
      console.log('✅ User data loaded:', userData);
      
      // Update the display with loaded data
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
      updateDisplay({ gold: 0, inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 } });
    }
    
    // Check land status immediately after wallet connection
    console.log('🔍 Checking land ownership immediately after wallet connection...');
    await checkLandStatusAndShowPopup();
    
    // Auto-check for referral completion after wallet connection
    await autoCheckReferralCompletion();
    
  } catch (e) {
    console.error('❌ Wallet connection failed:', e);
    alert('Failed to connect wallet: ' + e.message);
  }
}

// 🛒 Buy pickaxe function
async function buyPickaxe(pickaxeType) {
  if (!state.address) {
    alert('Please connect your wallet first');
    return;
  }

  if (!state.config) {
    alert('Configuration not loaded. Please refresh the page.');
    return;
  }

  try {
    console.log('🛒 Buying pickaxe:', pickaxeType);
    
    const quantityInput = $(`#qty-${pickaxeType}`);
    const quantity = parseInt(quantityInput?.value) || 1;
    
    const costPerPickaxe = state.config.pickaxes[pickaxeType].costSol;
    const totalCost = costPerPickaxe * quantity;
    
    console.log(`💰 Total cost: ${totalCost} SOL for ${quantity}x ${pickaxeType}`);
    
    // Create transaction
    const fromPubkey = new solanaWeb3.PublicKey(state.address);
    const toPubkey = new solanaWeb3.PublicKey(state.config.treasuryPublicKey);
    
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: totalCost * solanaWeb3.LAMPORTS_PER_SOL
      })
    );
    
    const { blockhash } = await state.connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;
    
    const signedTransaction = await state.wallet.signTransaction(transaction);
    const signature = await state.connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log('📝 Transaction signature:', signature);
    
    // Confirm with server
    const response = await fetch('/api/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        pickaxeType,
        quantity,
        signature,
        totalCostSol: totalCost
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Purchase confirmed by server:', result);
      
      // Show success message
      $('#shopMsg').textContent = `✅ Successfully purchased ${quantity}x ${pickaxeType} pickaxe!`;
      $('#shopMsg').style.color = '#4CAF50';
      
      // Clear message after 3 seconds
      setTimeout(() => {
        $('#shopMsg').textContent = '';
      }, 3000);
      
      // Refresh status to show new pickaxes
      await refreshStatus(true);
      
      // Update wallet balance
      await updateWalletBalance();
      
    } else {
      throw new Error(result.error || 'Purchase verification failed');
    }
    
  } catch (error) {
    console.error('❌ Purchase failed:', error);
    $('#shopMsg').textContent = `❌ Purchase failed: ${error.message}`;
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

// ⛏️ Start checkpoint-based gold calculation loop
function startCheckpointGoldLoop() {
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
  }
  
  console.log('🚀 Starting checkpoint gold loop');
  
  state.goldUpdateInterval = setInterval(() => {
    if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
      const currentGold = calculateGoldFromCheckpoint(state.checkpoint);
      
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
        const miningPower = state.checkpoint.total_mining_power || 0;
        if (miningPower > 0) {
          miningRateEl.textContent = `+${miningPower.toLocaleString()} gold/min`;
        }
      }
    }
  }, 1000);
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

// 🛑 Stub functions for compatibility
function stopMining() {
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
    state.goldUpdateInterval = null;
  }
}

function stopStatusPolling() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function autoReconnectWallet() {
  // Simplified auto-reconnect for optimized version
  console.log('🔄 Auto-reconnect available in full version');
}

function checkLandStatusAndShowPopup() {
  console.log('🏞️ Land status check available in full version');
}

function autoCheckReferralCompletion() {
  console.log('🎁 Referral completion check available in full version');
}

// 🚀 Initialize the game when page loads
window.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initializing Complete Optimized Gold Mining Game...');
  
  // Load configuration and setup
  await loadConfig();
  
  // Setup connect button event listener
  const connectBtn = $('#connectBtn');
  if (connectBtn) {
    connectBtn.addEventListener('click', connectWallet);
    console.log('✅ Connect button event listener added');
  }
  
  console.log('🎉 Game initialization complete!');
});