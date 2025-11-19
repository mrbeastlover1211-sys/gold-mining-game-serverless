// Import database functions directly
import { getDatabase } from '../database.js';

// Constants for pickaxe rates
const PICKAXES = {
  silver: { name: 'Silver', ratePerSec: 1/60 },
  gold: { name: 'Gold', ratePerSec: 10/60 },
};

function nowSec() { 
  return Math.floor(Date.now() / 1000); 
}

function totalRate(inv) {
  let r = 0;
  for (const k of Object.keys(PICKAXES)) {
    r += (inv[k] || 0) * PICKAXES[k].ratePerSec;
  }
  return r;
}

function calculateCurrentGold(user) {
  if (!user.checkpoint_timestamp || !user.total_mining_power) {
    return user.last_checkpoint_gold || 0;
  }
  
  const currentTime = nowSec();
  const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
  const goldPerSecond = user.total_mining_power / 60;
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  
  return user.last_checkpoint_gold + goldMined;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, pickaxeType, goldCost } = req.body;
    
    console.log(`🛒 Buy request: ${pickaxeType} for ${goldCost} gold from ${address?.slice(0, 8)}...`);
    
    if (!address || !pickaxeType || !goldCost) {
      return res.status(400).json({ error: 'address, pickaxeType, and goldCost required' });
    }

    if (!PICKAXES[pickaxeType]) {
      return res.status(400).json({ error: 'Invalid pickaxe type' });
    }
    
    // Get database connection
    const db = await getDatabase();
    
    // Get user data
    const userResult = await db.query(
      'SELECT * FROM users WHERE wallet = $1',
      [address]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'User not found. Please connect wallet and refresh.' });
    }
    
    const user = userResult.rows[0];
    const currentGold = calculateCurrentGold({
      checkpoint_timestamp: user.checkpoint_timestamp,
      total_mining_power: user.total_mining_power,
      last_checkpoint_gold: user.last_checkpoint_gold
    });
    
    console.log(`💰 User gold: ${currentGold.toFixed(2)}, Required: ${goldCost}`);
    
    if (currentGold < goldCost) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${currentGold.toFixed(2)} but need ${goldCost} gold.` 
      });
    }
    
    // Update inventory
    const newInventory = { ...user.inventory };
    newInventory[pickaxeType] = (newInventory[pickaxeType] || 0) + 1;
    
    // Calculate new mining power
    const newMiningPower = totalRate(newInventory) * 60;
    const newGold = currentGold - goldCost;
    const currentTime = nowSec();
    
    // Update database
    await db.query(
      `UPDATE users SET 
       inventory = $1, 
       total_mining_power = $2, 
       checkpoint_timestamp = $3, 
       last_checkpoint_gold = $4, 
       last_activity = $5
       WHERE wallet = $6`,
      [newInventory, newMiningPower, currentTime, newGold, currentTime, address]
    );
    
    console.log(`✅ ${address.slice(0, 8)}... bought ${pickaxeType} pickaxe for ${goldCost} gold`);
    
    res.json({
      success: true,
      newGold: newGold,
      inventory: newInventory,
      checkpoint: {
        total_mining_power: newMiningPower,
        checkpoint_timestamp: currentTime,
        last_checkpoint_gold: newGold
      },
      message: `Successfully bought ${pickaxeType} pickaxe for ${goldCost} gold!`
    });
    
  } catch (e) {
    console.error('Buy with gold error:', e);
    res.status(500).json({ error: 'Failed to buy pickaxe with gold: ' + (e?.message || 'unknown error') });
  }
}