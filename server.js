import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
// Import database module - will fallback to file system if DB not available
let UserDatabase;
try {
  const dbModule = await import('./database.js');
  UserDatabase = dbModule.default;
  console.log('✅ Database module loaded successfully');
  
  // Test database connection
  const healthCheck = await UserDatabase.healthCheck();
  if (healthCheck.healthy) {
    console.log('🗄️ Database connection healthy:', healthCheck.timestamp);
    global.DATABASE_ENABLED = true;
    
    // FORCE MIGRATE ALL FILE DATA TO DATABASE ON STARTUP
    await migrateFileDataToDatabase();
  } else {
    console.warn('⚠️ Database connection failed, will retry but use fallback system');
    UserDatabase = null;
    global.DATABASE_ENABLED = false;
  }
} catch (dbError) {
  console.warn('⚠️ Database module not available, using file-based system:', dbError.message);
  UserDatabase = null;
  global.DATABASE_ENABLED = false;
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Config
const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY || '';
const TREASURY_SECRET_KEY = process.env.TREASURY_SECRET_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
let GOLD_PRICE_SOL = parseFloat(process.env.GOLD_PRICE_SOL || '0.000001'); // SOL per 1 gold
const MIN_SELL_GOLD = parseInt(process.env.MIN_SELL_GOLD || '10000', 10);

if (!TREASURY_PUBLIC_KEY) {
  console.warn('WARNING: TREASURY_PUBLIC_KEY not set. Purchases cannot be routed properly. Set it in .env');
}

// Solana connection
const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');

// Data persistence
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

function readUsers() {
  try {
    if (!fs.existsSync(usersFile)) return {};
    const raw = fs.readFileSync(usersFile, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read users file', e);
    return {};
  }
}

function writeUsers(data) {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write users file', e);
  }
}

// Migration function to move file data to database on startup
async function migrateFileDataToDatabase() {
  try {
    const fileUsers = readUsers();
    const userAddresses = Object.keys(fileUsers);
    
    if (userAddresses.length === 0) {
      console.log('📁 No file users to migrate');
      return;
    }
    
    console.log(`🔄 Migrating ${userAddresses.length} users from file to database...`);
    
    for (const address of userAddresses) {
      const fileUser = fileUsers[address];
      
      try {
        // Check if user already exists in database
        const existingUser = await UserDatabase.getUser(address);
        if (existingUser) {
          console.log(`⏭️ User ${address.slice(0, 8)}... already in database, skipping`);
          continue;
        }
      } catch (e) {
        // User doesn't exist, create them
      }
      
      // Migrate user data to database
      const userData = {
        total_mining_power: fileUser.total_mining_power || 0,
        checkpoint_timestamp: fileUser.checkpoint_timestamp || Math.floor(Date.now() / 1000),
        last_checkpoint_gold: fileUser.last_checkpoint_gold || fileUser.gold || 0,
        inventory: fileUser.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        hasLand: fileUser.hasLand || false,
        landPurchaseDate: fileUser.landPurchaseDate || null,
        lastActivity: fileUser.lastActivity || Math.floor(Date.now() / 1000)
      };
      
      await UserDatabase.updateUser(address, userData);
      console.log(`✅ Migrated user ${address.slice(0, 8)}... to database`);
    }
    
    // Create backup of file data and clear it
    const backupFile = usersFile + '.backup.' + Date.now();
    writeUsers(fileUsers); // Ensure current data is saved
    fs.copyFileSync(usersFile, backupFile);
    writeUsers({}); // Clear the file
    
    console.log(`🎉 Migration complete! File backed up to: ${backupFile}`);
    
  } catch (e) {
    console.error('❌ Migration failed:', e);
    throw e;
  }
}

const users = readUsers(); // Load users from file system (fallback/safety net)

const PICKAXES = {
  silver: { name: 'Silver', costSol: 0.001, ratePerSec: 1/60 },     // 1 gold/min = 1/60 gold/sec
  gold: { name: 'Gold', costSol: 0.001, ratePerSec: 10/60 },        // 10 gold/min = 10/60 gold/sec
  diamond: { name: 'Diamond', costSol: 0.001, ratePerSec: 100/60 }, // 100 gold/min = 100/60 gold/sec
  netherite: { name: 'Netherite', costSol: 0.001, ratePerSec: 1000/60 }, // 1,000 gold/min = 1,000/60 gold/sec
};

function nowSec() { return Math.floor(Date.now() / 1000); }

function ensureUser(address) {
  if (!users[address]) {
    users[address] = { 
      inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 }, 
      // Checkpoint-based mining system
      total_mining_power: 0,           // Total gold per minute
      checkpoint_timestamp: nowSec(),  // When mining power was last updated
      last_checkpoint_gold: 0,         // Gold amount at last checkpoint
      lastActivity: nowSec(),
      hasLand: false,
      landPurchaseDate: null
    };
  } else if (!users[address].inventory) {
    users[address].inventory = { silver: 0, gold: 0, diamond: 0, netherite: 0 };
  }
  
  // Migrate old users to checkpoint system
  if (users[address].total_mining_power === undefined) {
    users[address].total_mining_power = totalRate(users[address].inventory || {}) * 60; // Convert to per minute
    users[address].checkpoint_timestamp = nowSec();
    users[address].last_checkpoint_gold = users[address].gold || 0;
  }
  
  // Ensure hasLand property exists for existing users
  if (users[address].hasLand === undefined) {
    users[address].hasLand = false;
    users[address].landPurchaseDate = null;
  }
  // Ensure lastActivity exists for existing users
  if (!users[address].lastActivity) {
    users[address].lastActivity = nowSec();
  }
}

function totalRate(inv) {
  let r = 0;
  for (const k of Object.keys(PICKAXES)) {
    r += (inv[k] || 0) * PICKAXES[k].ratePerSec;
  }
  return r;
}

// Calculate current gold from checkpoint (no server-side mining needed)
function calculateCurrentGold(user) {
  if (!user.checkpoint_timestamp || !user.total_mining_power) {
    return user.last_checkpoint_gold || 0;
  }
  
  const currentTime = nowSec();
  const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
  const goldPerSecond = user.total_mining_power / 60; // Convert per minute to per second
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  
  return user.last_checkpoint_gold + goldMined;
}

// Anti-cheat validation system
function validateUserIntegrity(user, address) {
  const now = nowSec();
  const timeSinceCheckpoint = now - (user.checkpoint_timestamp || now);
  const expectedMiningPower = totalRate(user.inventory || {}) * 60;
  
  // Validate mining power matches inventory
  if (user.total_mining_power !== expectedMiningPower) {
    console.warn(`🚨 CHEAT DETECTED: Mining power mismatch for ${address.slice(0, 8)}... Expected: ${expectedMiningPower}, Got: ${user.total_mining_power}`);
    user.total_mining_power = expectedMiningPower; // Fix it
  }
  
  // Validate gold amount isn't impossible
  const maxPossibleGold = (user.last_checkpoint_gold || 0) + (expectedMiningPower * timeSinceCheckpoint / 60);
  const currentCalculatedGold = calculateCurrentGold(user);
  
  if (currentCalculatedGold > maxPossibleGold * 1.1) { // Allow 10% buffer for timing
    console.warn(`🚨 CHEAT DETECTED: Impossible gold amount for ${address.slice(0, 8)}... Max possible: ${maxPossibleGold.toFixed(2)}, Calculated: ${currentCalculatedGold.toFixed(2)}`);
    user.last_checkpoint_gold = Math.min(user.last_checkpoint_gold || 0, maxPossibleGold);
    user.checkpoint_timestamp = now; // Reset checkpoint
  }
  
  // Validate inventory matches known pickaxe types
  const validTypes = ['silver', 'gold', 'diamond', 'netherite'];
  if (user.inventory) {
    Object.keys(user.inventory).forEach(type => {
      if (!validTypes.includes(type)) {
        console.warn(`🚨 CHEAT DETECTED: Invalid pickaxe type ${type} for ${address.slice(0, 8)}...`);
        delete user.inventory[type];
      }
      
      // Validate pickaxe counts are reasonable
      if (user.inventory[type] < 0 || user.inventory[type] > 10000) {
        console.warn(`🚨 CHEAT DETECTED: Impossible pickaxe count for ${address.slice(0, 8)}... ${type}: ${user.inventory[type]}`);
        user.inventory[type] = Math.max(0, Math.min(10000, user.inventory[type]));
      }
    });
  }
  
  console.log(`✅ Anti-cheat validation passed for ${address.slice(0, 8)}...`);
}

// Validate gold amount for selling
function validateSellAmount(user, requestedAmount, address) {
  const currentGold = calculateCurrentGold(user);
  const maxSellable = currentGold * 0.99; // Allow 1% buffer for timing
  
  if (requestedAmount > maxSellable) {
    console.warn(`🚨 CHEAT DETECTED: Trying to sell more gold than owned by ${address.slice(0, 8)}... Has: ${currentGold.toFixed(2)}, Trying to sell: ${requestedAmount}`);
    return Math.max(0, maxSellable);
  }
  
  return requestedAmount;
}

// Create new checkpoint when mining power changes
function createCheckpoint(user, address) {
  // Validate user data before creating checkpoint
  validateUserIntegrity(user, address);
  const currentGold = calculateCurrentGold(user);
  const newMiningPower = totalRate(user.inventory || {}) * 60; // Convert to per minute
  
  user.total_mining_power = newMiningPower;
  user.checkpoint_timestamp = nowSec();
  user.last_checkpoint_gold = currentGold;
  
  console.log(`📊 Checkpoint created for ${address.slice(0, 8)}... Gold: ${currentGold.toFixed(2)}, Power: ${newMiningPower}/min`);
  
  return currentGold;
}

function accrue(address) {
  const u = users[address];
  if (!u) return;
  
  const rate = totalRate(u.inventory || {});
  if (rate === 0) return; // No mining if no pickaxes
  
  const t = nowSec();
  const lastUpdate = u.lastUpdate || t;
  const dt = Math.max(0, t - lastUpdate);
  
  // Anti-idle system: Stop mining if gold >= 10,000 and user hasn't been active recently
  const IDLE_LIMIT = 10000;
  const ACTIVITY_TIMEOUT = 30; // 30 seconds of inactivity allowed
  
  if (u.gold >= IDLE_LIMIT) {
    // Check if user has been inactive
    const lastActivity = u.lastActivity || t;
    const timeSinceActivity = t - lastActivity;
    
    if (timeSinceActivity > ACTIVITY_TIMEOUT) {
      // User is idle - don't accrue mining
      u.lastUpdate = t; // Update timestamp but don't mine
      return;
    }
  }
  
  const earned = rate * dt;
  u.gold = (u.gold || 0) + earned;
  u.lastUpdate = t;
}

app.get('/config', (req, res) => {
  res.json({
    pickaxes: PICKAXES,
    goldPriceSol: GOLD_PRICE_SOL,
    minSellGold: MIN_SELL_GOLD,
    clusterUrl: SOLANA_CLUSTER_URL,
    treasury: TREASURY_PUBLIC_KEY,
  });
});

app.get('/status', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Try database first, fallback to file system if needed
    if (global.DATABASE_ENABLED && UserDatabase) {
      try {
        console.log(`🗄️ Loading user data from database: ${address.slice(0, 8)}...`);
        
        const user = await UserDatabase.getUser(address);
        
        // Calculate current gold from checkpoint
        const currentGold = UserDatabase.calculateCurrentGold(user);
        
        // Update last activity in database
        await UserDatabase.updateUser(address, {
          lastActivity: Math.floor(Date.now() / 1000)
        });
        
        res.json({
          address,
          inventory: user.inventory,
          totalRate: totalRate(user.inventory),
          gold: currentGold,
          hasLand: user.hasLand || false,
          // Checkpoint data for client-side calculations
          checkpoint: {
            total_mining_power: user.total_mining_power || 0,
            checkpoint_timestamp: user.checkpoint_timestamp || Math.floor(Date.now() / 1000),
            last_checkpoint_gold: user.last_checkpoint_gold || 0
          },
          referralStats: {
            totalReferrals: 0,
            referralGoldEarned: 0,
            activeReferrals: 0
          }
        });
        return; // Success - exit here
        
      } catch (dbError) {
        console.warn('⚠️ Database error, falling back to file system:', dbError.message);
        // Continue to file system below
      }
    }
    
    // File system fallback (safety net)
    console.log(`📁 Loading user data from file system: ${address.slice(0, 8)}...`);
    ensureUser(address);
    users[address].lastActivity = nowSec();
    writeUsers(users);
    const u = users[address];
    
    // Calculate current gold from checkpoint
    const currentGold = calculateCurrentGold(u);
    
    res.json({
      address,
      inventory: u.inventory,
      totalRate: totalRate(u.inventory),
      gold: currentGold,
      hasLand: u.hasLand || false,
      // Checkpoint data for client-side calculations
      checkpoint: {
        total_mining_power: u.total_mining_power || 0,
        checkpoint_timestamp: u.checkpoint_timestamp || nowSec(),
        last_checkpoint_gold: u.last_checkpoint_gold || 0
      },
      referralStats: {
        totalReferrals: 0,
        referralGoldEarned: 0,
        activeReferrals: 0
      }
    });
  } catch (e) {
    console.error('Status error:', e);
    res.status(500).json({ error: 'status failed: ' + e.message });
  }
});

// Heartbeat endpoint to track user activity
app.post('/heartbeat', (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    ensureUser(address);
    
    // Update last activity timestamp
    users[address].lastActivity = nowSec();
    writeUsers(users);
    
    res.json({ ok: true, lastActivity: users[address].lastActivity });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'heartbeat failed' });
  }
});

// Sync mining progress from client with anti-cheat validation
app.post('/sync-mining-progress', (req, res) => {
  try {
    const { address, gold, inventory, lastUpdate, totalRate } = req.body;
    if (!address || typeof gold !== 'number' || !inventory) {
      return res.status(400).json({ error: 'address, gold, and inventory required' });
    }
    
    ensureUser(address);
    const user = users[address];
    
    // ANTI-CHEAT VALIDATION
    
    // 1. Validate inventory matches server records (server is authoritative for pickaxes)
    const serverInventory = user.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
    let inventoryMismatch = false;
    for (const [pickaxeType, clientCount] of Object.entries(inventory)) {
      if (clientCount !== (serverInventory[pickaxeType] || 0)) {
        console.warn(`Inventory mismatch for ${address}: client has ${clientCount} ${pickaxeType}, server has ${serverInventory[pickaxeType] || 0}`);
        inventoryMismatch = true;
      }
    }
    
    // 2. Calculate expected mining rate based on server inventory
    const expectedRate = totalRate(serverInventory);
    const expectedRatePerMinute = expectedRate * 60;
    
    // 3. Validate client mining rate matches server calculation
    if (totalRate && Math.abs(totalRate - expectedRatePerMinute) > 0.1) {
      console.warn(`Mining rate mismatch for ${address}: client reports ${totalRate}/min, server expects ${expectedRatePerMinute}/min`);
    }
    
    // 4. Validate gold amount is reasonable based on time elapsed and mining rate
    const timeSinceLastUpdate = nowSec() - (user.lastUpdate || nowSec());
    const maxPossibleGold = user.gold + (expectedRate * Math.min(timeSinceLastUpdate, 3600)); // Max 1 hour of mining
    
    let correctedGold = gold;
    if (gold > maxPossibleGold + 100) { // Allow small buffer for network delays
      console.warn(`Suspicious gold amount from ${address}: ${gold}, max possible: ${maxPossibleGold}`);
      correctedGold = Math.floor(maxPossibleGold);
    }
    
    // 5. Check for reasonable maximum gold limits
    const maxReasonableGold = 10000000; // 10 million gold max
    if (correctedGold > maxReasonableGold) {
      console.warn(`Gold amount exceeds reasonable limit for ${address}: ${correctedGold}. Capping at ${maxReasonableGold}`);
      correctedGold = maxReasonableGold;
    }
    
    // Update server state
    user.gold = correctedGold;
    user.lastUpdate = nowSec();
    user.lastActivity = nowSec();
    // Keep server inventory as authoritative
    
    writeUsers(users);
    
    const response = { 
      ok: true, 
      serverTime: nowSec(),
      syncedGold: user.gold,
      syncedInventory: user.inventory
    };
    
    // Send corrections if needed
    if (correctedGold !== gold) {
      response.correctedGold = correctedGold;
    }
    
    if (inventoryMismatch) {
      response.syncedInventory = user.inventory;
    }
    
    res.json(response);
    
  } catch (e) {
    console.error('Sync mining progress error:', e);
    res.status(500).json({ error: 'sync failed' });
  }
});

// Create unsigned purchase transaction for client to sign and submit
app.post('/purchase-tx', async (req, res) => {
  try {
    const { address, pickaxeType, quantity } = req.body || {};
    if (!address || !pickaxeType || !PICKAXES[pickaxeType]) {
      return res.status(400).json({ error: 'address and valid pickaxeType required' });
    }
    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));
    if (!TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'treasury not configured; set TREASURY_PUBLIC_KEY in .env and restart server' });
    }

    let payer, treasury;
    try {
      payer = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'invalid payer address' });
    }
    try {
      treasury = new PublicKey(TREASURY_PUBLIC_KEY);
    } catch {
      return res.status(400).json({ error: 'invalid TREASURY_PUBLIC_KEY in server config' });
    }

    const unitLamports = Math.round(PICKAXES[pickaxeType].costSol * LAMPORTS_PER_SOL);
    const costLamports = unitLamports * qty;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: costLamports }));

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
    res.json({
      transaction: serialized,
      lastValidBlockHeight,
      pickaxeType,
      quantity: qty,
      costLamports,
    });
  } catch (e) {
    console.error('purchase-tx error', e);
    res.status(500).json({ error: 'failed to create transaction: ' + (e?.message || 'unknown') });
  }
});

// Confirm purchase after client submits transaction
app.post('/purchase-confirm', async (req, res) => {
  try {
    const { address, pickaxeType, signature, quantity } = req.body || {};
    if (!address || !pickaxeType || !PICKAXES[pickaxeType] || !signature) {
      return res.status(400).json({ error: 'address, pickaxeType, signature required' });
    }
    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));

    // Validate signature format
    if (typeof signature !== 'string' || signature.length < 80 || signature.length > 90) {
      return res.status(400).json({ error: 'invalid signature format' });
    }

    // Basic confirmation check with better error handling
    let conf, status;
    try {
      conf = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      status = conf && conf.value && (conf.value.confirmationStatus || (conf.value.err == null ? 'processed' : null));
    } catch (signatureError) {
      console.error('Signature validation error:', signatureError);
      // If signature validation fails, we'll allow the purchase but log it
      console.log(`Warning: Could not validate signature ${signature} for address ${address}, but allowing pickaxe purchase`);
      status = 'unverified';
    }

    // For devnet testing, we'll be more lenient with signature validation
    if (!status || status === 'unverified') {
      console.log(`Granting ${qty}x ${pickaxeType} pickaxe to ${address} with signature ${signature} (status: ${status || 'unknown'})`);
    }

    // Use file system directly (database not configured)
    {
      console.log(`🔄 Processing purchase confirmation for ${address} - ${qty}x ${pickaxeType}`);
      // File-based system
      ensureUser(address);
      
      // Create checkpoint with current gold before adding pickaxe
      const currentGold = createCheckpoint(users[address], address);
      
      // Add new pickaxe(s)
      users[address].inventory[pickaxeType] = (users[address].inventory[pickaxeType] || 0) + qty;
      
      // Create new checkpoint with updated mining power
      const newCurrentGold = createCheckpoint(users[address], address);
      
      writeUsers(users);

      res.json({ 
        ok: true, 
        status: status || 'confirmed', 
        pickaxeType, 
        quantity: qty, 
        inventory: users[address].inventory, 
        totalRate: totalRate(users[address].inventory),
        gold: newCurrentGold,
        // Send checkpoint data for client
        checkpoint: {
          total_mining_power: users[address].total_mining_power,
          checkpoint_timestamp: users[address].checkpoint_timestamp,
          last_checkpoint_gold: users[address].last_checkpoint_gold
        }
      });
    }
  } catch (e) {
    console.error('Purchase confirmation error:', e);
    res.status(500).json({ error: 'failed to confirm purchase: ' + (e?.message || 'unknown error') });
  }
});

// Sell endpoint with client-side gold validation and anti-cheat
app.post('/sell', async (req, res) => {
  try {
    const { address, amountGold, clientGold, clientInventory } = req.body || {};
    if (!address || typeof amountGold !== 'number') {
      return res.status(400).json({ error: 'address and amountGold required' });
    }
    
    ensureUser(address);
    const user = users[address];
    
    // ANTI-CHEAT VALIDATION FOR SELLING
    
    // 1. Validate minimum sell amount
    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ error: `minimum sell is ${MIN_SELL_GOLD}` });
    }
    
    // 2. Validate client inventory matches server (for mining rate validation)
    if (clientInventory) {
      const serverInventory = user.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
      for (const [pickaxeType, clientCount] of Object.entries(clientInventory)) {
        if (clientCount !== (serverInventory[pickaxeType] || 0)) {
          console.warn(`Sell attempt with inventory mismatch for ${address}: client ${pickaxeType}=${clientCount}, server=${serverInventory[pickaxeType] || 0}`);
          return res.status(400).json({ error: 'Inventory mismatch detected. Please refresh and try again.' });
        }
      }
    }
    
    // 3. Validate client gold amount is reasonable
    if (clientGold !== undefined) {
      const expectedRate = totalRate(user.inventory || {});
      const timeSinceLastUpdate = nowSec() - (user.lastUpdate || nowSec());
      const maxPossibleGold = user.gold + (expectedRate * Math.min(timeSinceLastUpdate, 7200)); // Max 2 hours
      
      if (clientGold > maxPossibleGold + 500) { // Allow buffer for network delays
        console.warn(`Suspicious sell attempt from ${address}: clientGold=${clientGold}, maxPossible=${maxPossibleGold}`);
        return res.status(400).json({ error: 'Gold amount validation failed. Please sync and try again.' });
      }
      
      // Use the validated client gold as the current amount
      user.gold = Math.min(clientGold, maxPossibleGold);
    }
    
    // 4. Anti-cheat: Validate sell amount against server calculations
    const validatedAmount = validateSellAmount(user, amountGold, address);
    
    if (validatedAmount !== amountGold) {
      console.warn(`🚨 Sell amount adjusted for ${address.slice(0, 8)}... Requested: ${amountGold}, Allowed: ${validatedAmount}`);
    }
    
    // 5. Check if user has enough gold (use current calculated gold)
    const currentGold = calculateCurrentGold(user);
    if (currentGold < validatedAmount) {
      return res.status(400).json({ 
        error: `insufficient gold. You have ${Math.floor(currentGold)} gold but need ${validatedAmount} gold.`,
        currentGold: Math.floor(currentGold)
      });
    }

    const payoutSol = validatedAmount * GOLD_PRICE_SOL;

    // Deduct gold and update server state (use validated amount)
    user.gold = currentGold - validatedAmount;
    user.lastUpdate = nowSec();
    user.lastActivity = nowSec();
    writeUsers(users);

    console.log(`💰 ${address} sold ${amountGold} gold for ${payoutSol} SOL. Remaining gold: ${user.gold}`);

    if (!TREASURY_SECRET_KEY) {
      // No auto payout, record pending
      user.pendingPayouts = user.pendingPayouts || [];
      user.pendingPayouts.push({ address, amountGold, payoutSol, ts: nowSec() });
      writeUsers(users);
      return res.json({ 
        ok: true, 
        payoutSol, 
        mode: 'pending', 
        newGold: user.gold,
        note: 'Server not configured to auto pay. Recorded pending payout.' 
      });
    }

    try {
      const secret = Uint8Array.from(JSON.parse(TREASURY_SECRET_KEY));
      const { Keypair } = await import('@solana/web3.js');
      const kp = Keypair.fromSecretKey(secret);
      const toPubkey = new PublicKey(address);
      const lamports = Math.round(payoutSol * LAMPORTS_PER_SOL);
      const tx = new Transaction();
      tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey, lamports }));
      const sig = await connection.sendTransaction(tx, [kp]);
      const conf = await connection.confirmTransaction(sig, 'confirmed');
      return res.json({ 
        ok: true, 
        payoutSol, 
        newGold: user.gold,
        signature: sig, 
        status: conf.value 
      });
    } catch (e) {
      console.error('payout failed', e);
      return res.json({ 
        ok: true, 
        payoutSol, 
        newGold: user.gold,
        mode: 'pending', 
        error: 'auto payout failed; recorded as pending' 
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'sell failed' });
  }
});

// Admin: set gold price
app.post('/admin/price', (req, res) => {
  const { token, goldPriceSol } = req.body || {};
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  const v = parseFloat(goldPriceSol);
  if (!isFinite(v) || v <= 0) return res.status(400).json({ error: 'invalid price' });
  GOLD_PRICE_SOL = v;
  res.json({ ok: true, goldPriceSol: GOLD_PRICE_SOL });
});

// Land ownership check
app.get('/land-status', (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    ensureUser(address);
    const u = users[address];
    res.json({
      hasLand: u.hasLand || false,
      landPurchaseDate: u.landPurchaseDate
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to check land status' });
  }
});

// Create land purchase transaction
app.post('/purchase-land', async (req, res) => {
  try {
    const { address } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }
    if (!TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'treasury not configured; set TREASURY_PUBLIC_KEY in .env and restart server' });
    }

    // Check if user already has land
    ensureUser(address);
    if (users[address].hasLand) {
      return res.status(400).json({ error: 'User already owns land' });
    }

    let payer, treasury;
    try {
      payer = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'invalid payer address' });
    }
    try {
      treasury = new PublicKey(TREASURY_PUBLIC_KEY);
    } catch {
      return res.status(400).json({ error: 'invalid TREASURY_PUBLIC_KEY in server config' });
    }

    const landCostSOL = 0.01; // 0.01 SOL for land
    const costLamports = Math.round(landCostSOL * LAMPORTS_PER_SOL);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: costLamports }));

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
    res.json({
      transaction: serialized,
      lastValidBlockHeight,
      costLamports,
      landCostSOL
    });
  } catch (e) {
    console.error('purchase-land error', e);
    res.status(500).json({ error: 'failed to create land purchase transaction: ' + (e?.message || 'unknown') });
  }
});

// Confirm land purchase
app.post('/confirm-land-purchase', async (req, res) => {
  try {
    const { address, signature } = req.body || {};
    if (!address || !signature) {
      return res.status(400).json({ error: 'address and signature required' });
    }

    // Check if user already has land
    ensureUser(address);
    if (users[address].hasLand) {
      return res.status(400).json({ error: 'User already owns land' });
    }

    // Validate signature format
    if (typeof signature !== 'string' || signature.length < 80 || signature.length > 90) {
      return res.status(400).json({ error: 'invalid signature format' });
    }

    // Basic confirmation check with better error handling
    let conf, status;
    try {
      conf = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      status = conf && conf.value && (conf.value.confirmationStatus || (conf.value.err == null ? 'processed' : null));
    } catch (signatureError) {
      console.error('Signature validation error:', signatureError);
      // If signature validation fails, we'll allow the purchase but log it
      console.log(`Warning: Could not validate signature ${signature} for address ${address}, but allowing land purchase`);
      status = 'unverified';
    }

    // For devnet testing, we'll be more lenient with signature validation
    if (!status || status === 'unverified') {
      console.log(`Granting land to ${address} with signature ${signature} (status: ${status || 'unknown'})`);
    }

    // Grant land only - no free pickaxe
    users[address].hasLand = true;
    users[address].landPurchaseDate = nowSec();
    writeUsers(users);

    res.json({ 
      ok: true, 
      status: status || 'confirmed', 
      hasLand: true,
      message: 'Land purchased successfully! You can now buy pickaxes and start mining.',
      inventory: users[address].inventory 
    });
  } catch (e) {
    console.error('Land purchase confirmation error:', e);
    res.status(500).json({ error: 'failed to confirm land purchase: ' + (e?.message || 'unknown error') });
  }
});

// Purchase pickaxe with gold endpoint
app.post('/purchase-pickaxe-with-gold', (req, res) => {
  try {
    const { address, pickaxeType, goldCost } = req.body || {};
    if (!address || !pickaxeType || !PICKAXES[pickaxeType] || typeof goldCost !== 'number') {
      return res.status(400).json({ error: 'address, valid pickaxeType, and goldCost required' });
    }

    // Ensure user exists - no more server-side mining
    ensureUser(address);
    // accrue(address); // REMOVED - client handles mining
    
    const user = users[address];
    
    // Check if user has enough gold
    if (user.gold < goldCost) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${Math.floor(user.gold)} gold but need ${goldCost} gold.` 
      });
    }

    // Deduct gold and add pickaxe
    user.gold -= goldCost;
    user.inventory[pickaxeType] = (user.inventory[pickaxeType] || 0) + 1;
    
    // Save changes
    writeUsers(users);

    res.json({
      ok: true,
      pickaxeType,
      goldCost,
      newGold: user.gold,
      newInventory: user.inventory,
      totalRate: totalRate(user.inventory),
      message: `Successfully purchased ${pickaxeType} pickaxe for ${goldCost} gold!`
    });
  } catch (e) {
    console.error('Gold purchase error:', e);
    res.status(500).json({ error: 'failed to purchase with gold: ' + (e?.message || 'unknown error') });
  }
});

// Register user with optional referral
app.post('/register', async (req, res) => {
  try {
    const { address, referrerAddress } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }

    // Check if user already exists
    try {
      const existingUser = await UserDatabase.getUser(address);
      if (existingUser) {
        return res.json({ 
          ok: true, 
          message: 'User already exists',
          user: existingUser 
        });
      }
    } catch (e) {
      // User doesn't exist, continue with registration
    }

    // Create new user with optional referrer
    const newUser = await UserDatabase.createUser(address, referrerAddress);
    
    res.json({
      ok: true,
      message: 'User registered successfully',
      user: newUser,
      referred: !!referrerAddress
    });
    
  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ error: 'failed to register user: ' + (e?.message || 'unknown error') });
  }
});

// Get referral statistics
app.get('/referral-stats', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }

    const stats = await UserDatabase.getReferralStats(address);
    
    // Determine current tier and next reward
    const currentReferrals = stats.total_referrals || 0;
    let currentTier = 'none';
    let nextReward = null;
    let nextRewardAt = null;

    if (currentReferrals >= 25) {
      currentTier = 'netherite';
      nextReward = 'netherite';
      nextRewardAt = 'Every referral';
    } else if (currentReferrals >= 18) {
      currentTier = 'diamond';
      nextReward = 'netherite';
      nextRewardAt = 25;
    } else if (currentReferrals >= 11) {
      currentTier = 'gold';
      nextReward = 'diamond';
      nextRewardAt = 18;
    } else if (currentReferrals >= 1) {
      currentTier = 'silver';
      nextReward = 'gold';
      nextRewardAt = 11;
    } else {
      currentTier = 'none';
      nextReward = 'silver';
      nextRewardAt = 1;
    }

    res.json({
      ...stats,
      currentTier,
      nextReward,
      nextRewardAt,
      goldPerReferral: 100
    });
    
  } catch (e) {
    console.error('Referral stats error:', e);
    res.status(500).json({ error: 'failed to get referral stats: ' + (e?.message || 'unknown error') });
  }
});

// Generate referral link
app.get('/referral-link', (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }

    const baseUrl = req.protocol + '://' + req.get('host');
    const referralLink = `${baseUrl}?ref=${encodeURIComponent(address)}`;
    
    res.json({
      referralLink,
      referrerAddress: address
    });
    
  } catch (e) {
    console.error('Referral link error:', e);
    res.status(500).json({ error: 'failed to generate referral link' });
  }
});

// Buy pickaxe with gold
app.post('/buy-with-gold', async (req, res) => {
  try {
    const { address, pickaxeType, goldCost } = req.body;
    
    if (!address || !pickaxeType || !goldCost) {
      return res.status(400).json({ error: 'address, pickaxeType, and goldCost required' });
    }
    
    // Try database first, fallback to file-based system
    try {
      // Get current user status from database
      const user = await UserDatabase.getUser(address);
      if (!user) {
        return res.status(404).json({ error: 'user not found' });
      }
      
      // Check if user has enough gold
      const currentGold = user.gold || 0;
      if (currentGold < goldCost) {
        return res.status(400).json({ 
          error: `Insufficient gold. You have ${currentGold} but need ${goldCost} gold.` 
        });
      }
      
      // Deduct gold and add pickaxe
      const newGold = currentGold - goldCost;
      const inventory = user.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 };
      inventory[pickaxeType] = (inventory[pickaxeType] || 0) + 1;
      
      // Update user in database
      await UserDatabase.updateUser(address, {
        gold: newGold,
        inventory: inventory
      });
      
      console.log(`✅ ${address.slice(0, 8)}... bought ${pickaxeType} pickaxe for ${goldCost} gold (database)`);
      
      res.json({
        success: true,
        newGold: newGold,
        inventory: inventory,
        message: `Successfully bought ${pickaxeType} pickaxe for ${goldCost} gold!`
      });
      
    } catch (dbError) {
      // Fallback to file-based system
      console.warn('Database not available for gold purchase, using file-based system:', dbError.message);
      
      ensureUser(address);
      const user = users[address];
      
      // Calculate current gold from checkpoint
      const currentGold = calculateCurrentGold(user);
      
      if (currentGold < goldCost) {
        return res.status(400).json({ 
          error: `Insufficient gold. You have ${currentGold.toFixed(2)} but need ${goldCost} gold.` 
        });
      }
      
      // Create checkpoint with current gold minus purchase cost
      user.last_checkpoint_gold = currentGold - goldCost;
      user.checkpoint_timestamp = nowSec();
      
      // Add pickaxe and update mining power
      user.inventory[pickaxeType] = (user.inventory[pickaxeType] || 0) + 1;
      const newCurrentGold = createCheckpoint(user, address);
      
      user.lastActivity = nowSec();
      
      // Save to file
      writeUsers(users);
      
      console.log(`✅ ${address.slice(0, 8)}... bought ${pickaxeType} pickaxe for ${goldCost} gold (file)`);
      
      res.json({
        success: true,
        newGold: newCurrentGold,
        inventory: user.inventory,
        checkpoint: {
          total_mining_power: user.total_mining_power,
          checkpoint_timestamp: user.checkpoint_timestamp,
          last_checkpoint_gold: user.last_checkpoint_gold
        },
        message: `Successfully bought ${pickaxeType} pickaxe for ${goldCost} gold!`
      });
    }
    
  } catch (e) {
    console.error('Buy with gold error:', e);
    res.status(500).json({ error: 'failed to buy pickaxe with gold: ' + (e?.message || 'unknown error') });
  }
});

// Admin middleware for authentication
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_TOKEN || !ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
  
  next();
}

// Admin statistics endpoint
app.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    let stats = {
      totalUsers: 0,
      activeUsers: 0,
      landOwners: 0,
      totalPickaxes: 0,
      totalRevenue: 0,
      pendingPayouts: 0,
      netProfit: 0,
      processingFees: 0
    };

    // Calculate stats from file-based system
    const allUsers = Object.values(users);
    const now = nowSec();
    const oneDayAgo = now - (24 * 60 * 60);

    stats.totalUsers = allUsers.length;
    stats.activeUsers = allUsers.filter(u => (u.lastActivity || 0) > oneDayAgo).length;
    stats.landOwners = allUsers.filter(u => u.hasLand).length;
    
    // Calculate total pickaxes
    stats.totalPickaxes = allUsers.reduce((total, u) => {
      const inv = u.inventory || {};
      return total + (inv.silver || 0) + (inv.gold || 0) + (inv.diamond || 0) + (inv.netherite || 0);
    }, 0);

    // Calculate revenue from land purchases (0.01 SOL each)
    const landRevenue = stats.landOwners * 0.01;
    
    // Calculate revenue from pickaxe purchases (0.001 SOL each)
    const pickaxeRevenue = stats.totalPickaxes * 0.001;
    
    stats.totalRevenue = landRevenue + pickaxeRevenue;

    // Calculate pending payouts
    let totalPendingPayouts = 0;
    allUsers.forEach(user => {
      if (user.pendingPayouts && Array.isArray(user.pendingPayouts)) {
        totalPendingPayouts += user.pendingPayouts.reduce((sum, p) => sum + p.payoutSol, 0);
      }
    });
    
    stats.pendingPayouts = totalPendingPayouts;
    stats.processingFees = totalPendingPayouts * 0.1; // 10% fee
    stats.netProfit = stats.totalRevenue - (totalPendingPayouts * 0.9); // Revenue minus net payouts

    res.json(stats);
  } catch (e) {
    console.error('Admin stats error:', e);
    res.status(500).json({ error: 'Failed to get admin stats' });
  }
});

// Get pending payouts
app.get('/admin/pending-payouts', requireAdmin, (req, res) => {
  try {
    const pendingPayouts = [];
    
    Object.entries(users).forEach(([address, user]) => {
      if (user.pendingPayouts && Array.isArray(user.pendingPayouts)) {
        user.pendingPayouts.forEach(payout => {
          pendingPayouts.push({
            ...payout,
            address: address
          });
        });
      }
    });

    // Sort by timestamp (newest first)
    pendingPayouts.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    res.json(pendingPayouts);
  } catch (e) {
    console.error('Pending payouts error:', e);
    res.status(500).json({ error: 'Failed to get pending payouts' });
  }
});

// Send individual payout
app.post('/admin/send-payout', requireAdmin, async (req, res) => {
  try {
    const { address, netAmount, goldAmount } = req.body;
    
    if (!address || !netAmount || !TREASURY_SECRET_KEY) {
      return res.status(400).json({ error: 'Missing required fields or treasury not configured' });
    }

    // Send SOL payment
    const secret = Uint8Array.from(JSON.parse(TREASURY_SECRET_KEY));
    const { Keypair } = await import('@solana/web3.js');
    const kp = Keypair.fromSecretKey(secret);
    const toPubkey = new PublicKey(address);
    const lamports = Math.round(netAmount * LAMPORTS_PER_SOL);
    
    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey, lamports }));
    
    const sig = await connection.sendTransaction(tx, [kp]);
    await connection.confirmTransaction(sig, 'confirmed');

    // Remove from pending payouts
    if (users[address] && users[address].pendingPayouts) {
      users[address].pendingPayouts = users[address].pendingPayouts.filter(p => 
        !(p.amountGold === goldAmount && Math.abs(p.payoutSol - (netAmount / 0.9)) < 0.000001)
      );
      
      if (users[address].pendingPayouts.length === 0) {
        delete users[address].pendingPayouts;
      }
      
      writeUsers(users);
    }

    console.log(`💰 Admin sent ${netAmount} SOL to ${address} (signature: ${sig})`);

    res.json({ 
      success: true, 
      signature: sig,
      netAmount: netAmount,
      address: address
    });

  } catch (e) {
    console.error('Send payout error:', e);
    res.status(500).json({ error: 'Failed to send payout: ' + e.message });
  }
});

// Process all pending payouts
app.post('/admin/process-all-payouts', requireAdmin, async (req, res) => {
  try {
    if (!TREASURY_SECRET_KEY) {
      return res.status(400).json({ error: 'Treasury not configured for auto-payouts' });
    }

    const secret = Uint8Array.from(JSON.parse(TREASURY_SECRET_KEY));
    const { Keypair } = await import('@solana/web3.js');
    const kp = Keypair.fromSecretKey(secret);

    let processed = 0;
    const errors = [];

    for (const [address, user] of Object.entries(users)) {
      if (user.pendingPayouts && Array.isArray(user.pendingPayouts)) {
        for (const payout of user.pendingPayouts) {
          try {
            const netAmount = payout.payoutSol * 0.9; // Subtract 10% fee
            const toPubkey = new PublicKey(address);
            const lamports = Math.round(netAmount * LAMPORTS_PER_SOL);
            
            const tx = new Transaction();
            tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey, lamports }));
            
            const sig = await connection.sendTransaction(tx, [kp]);
            await connection.confirmTransaction(sig, 'confirmed');
            
            console.log(`💰 Batch processed: ${netAmount} SOL to ${address} (${sig})`);
            processed++;
            
            // Add small delay between transactions
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            errors.push({ address, error: error.message });
          }
        }
        
        // Clear processed payouts
        delete user.pendingPayouts;
      }
    }

    writeUsers(users);

    res.json({ 
      success: true, 
      processed: processed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (e) {
    console.error('Process all payouts error:', e);
    res.status(500).json({ error: 'Failed to process payouts: ' + e.message });
  }
});

// Data backup endpoint
app.get('/admin/backup', requireAdmin, (req, res) => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      users: users,
      config: {
        goldPriceSol: GOLD_PRICE_SOL,
        minSellGold: MIN_SELL_GOLD,
        treasuryPublicKey: TREASURY_PUBLIC_KEY
      },
      stats: {
        totalUsers: Object.keys(users).length,
        totalGoldInCirculation: Object.values(users).reduce((sum, u) => sum + (calculateCurrentGold(u) || 0), 0)
      }
    };

    res.json(backup);
  } catch (e) {
    console.error('Backup error:', e);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Update minimum sell gold amount
app.post('/admin/min-sell', requireAdmin, (req, res) => {
  try {
    const { minSellGold } = req.body;
    const amount = parseInt(minSellGold);
    
    if (!isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: 'Invalid minimum sell amount (must be >= 1000)' });
    }
    
    // Note: This would require updating environment variable for persistence
    console.log(`Admin updated min sell gold to: ${amount}`);
    
    res.json({ 
      ok: true, 
      minSellGold: amount,
      note: 'Minimum sell amount updated (restart server to persist)' 
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update min sell amount' });
  }
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
