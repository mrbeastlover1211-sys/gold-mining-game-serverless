let state = {
  connection: null,
  config: null,
  wallet: null,
  address: null,
  intervalId: null,
  status: { gold: 0, inventory: null },
};

const $ = (sel) => document.querySelector(sel);

async function loadConfig() {
  const res = await fetch('/config');
  state.config = await res.json();
  $('#goldPrice').textContent = state.config.goldPriceSol + ' SOL';
  $('#minSell').textContent = state.config.minSellGold.toLocaleString();
  renderShop();
  // Try auto-connect after loading shop
  tryAutoConnect();
}

function renderShop() {
  // Update pickaxe select dropdown with current prices
  if (state.config && state.config.pickaxes) {
    const select = $('#pickaxeSelect');
    select.innerHTML = `
      <option value="silver">Silver Pickaxe - ${state.config.pickaxes.silver.costSol} SOL (1 gold/sec)</option>
      <option value="gold">Gold Pickaxe - ${state.config.pickaxes.gold.costSol} SOL (10 gold/sec)</option>
      <option value="diamond">Diamond Pickaxe - ${state.config.pickaxes.diamond.costSol} SOL (100 gold/sec)</option>
      <option value="netherite">Netherite Pickaxe - ${state.config.pickaxes.netherite.costSol} SOL (10000 gold/sec)</option>
    `;
  }
}

async function connectWallet(auto=false) {
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    if (!auto) alert('Phantom wallet not found. Please install Phantom.');
    return;
  }
  try {
    const resp = await provider.connect({ onlyIfTrusted: auto });
    if (!resp?.publicKey) {
      if (!auto) await provider.connect(); // prompt if not auto
    }
    const account = (resp?.publicKey || provider.publicKey);
    if (!account) return;
    state.wallet = provider;
    state.address = account.toString();
    localStorage.setItem('gm_address', state.address);
    $('#address').textContent = state.address.slice(0, 8) + '...';
    $('#connectBtn').textContent = '✅ Connected';
    $('#connectBtn').disabled = true;
    
    // Update wallet character section
    $('#walletAddress').textContent = state.address.slice(0, 8) + '...';
    if ($('#walletStatus')) $('#walletStatus').textContent = 'Connected';
    updateWalletBalance();
    startStatusPolling();
  } catch (e) {
    console.error(e);
    if (!auto) alert('Failed to connect wallet');
  }
}

function tryAutoConnect() {
  const cached = localStorage.getItem('gm_address');
  if (cached) connectWallet(true);
}

async function updateWalletBalance() {
  if (!state.wallet || !state.address) {
    if ($('#walletBalance')) $('#walletBalance').textContent = '0 SOL';
    return;
  }
  try {
    const connection = new solanaWeb3.Connection(state.config?.clusterUrl || 'https://api.devnet.solana.com');
    const publicKey = new solanaWeb3.PublicKey(state.address);
    const balance = await connection.getBalance(publicKey);
    const solBalance = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3);
    if ($('#walletBalance')) $('#walletBalance').textContent = `${solBalance} SOL`;
  } catch (e) {
    console.error('Failed to fetch balance:', e);
    if ($('#walletBalance')) $('#walletBalance').textContent = 'Error';
  }
}

async function startStatusPolling() {
  await refreshStatus();
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = setInterval(refreshStatus, 2000);
}

async function refreshStatus() {
  if (!state.address) return;
  try {
    const r = await fetch(`/status?address=${encodeURIComponent(state.address)}`);
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    state.status = json;
    
    // Update the new layout elements
    const inv = json.inventory || { silver:0, gold:0, diamond:0, netherite:0 };
    
    // Update gold display
    $('#gold').textContent = Math.floor(json.gold || 0).toLocaleString();
    $('#goldPrice').textContent = (json.goldPrice || state.config?.goldPriceSol || 0) + ' SOL';
    $('#minSell').textContent = (json.minSell || state.config?.minSellGold || 0).toLocaleString();
    
    // Update pickaxe counts and mining rate
    const totalPickaxes = Object.values(inv).reduce((sum, count) => sum + count, 0);
    $('#pickaxeCount').textContent = totalPickaxes.toLocaleString();
    
    // Update mining rate display
    $('#miningRate').textContent = `+${json.totalRate || 0}/sec`;
    
    // Update pickaxe inventory display
    const names = ['silver','gold','diamond','netherite'];
    const parts = names.filter(k => (inv[k]||0) > 0).map(k => `${k}: ${inv[k]}`);
    $('#pickaxeInventory').textContent = parts.length ? parts.join(', ') : 'No pickaxes owned';
    
    // Update mining status
    if (totalPickaxes > 0) {
      $('#miningStatus').textContent = `Mining with ${totalPickaxes} pickaxe${totalPickaxes > 1 ? 's' : ''}!`;
    } else {
      $('#miningStatus').textContent = 'Buy pickaxes to start mining!';
    }
    
  } catch (e) {
    console.error(e);
  }
}

async function purchasePickaxe() {
  if (!state.address) { 
    $('#shopMsg').textContent = 'Please connect your wallet first!';
    return; 
  }
  
  const pickaxeType = $('#pickaxeSelect').value;
  const quantity = parseInt($('#buyQuantity').value) || 1;
  
  try {
    $('#shopMsg').textContent = 'Processing purchase...';
    $('#shopMsg').className = 'msg';
    
    // Ask server to build transfer transaction
    const r1 = await fetch('/purchase-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity }),
    });
    const j1 = await r1.json();
    if (j1.error) throw new Error(j1.error);

    const txBytes = Uint8Array.from(atob(j1.transaction), c => c.charCodeAt(0));
    const tx = solanaWeb3.Transaction.from(txBytes);

    // Sign and send via wallet
    const sig = await state.wallet.signAndSendTransaction(tx);
    $('#shopMsg').textContent = `Transaction submitted: ${sig.signature.slice(0, 8)}...`;

    // Confirm with server and assign pickaxe
    const r2 = await fetch('/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: state.address, pickaxeType, quantity, signature: sig.signature }),
    });
    const j2 = await r2.json();
    if (j2.error) throw new Error(j2.error);

    $('#shopMsg').textContent = `Successfully purchased ${pickaxeType} pickaxe x${quantity}!`;
    $('#shopMsg').className = 'msg success';
    await refreshStatus();
  } catch (e) {
    console.error(e);
    $('#shopMsg').textContent = 'Purchase failed: ' + e.message;
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
      $('#sellMsg').textContent = `Trade recorded! Pending payout of ~${j.payoutSol} SOL`;
      $('#sellMsg').className = 'msg success';
    } else {
      $('#sellMsg').textContent = `Trade complete! Received ~${j.payoutSol} SOL`;
      $('#sellMsg').className = 'msg success';
    }
    await refreshStatus();
    updateWalletBalance(); // Update balance after selling
  } catch (e) {
    console.error(e);
    $('#sellMsg').textContent = 'Sale failed: ' + e.message;
    $('#sellMsg').className = 'msg error';
  }
}

$('#connectBtn').addEventListener('click', () => connectWallet(false));
$('#sellBtn').addEventListener('click', sellGold);
$('#buyBtn').addEventListener('click', purchasePickaxe);

loadConfig();
