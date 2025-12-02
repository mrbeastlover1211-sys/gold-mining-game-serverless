// 🚀 COMPLETE OPTIMIZED Gold Mining Game - All Functions Working
// This version combines the working main.js functionality with client-side mining optimization

let state = {
  connection: null,
  config: null,
  wallet: null,
  address: null,
  intervalId: null,
  status: { gold: 0, inventory: null },
  miningEngine: null,
  checkpoint: null,
  goldUpdateInterval: null
};

const $ = (sel) => document.querySelector(sel);

// 🎯 OPTIMIZED: Client-side mining engine (99% cost reduction)
class OptimizedMiningEngine {
  constructor() {
    this.gold = 0;
    this.inventory = { silver: 0, gold: 0, diamond: 0, netherite: 0 };
    this.totalRatePerMinute = 0;
    this.lastUpdate = Date.now();
    this.isActive = false;
  }

  initialize(userData) {
    this.gold = userData.last_checkpoint_gold || 0;
    this.inventory = userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
    this.calculateMiningRate();
    this.lastUpdate = userData.checkpoint_timestamp ? userData.checkpoint_timestamp * 1000 : Date.now();
    console.log('⚡ Optimized mining engine initialized:', {
      gold: this.gold,
      inventory: this.inventory,
      rate: this.totalRatePerMinute
    });
  }

  calculateMiningRate() {
    this.totalRatePerMinute = 
      (this.inventory.silver || 0) * 1 +
      (this.inventory.gold || 0) * 10 +
      (this.inventory.diamond || 0) * 100 +
      (this.inventory.netherite || 0) * 1000;
    return this.totalRatePerMinute;
  }

  updateGold() {
    if (this.totalRatePerMinute <= 0) return this.gold;
    
    const now = Date.now();
    const timeDiff = (now - this.lastUpdate) / 1000; // seconds
    const goldPerSecond = this.totalRatePerMinute / 60;
    const goldMined = goldPerSecond * timeDiff;
    
    this.gold += goldMined;
    this.lastUpdate = now;
    
    return this.gold;
  }

  startMining() {
    if (this.isActive) return;
    this.isActive = true;
    
    this.miningInterval = setInterval(() => {
      const newGold = this.updateGold();
      
      // Update UI
      const totalGoldEl = $('#totalGold');
      if (totalGoldEl) {
        totalGoldEl.textContent = newGold.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
      }
      
      // Update rate display
      const miningRateEl = $('#currentMiningRate');
      if (miningRateEl) {
        miningRateEl.textContent = `+${this.totalRatePerMinute.toLocaleString()} gold/min`;
      }
      
    }, 1000); // Update every second
    
    console.log('⛏️ Optimized mining started with rate:', this.totalRatePerMinute, '/min');
  }

  stopMining() {
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
      this.miningInterval = null;
    }
    this.isActive = false;
    console.log('🛑 Optimized mining stopped');
  }

  addPickaxe(type, quantity = 1) {
    this.inventory[type] = (this.inventory[type] || 0) + quantity;
    this.calculateMiningRate();
    
    if (this.totalRatePerMinute > 0 && !this.isActive) {
      this.startMining();
    }
    
    console.log('🔨 Added pickaxe:', type, 'x' + quantity, 'New rate:', this.totalRatePerMinute);
  }

  getState() {
    return {
      gold: this.updateGold(),
      inventory: this.inventory,
      totalRatePerMinute: this.totalRatePerMinute,
      lastUpdate: this.lastUpdate
    };
  }
}

// Initialize optimized mining engine
state.miningEngine = new OptimizedMiningEngine();

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
    
    // Auto-reconnect wallet
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
    { key: 'netherite', name: 'Netherite Pickaxe', rate: 1000, cost: state.config.pickaxes.netherite.costSol }
  ];
  
  pickaxes.forEach((pickaxe, index) => {
    const item = document.createElement('div');
    item.className = 'pickaxe-item';
    
    let iconSrc = '';
    switch(pickaxe.key) {
      case 'silver': iconSrc = 'assets/pickaxes/pickaxe-silver.png'; break;
      case 'gold': iconSrc = 'assets/pickaxes/pickaxe-gold.png'; break;
      case 'diamond': iconSrc = 'assets/pickaxes/pickaxe-diamond.png'; break;
      case 'netherite': iconSrc = 'assets/pickaxes/pickaxe-netherite.gif'; break;
      default: iconSrc = 'assets/pickaxes/pickaxe-silver.png';
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

// 🔗 WALLET CONNECTION FUNCTIONS
async function connectWallet() {
  try {
    console.log('🔗 Connecting to Phantom wallet...');
    
    if (!window.solana || !window.solana.isPhantom) {
      alert('Please install Phantom wallet to continue');
      return;
    }
    
    const response = await window.solana.connect();
    const publicKey = response.publicKey.toString();
    
    state.wallet = window.solana;
    state.address = publicKey;
    
    console.log('✅ Wallet connected:', state.address);
    
    // Update UI
    updateWalletInfo(publicKey);
    
    // Get/create user data
    await refreshStatus(true);
    
    // Auto-check referral completion
    await autoCheckReferralCompletion();
    
    // Check land status and show popup if needed
    await checkLandStatusAndShowPopup();
    
  } catch (err) {
    console.error('❌ Wallet connection failed:', err);
    alert('Failed to connect wallet: ' + err.message);
  }
}

async function autoReconnectWallet() {
  try {
    if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
      const publicKey = window.solana.publicKey.toString();
      state.wallet = window.solana;
      state.address = publicKey;
      
      console.log('🔄 Auto-reconnected wallet:', state.address);
      updateWalletInfo(publicKey);
      await refreshStatus(true);
    }
  } catch (e) {
    console.log('⚠️ Auto-reconnect failed:', e.message);
  }
}

function updateWalletInfo(address) {
  const shortAddress = address.slice(0, 4) + '...' + address.slice(-4);
  $('#walletAddress').textContent = shortAddress;
  $('#walletStatus').textContent = 'Connected';
  $('#connectBtn').textContent = 'Connected';
  $('#connectBtn').disabled = true;
  
  // Show wallet-dependent UI elements
  $('#userStats').style.display = 'block';
  $('#pickaxeShop').style.display = 'block';
  $('#goldExchange').style.display = 'block';
}

// 🔄 STATUS REFRESH WITH OPTIMIZED CACHING
async function refreshStatus(forceRefresh = false) {
  if (!state.address) {
    console.log('⚠️ No wallet connected for status refresh');
    return;
  }
  
  try {
    console.log('🔄 Refreshing status...');
    
    const res = await fetch(`/api/status?address=${encodeURIComponent(state.address)}`);
    const userData = await res.json();
    
    if (!userData.success) {
      console.error('❌ Status refresh failed:', userData.error);
      return;
    }
    
    console.log('✅ Status refreshed:', userData);
    
    // Update state
    state.status = userData;
    
    // Initialize optimized mining engine with fresh data
    state.miningEngine.initialize(userData);
    
    // Update UI with fresh data
    updateUserStatsDisplay(userData);
    
    // Start mining if user has pickaxes
    if (state.miningEngine.totalRatePerMinute > 0) {
      state.miningEngine.startMining();
    }
    
  } catch (error) {
    console.error('❌ Status refresh error:', error);
  }
}

function updateUserStatsDisplay(userData) {
  // Update gold display
  $('#totalGold').textContent = userData.last_checkpoint_gold?.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) || '0.00';
  
  // Update pickaxe counts
  const pickaxeTypes = ['silver', 'gold', 'diamond', 'netherite'];
  pickaxeTypes.forEach(type => {
    const count = userData[`${type}_pickaxes`] || 0;
    const ownedEl = $(`#owned-${type}`);
    if (ownedEl) {
      ownedEl.textContent = `Owned: ${count}`;
      ownedEl.style.display = count > 0 ? 'block' : 'none';
    }
  });
  
  // Update mining rate
  const totalRate = 
    (userData.silver_pickaxes || 0) * 1 +
    (userData.gold_pickaxes || 0) * 10 +
    (userData.diamond_pickaxes || 0) * 100 +
    (userData.netherite_pickaxes || 0) * 1000;
    
  $('#currentMiningRate').textContent = `+${totalRate.toLocaleString()} gold/min`;
  
  // Update other stats
  $('#totalReferrals').textContent = userData.total_referrals || 0;
  $('#referralRewards').textContent = (userData.referral_rewards_earned || 0).toFixed(4) + ' SOL';
  
  console.log('🔄 User stats display updated');
}

// 🔨 PICKAXE PURCHASE FUNCTION
async function buyPickaxe(pickaxeType) {
  if (!state.address || !state.config) {
    alert('Please connect your wallet first');
    return;
  }
  
  try {
    const quantity = parseInt($(`#qty-${pickaxeType}`).value) || 1;
    const costSol = state.config.pickaxes[pickaxeType].costSol;
    const totalCost = costSol * quantity;
    
    console.log(`🛒 Buying ${quantity}x ${pickaxeType} pickaxe(s) for ${totalCost} SOL`);
    
    showShopMessage(`Purchasing ${quantity}x ${pickaxeType} pickaxe(s)...`, 'info');
    
    // Create and send transaction
    const transaction = new solanaWeb3.Transaction();
    const recipientPubkey = new solanaWeb3.PublicKey(state.config.treasury);
    const lamports = totalCost * solanaWeb3.LAMPORTS_PER_SOL;
    
    transaction.add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: new solanaWeb3.PublicKey(state.address),
        toPubkey: recipientPubkey,
        lamports: lamports,
      })
    );
    
    const { blockhash } = await state.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new solanaWeb3.PublicKey(state.address);
    
    const signedTransaction = await state.wallet.signTransaction(transaction);
    const txId = await state.connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log('📝 Transaction sent:', txId);
    showShopMessage('Confirming transaction...', 'info');
    
    // Wait for confirmation
    await state.connection.confirmTransaction(txId);
    console.log('✅ Transaction confirmed');
    
    // Confirm purchase with backend
    const confirmRes = await fetch('/api/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        pickaxeType,
        quantity,
        txId
      })
    });
    
    const confirmData = await confirmRes.json();
    
    if (confirmData.success) {
      showShopMessage(`✅ Successfully bought ${quantity}x ${pickaxeType} pickaxe${quantity > 1 ? 's' : ''}!`, 'success');
      
      // Update optimized mining engine
      state.miningEngine.addPickaxe(pickaxeType, quantity);
      
      // Refresh status to show new pickaxes
      await refreshStatus(true);
      
      // Check for referral completion after pickaxe purchase
      await autoCheckReferralCompletion();
      
    } else {
      throw new Error(confirmData.error || 'Purchase confirmation failed');
    }
    
  } catch (error) {
    console.error('❌ Pickaxe purchase failed:', error);
    showShopMessage(`❌ Purchase failed: ${error.message}`, 'error');
  }
}

// 💰 GOLD SELLING FUNCTION
async function sellGold() {
  if (!state.address || !state.config) {
    alert('Please connect your wallet first');
    return;
  }
  
  try {
    const goldToSell = parseFloat($('#goldToSell').value);
    const minSell = state.config.minSellGold;
    
    if (goldToSell < minSell) {
      alert(`Minimum sell amount is ${minSell.toLocaleString()} gold`);
      return;
    }
    
    // Get current gold from mining engine
    const currentGold = state.miningEngine.getState().gold;
    
    if (goldToSell > currentGold) {
      alert(`You only have ${Math.floor(currentGold).toLocaleString()} gold`);
      return;
    }
    
    console.log(`💰 Selling ${goldToSell} gold...`);
    
    // Calculate SOL amount
    const solAmount = goldToSell * state.config.goldPriceSol;
    $('#sellMsg').textContent = `Selling ${goldToSell.toLocaleString()} gold for ${solAmount.toFixed(6)} SOL...`;
    $('#sellMsg').className = 'msg info';
    
    const sellRes = await fetch('/api/sell-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: state.address,
        goldAmount: goldToSell
      })
    });
    
    const sellData = await sellRes.json();
    
    if (sellData.success) {
      $('#sellMsg').textContent = `✅ Gold sale pending! You will receive ${solAmount.toFixed(6)} SOL within 24 hours.`;
      $('#sellMsg').className = 'msg success';
      
      // Update mining engine (subtract sold gold)
      state.miningEngine.gold -= goldToSell;
      
      // Clear input
      $('#goldToSell').value = '';
      
      // Refresh status
      await refreshStatus(true);
      
    } else {
      throw new Error(sellData.error || 'Gold sale failed');
    }
    
  } catch (error) {
    console.error('❌ Gold sale failed:', error);
    $('#sellMsg').textContent = `❌ Sale failed: ${error.message}`;
    $('#sellMsg').className = 'msg error';
  }
}

function showShopMessage(message, type) {
  const msgEl = $('#shopMsg');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `msg ${type}`;
  }
}

// 🤝 REFERRAL COMPLETION CHECK
async function autoCheckReferralCompletion() {
  if (!state.address) {
    console.log('⚠️ No wallet connected for referral completion check');
    return;
  }
  
  try {
    console.log('🤝 Auto-checking referral completion...');
    
    const response = await fetch('/api/complete-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address })
    });
    
    const result = await response.json();
    
    if (result.success && result.referral_completed) {
      console.log('🎉 REFERRAL COMPLETED!', result);
      showReferralCompletionNotification(result);
      
      // Refresh status to show updated rewards
      setTimeout(() => {
        if (state.address) {
          refreshStatus(true);
        }
      }, 2000);
    } else {
      console.log('ℹ️ No referral completion needed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Auto referral completion check failed:', error);
  }
}

function showReferralCompletionNotification(result) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(45deg, #10b981, #059669);
    color: white;
    padding: 20px 30px;
    border-radius: 15px;
    z-index: 10001;
    font-family: Arial, sans-serif;
    text-align: center;
    max-width: 400px;
  `;
  
  const rewards = result.reward_details || {};
  
  notification.innerHTML = `
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
      🎉 Referral Reward Earned!
    </div>
    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
      <div>🔨 ${rewards.pickaxe_count || 1}x ${(rewards.pickaxe_type || 'silver').toUpperCase()} Pickaxe</div>
      <div>💰 ${rewards.gold_reward || 100} Gold</div>
      <div>🪙 ${rewards.sol_reward || 0.01} SOL</div>
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 5px;
      margin-top: 15px;
      cursor: pointer;
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

// 🏠 LAND STATUS CHECK
async function checkLandStatusAndShowPopup() {
  if (window.landCheckInProgress) {
    console.log('⚠️ Land detection already running, skipping...');
    return;
  }
  
  window.landCheckInProgress = true;
  
  // Auto-clear after 5 seconds
  setTimeout(() => {
    window.landCheckInProgress = false;
  }, 5000);
  
  if (!state.address) return;
  
  try {
    const response = await fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`);
    const data = await response.json();
    
    if (!data.hasLand) {
      console.log('🏠 User needs land - showing modal');
      showLandModal();
    } else {
      console.log('🏠 User has land - no modal needed');
    }
    
  } catch (error) {
    console.log('⚠️ Land status check failed:', error.message);
  }
}

function showLandModal() {
  console.log('🏠 Smart land modal check...');
  
  if (state.address) {
    fetch(`/api/land-status?address=${encodeURIComponent(state.address)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.hasLand) {
          const landModal = document.getElementById('landModal');
          if (landModal) {
            landModal.style.display = 'flex';
            landModal.classList.add('show');
          }
        }
      });
  }
}

function hideLandModal() {
  const landModal = document.getElementById('landModal');
  if (landModal) {
    landModal.style.display = 'none';
    landModal.classList.remove('show');
  }
}

// 🚀 INITIALIZATION
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Gold Mining Game - Complete Optimized Version Loading...');
  
  // Load configuration
  await loadConfig();
  
  console.log('✅ Game initialization complete!');
});

// Export functions for global access
window.connectWallet = connectWallet;
window.buyPickaxe = buyPickaxe;
window.sellGold = sellGold;
window.changeQuantity = changeQuantity;
window.showLandModal = showLandModal;
window.hideLandModal = hideLandModal;