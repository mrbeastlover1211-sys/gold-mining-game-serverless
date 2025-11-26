// Use same working pattern as status.js
import { getUserOptimized, saveUserOptimized } from '../database.js';

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

    if (pickaxeType !== 'silver' && pickaxeType !== 'gold') {
      return res.status(400).json({ error: 'Invalid pickaxe type' });
    }
    
    // Get user data using the same method as status.js
    let user;
    try {
      user = await getUserOptimized(address);
      console.log(`🔍 Buy API getUserOptimized result:`, {
        found: !!user,
        has_land: user?.has_land,
        address: user?.address?.slice(0, 8)
      });
    } catch (dbError) {
      console.error(`❌ Buy API database error:`, dbError.message);
      return res.status(500).json({
        error: 'Database error in buy API',
        details: dbError.message
      });
    }
    
    if (!user) {
      return res.status(400).json({ error: 'User not found. Please connect wallet and refresh.' });
    }

    if (!user.has_land) {
      return res.status(400).json({ error: 'You need to purchase land first!' });
    }
    
    // Calculate current gold using same method as status.js
    const currentTime = Math.floor(Date.now() / 1000);
    const checkpointTime = user.checkpoint_timestamp || currentTime;
    const timeSinceCheckpoint = currentTime - checkpointTime;
    const miningPower = user.total_mining_power || 0;
    const goldPerSecond = miningPower / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const baseGold = parseFloat(user.last_checkpoint_gold || 0);
    const currentGold = baseGold + goldMined;
    
    console.log(`💰 Gold calculation debug:`, {
      baseGold,
      goldMined,
      currentGold,
      timeSinceCheckpoint,
      miningPower,
      goldCost
    });
    
    if (currentGold < goldCost) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${currentGold.toFixed(2)} but need ${goldCost} gold.` 
      });
    }
    
    // Update inventory based on pickaxe type
    const newGold = currentGold - goldCost;
    if (pickaxeType === 'silver') {
      user.silver_pickaxes = (user.silver_pickaxes || 0) + 1;
    } else if (pickaxeType === 'gold') {
      user.gold_pickaxes = (user.gold_pickaxes || 0) + 1;
    }
    
    // Calculate new mining power
    const silverCount = user.silver_pickaxes || 0;
    const goldCount = user.gold_pickaxes || 0;
    const diamondCount = user.diamond_pickaxes || 0;
    const netheriteCount = user.netherite_pickaxes || 0;
    
    const newMiningPower = silverCount * 1 + 
                          goldCount * 10 + 
                          diamondCount * 100 + 
                          netheriteCount * 1000;
    
    // Update user data
    user.total_mining_power = newMiningPower;
    user.checkpoint_timestamp = currentTime;
    user.last_checkpoint_gold = newGold;
    user.last_activity = currentTime;
    
    console.log(`🔄 Updating user after purchase:`, {
      silver: user.silver_pickaxes,
      gold: user.gold_pickaxes,
      newGold: newGold.toFixed(2),
      newMiningPower
    });
    
    // Save user data using same method as status.js
    await saveUserOptimized(address, user);
    
    console.log(`✅ ${address.slice(0, 8)}... bought ${pickaxeType} pickaxe for ${goldCost} gold`);
    
    // Create inventory object for response
    const inventory = {
      silver: user.silver_pickaxes || 0,
      gold: user.gold_pickaxes || 0,
      diamond: user.diamond_pickaxes || 0,
      netherite: user.netherite_pickaxes || 0
    };
    
    res.json({
      success: true,
      newGold: newGold,
      inventory: inventory,
      checkpoint: {
        total_mining_power: newMiningPower,
        checkpoint_timestamp: currentTime,
        last_checkpoint_gold: newGold
      },
      message: `Successfully bought ${pickaxeType} pickaxe for ${goldCost} gold!`
    });
    
  } catch (e) {
    console.error('❌ Buy API main catch block error:', e.message);
    console.error('❌ Full error:', e);
    console.error('❌ Stack trace:', e.stack);
    
    res.status(500).json({
      error: 'Buy API error',
      details: e.message,
      stack: e.stack?.split('\n').slice(0, 5)
    });
  }
}