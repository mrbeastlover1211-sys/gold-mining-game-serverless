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
    const res = await fetch('/config');
    state.config = await res.json();
    console.log('✅ Config loaded:', state.config);
    
    // Initialize Solana connection
    const clusterUrl = state.config.clusterUrl || 'https://api.devnet.solana.com';
    state.connection = new solanaWeb3.Connection(clusterUrl);
    
    updateStaticInfo();
    renderShop();
    
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
  if (!state.config || !state.config.pickaxes) return;
  
  const grid = $('#pickaxeGrid');
  grid.innerHTML = '';
  
  const pickaxes = [
    { key: 'silver', name: 'Silver Pickaxe', rate: 1, cost: state.config.pickaxes.silver.costSol },
    { key: 'gold', name: 'Gold Pickaxe', rate: 10, cost: state.config.pickaxes.gold.costSol },
    { key: 'diamond', name: 'Diamond Pickaxe', rate: 100, cost: state.config.pickaxes.diamond.costSol },
    { key: 'netherite', name: 'Netherite Pickaxe', rate: 10000, cost: state.config.pickaxes.netherite.costSol }
  ];
  
  pickaxes.forEach(pickaxe => {
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
  });
}

function changeQuantity(pickaxeType, delta) {
  const input = $(`#qty-${pickaxeType}`);
  const currentValue = parseInt(input.value) || 1;
  const newValue = Math.max(1, Math.min(1000, currentValue + delta));
  input.value = newValue;
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
    state.wallet = provider;
    state.address = address;
    localStorage.setItem('gm_address', address);
    
    console.log('✅ Wallet connected:', address.slice(0, 8) + '...');
    
    // Update balance first
    await updateWalletBalance();
    
    // Update connect button to show wallet info
    updateConnectButtonDisplay();
    
    // Load user status
    await refreshStatus();
    
    // Initialize checkpoint-based mining
    initializeCheckpointMining();
    
    // Check land status after wallet connection - show popup after 2 seconds if no land
    setTimeout(async () => {
      await checkLandStatusAndShowPopup();
    }, 2000);
    
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

async function refreshStatus() {
  if (!state.address) {
    console.log('⏭️ Skipping status refresh - no wallet connected');
    return;
  }
  
  try {
    console.log('📊 Refreshing status for:', state.address.slice(0, 8) + '...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const r = await fetch(`/status?address=${encodeURIComponent(state.address)}`, {
      signal: controller.signal
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
      initializeCheckpointMining();
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
  const serverGold = data.gold || 0;
  const serverInventory = data.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  
  console.log('🔄 Updating display with gold:', serverGold);
  
  // Update gold display
  const totalGoldEl = $('#totalGold');
  if (totalGoldEl) {
    totalGoldEl.textContent = serverGold.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    console.log('✅ Gold display updated to:', totalGoldEl.textContent);
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
  if (state.intervalId) {
    clearInterval(state.intervalId);
    console.log('🔄 Clearing existing status polling');
  }
  
  // Reset error counter
  state.consecutiveErrors = 0;
  
  // Polling every 5 seconds with safety checks
  state.intervalId = setInterval(async () => {
    if (state.address && !state.isPolling) {
      state.isPolling = true;
      try {
        await refreshStatus();
      } catch (e) {
        console.error('❌ Polling error:', e);
      } finally {
        state.isPolling = false;
      }
    }
  }, 5000);
  
  console.log('⏰ Status polling started (every 5 seconds)');
}

function stopStatusPolling() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isPolling = false;
    console.log('🛑 Status polling stopped');
  }
}

// Initialize checkpoint-based mining system
function initializeCheckpointMining() {
  if (!state.address) {
    console.log('⚠️ Cannot start mining - no wallet connected');
    return;
  }

  console.log('⛏️ Initializing checkpoint-based mining...');
  
  // Ensure checkpoint data exists
  if (!state.checkpoint) {
    state.checkpoint = {
      total_mining_power: 0,
      checkpoint_timestamp: Math.floor(Date.now() / 1000),
      last_checkpoint_gold: 0
    };
    console.log('📊 Created default checkpoint:', state.checkpoint);
  }
  
  // Stop any existing update loop
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
  }
  
  // Start real-time gold calculation loop
  startCheckpointGoldLoop();
  
  console.log('✅ Checkpoint-based mining started!');
}

// Start checkpoint-based gold calculation loop
function startCheckpointGoldLoop() {
  // Clear existing loop if any
  if (state.goldUpdateInterval) {
    clearInterval(state.goldUpdateInterval);
  }
  
  // Update display every second using checkpoint calculation
  state.goldUpdateInterval = setInterval(() => {
    if (state.checkpoint) {
      // Calculate current gold from checkpoint (works even with 0 mining power)
      const currentGold = calculateGoldFromCheckpoint(state.checkpoint);
      
      // Always update display
      const totalGoldEl = $('#totalGold');
      if (totalGoldEl) {
        totalGoldEl.textContent = currentGold.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
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
      
      console.log('⏰ Mining display updated - Gold:', currentGold.toFixed(2), 'Power:', state.checkpoint.total_mining_power || 0);
    }
  }, 1000); // Update every second
  
  console.log('⏰ Checkpoint gold loop started');
}

// Calculate current gold from checkpoint data (pure math, no server calls)
function calculateGoldFromCheckpoint(checkpoint) {
  if (!checkpoint || !checkpoint.total_mining_power) {
    return checkpoint?.last_checkpoint_gold || 0;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const timeSinceCheckpoint = currentTime - checkpoint.checkpoint_timestamp;
  const goldPerSecond = checkpoint.total_mining_power / 60; // Convert per minute to per second
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  
  return checkpoint.last_checkpoint_gold + goldMined;
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
  if (!state.address) {
    $('#shopMsg').textContent = 'Please connect your wallet first!';
    $('#shopMsg').className = 'msg error';
    return;
  }
  
  // Check if user has land before allowing pickaxe purchase
  try {
    const landResponse = await fetch(`/land-status?address=${encodeURIComponent(state.address)}`);
    const landData = await landResponse.json();
    
    if (!landData.hasLand) {
      $('#shopMsg').textContent = '🏠 You need to purchase land first before buying pickaxes!';
      $('#shopMsg').className = 'msg error';
      showLandPurchaseModal();
      return;
    }
  } catch (e) {
    console.error('Failed to check land status:', e);
    $('#shopMsg').textContent = 'Failed to verify land ownership. Please try again.';
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
    
    console.log('🔄 Processing purchase response:', j2);
    
    console.log('📊 Purchase response data:', j2);
    
    // Update state with new inventory immediately
    if (j2.inventory) {
      state.status.inventory = j2.inventory;
      console.log('✅ Updated state inventory:', state.status.inventory);
    }
    
    // Update checkpoint data from server response
    if (j2.checkpoint) {
      state.checkpoint = j2.checkpoint;
      console.log('📊 Updated checkpoint after purchase:', state.checkpoint);
    }
    
    // Force update display with new purchase data immediately
    console.log('🔄 Forcing display update with new data...');
    updateDisplay(j2);
    
    // Refresh to show new data from server
    await refreshStatus();
    await updateWalletBalance();
    
    // Force restart mining with new checkpoint data
    if (state.checkpoint && state.checkpoint.total_mining_power > 0) {
      console.log('🔄 Restarting mining with new pickaxes...');
      initializeCheckpointMining();
    } else {
      console.log('⚠️ No mining power after purchase, something went wrong');
    }
    
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
    
    const r = await fetch('/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, amountGold }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    
    if (j.mode === 'pending') {
      $('#sellMsg').textContent = `✅ Sale recorded! Pending payout of ${j.payoutSol} SOL`;
      $('#sellMsg').className = 'msg success';
    } else {
      $('#sellMsg').textContent = `✅ Sale complete! Received ${j.payoutSol} SOL`;
      $('#sellMsg').className = 'msg success';
    }
    
    $('#sellAmount').value = '';
    await refreshStatus();
    await updateWalletBalance();
    
  } catch (e) {
    console.error(e);
    $('#sellMsg').textContent = '❌ Sale failed: ' + e.message;
    $('#sellMsg').className = 'msg error';
  }
}

// Buy pickaxe with gold (for store section)
async function buyPickaxeWithGold(pickaxeType, goldCost) {
  if (!state.address) {
    $('#storeMsg').textContent = 'Please connect your wallet first!';
    $('#storeMsg').className = 'msg error';
    return;
  }
  
  // Check if user has land before allowing pickaxe purchase
  try {
    const landResponse = await fetch(`/land-status?address=${encodeURIComponent(state.address)}`);
    const landData = await landResponse.json();
    
    if (!landData.hasLand) {
      $('#storeMsg').textContent = '🏠 You need to purchase land first before buying pickaxes!';
      $('#storeMsg').className = 'msg error';
      showLandPurchaseModal();
      return;
    }
  } catch (e) {
    console.error('Failed to check land status:', e);
    $('#storeMsg').textContent = 'Failed to verify land ownership. Please try again.';
    $('#storeMsg').className = 'msg error';
    return;
  }
  
  // Check if user has enough gold
  const currentGold = state.status?.gold || 0;
  if (currentGold < goldCost) {
    $('#storeMsg').textContent = `Not enough gold! You need ${goldCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()} gold.`;
    $('#storeMsg').className = 'msg error';
    return;
  }
  
  try {
    $('#storeMsg').textContent = `Buying ${pickaxeType} pickaxe for ${goldCost.toLocaleString()} gold...`;
    $('#storeMsg').className = 'msg';
    
    const response = await fetch('/buy-with-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: state.address, 
        pickaxeType: pickaxeType,
        goldCost: goldCost
      }),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    $('#storeMsg').textContent = `✅ Successfully bought ${pickaxeType} pickaxe for ${goldCost.toLocaleString()} gold!`;
    $('#storeMsg').className = 'msg success';
    
    // Update checkpoint data from server response
    if (data.checkpoint) {
      state.checkpoint = data.checkpoint;
      console.log('📊 Updated checkpoint after gold purchase:', state.checkpoint);
    }
    
    // Refresh status to show updated gold and inventory
    await refreshStatus();
    
  } catch (e) {
    console.error('Buy with gold failed:', e);
    $('#storeMsg').textContent = '❌ Purchase failed: ' + e.message;
    $('#storeMsg').className = 'msg error';
  }
}

// Check land status and force popup for new users
async function checkLandStatusAndShowPopup() {
  if (!state.address) return;
  
  try {
    const response = await fetch(`/land-status?address=${encodeURIComponent(state.address)}`);
    const data = await response.json();
    
    if (!data.hasLand) {
      console.log('🏠 User has no land, showing mandatory purchase popup');
      // User doesn't have land, show mandatory purchase modal
      showMandatoryLandPurchaseModal();
    } else {
      console.log('✅ User has land, can proceed with game');
    }
  } catch (e) {
    console.error('Failed to check land status:', e);
    // If can't check, show popup to be safe
    showMandatoryLandPurchaseModal();
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

// Create mandatory land purchase modal (cannot be dismissed)
function createMandatoryLandPurchaseModal() {
  const modalHTML = `
    <div id="mandatoryLandModal" class="modal-overlay" style="
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
      animation: fadeIn 0.5s ease-out;">
      
      <div class="modal-content" style="
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        background: linear-gradient(145deg, #1e1e2e 0%, #2d1b69 100%);
        border-radius: 25px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 50px rgba(138, 43, 226, 0.3);
        border: 3px solid #8a2be2;
        position: relative;
        animation: modalBounceIn 0.6s ease-out;">
        
        <!-- Header Section -->
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #8a2be2 100%);
          padding: 30px;
          border-radius: 22px 22px 0 0;
          text-align: center;
          position: relative;
          overflow: hidden;">
          
          <div style="
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: shimmer 3s infinite;">
          </div>
          
          <h1 style="
            color: white;
            font-size: 28px;
            font-weight: bold;
            margin: 0 0 10px 0;
            text-shadow: 0 4px 8px rgba(0,0,0,0.5);
            position: relative;
            z-index: 1;">
            🌟 Welcome to Gold Mining Game!
          </h1>
          
          <p style="
            color: rgba(255,255,255,0.9);
            font-size: 16px;
            margin: 0;
            position: relative;
            z-index: 1;">
            Start your mining empire today
          </p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 40px 35px;">
          
          <!-- Step Indicator -->
          <div style="
            background: linear-gradient(135deg, #ff6b6b, #ffa500);
            color: white;
            padding: 15px 25px;
            border-radius: 15px;
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
            animation: pulse 2s infinite;">
            🎯 STEP 1: Purchase Your Mining Land
          </div>
          
          <!-- Land Cost Box -->
          <div style="
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 25px;
            border-radius: 20px;
            text-align: center;
            margin-bottom: 25px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.2);">
            
            <div style="color: rgba(255,255,255,0.8); font-size: 14px; margin-bottom: 8px;">
              🏠 Land Purchase Price
            </div>
            
            <div style="
              color: white;
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 8px;
              text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
              0.01 SOL
            </div>
            
            <div style="color: rgba(255,255,255,0.7); font-size: 14px;">
              ≈ $2 USD (One-time payment)
            </div>
          </div>
          
          <!-- Benefits Section -->
          <div style="margin-bottom: 25px;">
            <h3 style="
              color: #8a2be2;
              font-size: 20px;
              margin-bottom: 20px;
              text-align: center;">
              🎁 What You Get Forever:
            </h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
              
              <div style="
                background: rgba(138, 43, 226, 0.1);
                padding: 15px;
                border-radius: 12px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">⛏️</div>
                <div style="color: #333; font-size: 14px; font-weight: bold;">
                  Buy Pickaxes
                </div>
              </div>
              
              <div style="
                background: rgba(138, 43, 226, 0.1);
                padding: 15px;
                border-radius: 12px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">💰</div>
                <div style="color: #333; font-size: 14px; font-weight: bold;">
                  Mine Gold 24/7
                </div>
              </div>
              
              <div style="
                background: rgba(138, 43, 226, 0.1);
                padding: 15px;
                border-radius: 12px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">💸</div>
                <div style="color: #333; font-size: 14px; font-weight: bold;">
                  Sell for SOL
                </div>
              </div>
              
              <div style="
                background: rgba(138, 43, 226, 0.1);
                padding: 15px;
                border-radius: 12px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">🎮</div>
                <div style="color: #333; font-size: 14px; font-weight: bold;">
                  Full Game Access
                </div>
              </div>
            </div>
          </div>
          
          <!-- Important Notice -->
          <div style="
            background: linear-gradient(135deg, #ff4757, #ff6b6b);
            color: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            font-weight: bold;
            margin-bottom: 25px;
            animation: urgentPulse 1.5s infinite;
            box-shadow: 0 10px 30px rgba(255, 71, 87, 0.4);">
            🚨 REQUIRED TO PLAY THE GAME 🚨<br>
            <span style="font-size: 14px; opacity: 0.9; font-weight: normal;">
              This popup will remain until land is purchased
            </span>
          </div>
          
          <!-- Purchase Button -->
          <button id="mandatoryLandPurchaseBtn" onclick="purchaseMandatoryLand()" style="
            width: 100%;
            padding: 20px;
            font-size: 20px;
            font-weight: bold;
            border: none;
            border-radius: 15px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
            position: relative;
            overflow: hidden;">
            
            <span style="position: relative; z-index: 1;">
              🏠 Purchase My Mining Land (0.01 SOL)
            </span>
            
            <div style="
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
              transition: left 0.5s ease;
              z-index: 0;">
            </div>
          </button>
          
          <div style="
            text-align: center;
            margin-top: 15px;
            color: #666;
            font-size: 12px;">
            🔒 Secure payment via Phantom Wallet
          </div>
          
          <!-- Message Area -->
          <div id="mandatoryLandMsg" class="msg" style="
            display: none;
            margin-top: 20px;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            font-weight: bold;">
          </div>
          
        </div>
      </div>
    </div>
    
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes modalBounceIn {
        0% {
          opacity: 0;
          transform: scale(0.3) translateY(-50px);
        }
        50% {
          opacity: 1;
          transform: scale(1.05);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      @keyframes shimmer {
        0% { transform: translateX(-100%) translateY(-100%) rotate(30deg); }
        100% { transform: translateX(100%) translateY(100%) rotate(30deg); }
      }
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      @keyframes urgentPulse {
        0%, 100% { 
          transform: scale(1);
          box-shadow: 0 10px 30px rgba(255, 71, 87, 0.4);
        }
        50% { 
          transform: scale(1.02);
          box-shadow: 0 15px 40px rgba(255, 71, 87, 0.6);
        }
      }
      
      #mandatoryLandPurchaseBtn:hover {
        transform: translateY(-3px);
        box-shadow: 0 20px 45px rgba(102, 126, 234, 0.6);
      }
      
      #mandatoryLandPurchaseBtn:hover div {
        left: 0;
      }
    </style>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Prevent any way to close the modal
  const modal = document.getElementById('mandatoryLandModal');
  if (modal) {
    // Block right-click
    modal.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Block clicking outside
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    
    // Block escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('mandatoryLandModal')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
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
    const response = await fetch('/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);

    // Sign and send
    showMandatoryLandMessage('Please sign the transaction in Phantom...', 'info');
    const sig = await state.wallet.signAndSendTransaction(tx);
    showMandatoryLandMessage(`Transaction submitted: ${sig.signature.slice(0, 8)}...`, 'info');

    // Confirm
    const confirmResponse = await fetch('/confirm-land-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, signature: sig.signature }),
    });
    const confirmData = await confirmResponse.json();
    if (confirmData.error) throw new Error(confirmData.error);

    showMandatoryLandMessage('🎉 Land purchased successfully! Welcome to the game!', 'success');
    
    // Close modal after 3 seconds and refresh everything
    setTimeout(async () => {
      closeMandatoryLandModal();
      await refreshStatus();
      await updateWalletBalance();
    }, 3000);
    
  } catch (e) {
    console.error('Mandatory land purchase failed:', e);
    showMandatoryLandMessage('❌ Land purchase failed: ' + e.message, 'error');
  }
}

// Legacy purchase land function
async function purchaseLand() {
  return await purchaseMandatoryLand();
}

// Show message in mandatory land modal
function showMandatoryLandMessage(message, type = 'info') {
  const msgEl = document.getElementById('mandatoryLandMsg');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `msg ${type}`;
    msgEl.style.display = 'block';
    
    // Style based on type
    if (type === 'error') {
      msgEl.style.background = 'linear-gradient(135deg, #ff4757, #ff3742)';
      msgEl.style.color = 'white';
    } else if (type === 'success') {
      msgEl.style.background = 'linear-gradient(135deg, #2ed573, #1db954)';
      msgEl.style.color = 'white';
    } else {
      msgEl.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      msgEl.style.color = 'white';
    }
  }
}

// Close mandatory land modal
function closeMandatoryLandModal() {
  const modal = document.getElementById('mandatoryLandModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Show message in land modal (legacy)
function showLandMessage(message, type = 'info') {
  // Try mandatory modal first, then legacy
  showMandatoryLandMessage(message, type);
  
  const msgEl = document.getElementById('landMsg');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `msg ${type}`;
    msgEl.style.display = 'block';
  }
}

// Close land modal (legacy)
function closeLandModal() {
  // Try closing mandatory modal first
  closeMandatoryLandModal();
  
  const modal = document.getElementById('landPurchaseModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Auto connect check
async function tryAutoConnect() {
  console.log('🔍 Checking for existing wallet connection...');
  
  const provider = window.solana || window.phantom?.solana;
  const cached = localStorage.getItem('gm_address');
  
  if (provider && provider.isConnected && provider.publicKey) {
    console.log('🟢 Wallet already connected, auto-connecting...');
    await connectWallet();
  } else if (cached) {
    console.log('🟡 Found cached address, trying auto-connect...');
    try {
      await connectWallet();
    } catch (e) {
      console.log('❌ Auto-connect failed');
      localStorage.removeItem('gm_address');
      updateConnectButtonDisplay(); // Reset button to default
      // Show land popup after 2 seconds for disconnected users
      setTimeout(() => {
        showMandatoryLandPurchaseModal();
      }, 2000);
    }
  } else {
    console.log('🔴 No wallet connection found');
    updateConnectButtonDisplay(); // Ensure button shows default state
    // Show land popup after 2 seconds for new users
    setTimeout(() => {
      showMandatoryLandPurchaseModal();
    }, 2000);
  }
}

// Modal functions for header buttons
function openReferralModal() {
  console.log('🎁 openReferralModal() called');
  const modal = document.getElementById('referralModal');
  console.log('referralModal element:', modal);
  if (modal) {
    modal.classList.add('show');
    console.log('✅ Added show class to referral modal');
  } else {
    console.error('❌ referralModal element not found!');
  }
}

function openV2Modal() {
  console.log('🎃 openV2Modal() called');
  const modal = document.getElementById('v2ComingSoonModal');
  console.log('v2ComingSoonModal element:', modal);
  if (modal) {
    modal.classList.add('show');
    console.log('✅ Added show class to V2 modal');
  } else {
    console.error('❌ v2ComingSoonModal element not found!');
  }
}

function showHowItWorksModal() {
  const modal = document.getElementById('howItWorksModal');
  if (modal) {
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function closeReferralModal() {
  const modal = document.getElementById('referralModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function closeV2Modal() {
  const modal = document.getElementById('v2ComingSoonModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function hideHowItWorksModal() {
  const modal = document.getElementById('howItWorksModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Initialize default display values
function initializeDefaultDisplay() {
  console.log('🎨 Setting up default display values...');
  
  // Set default values for mining operation
  const totalGoldEl = $('#totalGold');
  if (totalGoldEl) {
    totalGoldEl.textContent = '0.00';
  }
  
  const totalPickaxesEl = $('#totalPickaxes');
  if (totalPickaxesEl) {
    totalPickaxesEl.textContent = '0';
  }
  
  const miningRateEl = $('#miningRate');
  if (miningRateEl) {
    miningRateEl.textContent = '0/min';
  }
  
  const currentMiningRateEl = $('#currentMiningRate');
  if (currentMiningRateEl) {
    currentMiningRateEl.textContent = '+0 gold/min';
  }
  
  const miningStatusEl = $('#miningStatus');
  if (miningStatusEl) {
    miningStatusEl.textContent = '💤 Buy pickaxes to start mining!';
    miningStatusEl.style.color = 'var(--text-secondary)';
  }
  
  console.log('✅ Default display values set');
}

// Initialize app
async function initApp() {
  console.log('🚀 Initializing Gold Mining Game...');
  
  // Set up default display first
  initializeDefaultDisplay();
  
  await loadConfig();
  await tryAutoConnect();
  console.log('✅ App initialized');
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📱 DOM loaded, setting up...');
  
  try {
    await initApp();
    
    // Setup button event listeners
    $('#connectBtn')?.addEventListener('click', connectWallet);
    $('#sellBtn')?.addEventListener('click', sellGold);
    
    // Header buttons
    const referBtn = $('#referBtn');
    const v2Btn = $('#v2ComingSoonBtn');
    
    console.log('🔍 Checking header buttons...');
    console.log('referBtn found:', !!referBtn);
    console.log('v2Btn found:', !!v2Btn);
    
    if (referBtn) {
      referBtn.addEventListener('click', openReferralModal);
      console.log('✅ Refer button event listener added');
    } else {
      console.error('❌ Refer button not found!');
    }
    
    if (v2Btn) {
      v2Btn.addEventListener('click', openV2Modal);
      console.log('✅ V2 button event listener added');
    } else {
      console.error('❌ V2 button not found!');
    }
    
    // How it Works button (in nav)
    document.querySelector('.how-it-works-btn')?.addEventListener('click', showHowItWorksModal);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('show');
      });
    });
    
    // Close modals when clicking overlay
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });
    
    // Make functions global for onclick handlers
    window.changeQuantity = changeQuantity;
    window.buyPickaxe = buyPickaxe;
    window.buyPickaxeWithGold = buyPickaxeWithGold;
    window.openReferralModal = openReferralModal;
    window.openV2Modal = openV2Modal;
    window.showHowItWorksModal = showHowItWorksModal;
    window.closeModal = closeModal;
    window.closeReferralModal = closeReferralModal;
    window.closeV2Modal = closeV2Modal;
    window.hideHowItWorksModal = hideHowItWorksModal;
    window.stopStatusPolling = stopStatusPolling;
    window.refreshStatus = refreshStatus;
    window.purchaseLand = purchaseLand;
    window.closeLandModal = closeLandModal;
    window.purchaseMandatoryLand = purchaseMandatoryLand;
    window.closeMandatoryLandModal = closeMandatoryLandModal;
    window.showMandatoryLandPurchaseModal = showMandatoryLandPurchaseModal;
    
    console.log('🎮 Gold Mining Game ready!');
    
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
  }
});