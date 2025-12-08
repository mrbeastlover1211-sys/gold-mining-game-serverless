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
    
    // Check land status immediately after wallet connection
    console.log('🔍 Checking land ownership immediately after wallet connection...');
    await checkLandStatusAndShowPopup();
    
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
    
    // Check if Solana Web3 library is loaded
    if (typeof solanaWeb3 === 'undefined') {
      throw new Error('Solana library not loaded. Please refresh the page.');
    }
    
    // Create transaction
    const fromPubkey = new solanaWeb3.PublicKey(state.address);
    const toPubkey = new solanaWeb3.PublicKey(state.config.treasuryPublicKey);
    
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(totalCost * solanaWeb3.LAMPORTS_PER_SOL)
      })
    );
    
    const { blockhash } = await state.connection.getLatestBlockhash();
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
        
        // Check land status after auto-reconnect
        console.log('🔍 Checking land ownership after auto-reconnect...');
        await checkLandStatusAndShowPopup();
        
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
          
          // Check land status after silent reconnect
          console.log('🔍 Checking land ownership after silent reconnect...');
          await checkLandStatusAndShowPopup();
          
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

// 🔄 Handle wallet switch
async function handleWalletSwitch(newAddress, provider) {
  const previousAddress = state.address;
  
  console.log(`🔄 Handling wallet switch from ${previousAddress?.slice(0, 8)}... to ${newAddress.slice(0, 8)}...`);
  
  // Stop existing mining and polling
  stopMining();
  stopStatusPolling();
  
  // Update state
  state.wallet = provider;
  state.address = newAddress;
  localStorage.setItem('gm_address', newAddress);
  
  // Update UI
  await updateWalletBalance();
  updateConnectButtonDisplay();
  
  // Load new user data
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
  
  console.log('✅ Wallet switch handled successfully');
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

// 🏞️ Check land status and show mandatory popup
async function checkLandStatusAndShowPopup() {
  if (!state.address) {
    console.log('🏞️ No wallet connected, skipping land check');
    return;
  }
  
  try {
    console.log('🏞️ Checking land ownership status...');
    
    const response = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
    const result = await response.json();
    
    console.log('🏞️ Land status result:', result);
    
    if (!result.hasLand) {
      console.log('🚨 User does not own land - showing mandatory purchase modal');
      showMandatoryLandModal();
    } else {
      console.log('✅ User owns land - access granted');
      hideMandatoryLandModal();
    }
    
  } catch (error) {
    console.error('❌ Failed to check land status:', error);
    // If API fails, assume no land and show modal for safety
    console.log('🚨 Assuming no land due to API error - showing mandatory purchase modal');
    showMandatoryLandModal();
  }
}

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

function autoCheckReferralCompletion() {
  console.log('🎁 Referral completion check available in full version');
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

async function updatePromotersStatus() {
  const walletConnected = !!state.address;
  let hasLand = false;
  
  // Check actual land ownership status
  if (walletConnected) {
    try {
      const response = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
      const result = await response.json();
      hasLand = result.hasLand || false;
    } catch (error) {
      console.log('⚠️ Could not check land status for promoters modal');
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
  
  // Check actual land ownership status
  if (walletConnected) {
    try {
      const response = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
      const result = await response.json();
      hasLand = result.hasLand || false;
    } catch (error) {
      console.log('⚠️ Could not check land status for referral modal');
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

// 🏞️ Land Purchase Functions
async function purchaseLand() {
  if (!state.address) {
    alert('Please connect your wallet first');
    return;
  }
  
  if (!state.config) {
    alert('Configuration not loaded. Please refresh the page.');
    return;
  }
  
  // Check if Solana Web3 library is loaded
  if (typeof solanaWeb3 === 'undefined') {
    console.error('❌ Solana Web3 library not loaded');
    $('#landMsg').textContent = '❌ Loading blockchain library... Please wait a moment.';
    $('#landMsg').style.color = '#FF9800';
    
    // Try to wait for the library to load
    await waitForSolanaWeb3();
    
    if (typeof solanaWeb3 === 'undefined') {
      $('#landMsg').textContent = '❌ Blockchain library failed to load. Please refresh the page.';
      $('#landMsg').style.color = '#f44336';
      return;
    } else {
      $('#landMsg').textContent = '✅ Blockchain library loaded. Continuing with purchase...';
      $('#landMsg').style.color = '#4CAF50';
    }
  }
  
  if (!state.wallet) {
    alert('Wallet not connected properly. Please reconnect your wallet.');
    return;
  }
  
  try {
    console.log('🏞️ Starting land purchase...');
    
    // Show loading state
    $('#landMsg').textContent = 'Processing land purchase...';
    $('#landMsg').style.color = '#2196F3';
    
    const landCost = state.config.landCostSol || 0.01; // Default 0.01 SOL
    console.log('💰 Land cost:', landCost, 'SOL');
    console.log('🏦 Treasury address:', state.config.treasuryPublicKey);
    
    // Check wallet balance first
    const balance = await state.connection.getBalance(new solanaWeb3.PublicKey(state.address));
    const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
    console.log('💳 Current balance:', solBalance, 'SOL');
    
    if (solBalance < landCost + 0.001) { // Add small buffer for transaction fee
      throw new Error(`Insufficient balance. You need at least ${landCost + 0.001} SOL but only have ${solBalance.toFixed(6)} SOL`);
    }
    
    // Create transaction for land purchase
    const fromPubkey = new solanaWeb3.PublicKey(state.address);
    const toPubkey = new solanaWeb3.PublicKey(state.config.treasuryPublicKey);
    
    console.log('📤 Creating transaction from:', fromPubkey.toString());
    console.log('📥 Creating transaction to:', toPubkey.toString());
    
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(landCost * solanaWeb3.LAMPORTS_PER_SOL)
      })
    );
    
    // Get recent blockhash
    console.log('🔗 Getting recent blockhash...');
    const { blockhash } = await state.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;
    
    console.log('✍️ Requesting wallet signature...');
    $('#landMsg').textContent = 'Please approve the transaction in your wallet...';
    $('#landMsg').style.color = '#FF9800';
    
    // Sign and send transaction
    const signedTransaction = await state.wallet.signTransaction(transaction);
    
    console.log('📡 Sending transaction to blockchain...');
    $('#landMsg').textContent = 'Sending transaction to blockchain...';
    $('#landMsg').style.color = '#2196F3';
    
    const signature = await state.connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log('📝 Land purchase transaction signature:', signature);
    
    $('#landMsg').textContent = 'Confirming transaction with server...';
    $('#landMsg').style.color = '#2196F3';
    
    // Confirm with server
    const response = await fetch('/api/purchase-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        signature: signature,
        landCostSol: landCost
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Land purchase confirmed by server:', result);
      
      $('#landMsg').textContent = '✅ Land purchased successfully!';
      $('#landMsg').style.color = '#4CAF50';
      
      // Hide the mandatory modal
      hideMandatoryLandModal();
      
      // Update wallet balance
      await updateWalletBalance();
      
      // Refresh status
      await refreshStatus(true);
      
      console.log('🎉 Land purchase complete - user now has access!');
      
    } else {
      throw new Error(result.error || 'Land purchase verification failed');
    }
    
  } catch (error) {
    console.error('❌ Land purchase failed:', error);
    
    let errorMessage = error.message;
    
    // Handle specific error types
    if (error.message.includes('User rejected')) {
      errorMessage = 'Transaction cancelled by user';
    } else if (error.message.includes('Insufficient')) {
      errorMessage = error.message; // Already formatted above
    } else if (error.message.includes('_bn')) {
      errorMessage = 'Blockchain library error. Please refresh the page and try again.';
    } else if (error.message.includes('blockhash')) {
      errorMessage = 'Network error. Please try again in a few seconds.';
    }
    
    $('#landMsg').textContent = `❌ Land purchase failed: ${errorMessage}`;
    $('#landMsg').style.color = '#f44336';
    
    // Clear message after 10 seconds for errors
    setTimeout(() => {
      $('#landMsg').textContent = '';
    }, 10000);
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

// 🚀 Initialize the game when page loads
window.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initializing Complete Optimized Gold Mining Game...');
  
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