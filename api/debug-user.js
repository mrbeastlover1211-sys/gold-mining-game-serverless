// Debug endpoint to check user data in database
import { OptimizedDatabase } from '../database-optimized.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address parameter required' });
    }

    console.log(`🔍 DEBUG: Checking database for user: ${address.slice(0, 8)}...`);
    
    // Get user from optimized database
    const user = await OptimizedDatabase.getUser(address);
    
    console.log(`📊 DEBUG: Raw user data from database:`, user);
    
    // Calculate current gold
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
    const goldPerSecond = user.total_mining_power / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const currentGold = user.last_checkpoint_gold + goldMined;
    
    // Calculate total pickaxes
    const totalPickaxes = (user.inventory?.silver || 0) + 
                         (user.inventory?.gold || 0) + 
                         (user.inventory?.diamond || 0) + 
                         (user.inventory?.netherite || 0);
    
    // Calculate mining power manually
    const calculatedMiningPower = 
      (user.inventory?.silver || 0) * 1 + 
      (user.inventory?.gold || 0) * 10 + 
      (user.inventory?.diamond || 0) * 100 + 
      (user.inventory?.netherite || 0) * 10000;
    
    const debugInfo = {
      address,
      database_data: {
        raw_inventory: user.inventory,
        total_mining_power: user.total_mining_power,
        checkpoint_timestamp: user.checkpoint_timestamp,
        last_checkpoint_gold: user.last_checkpoint_gold,
        hasLand: user.hasLand,
        lastActivity: user.lastActivity
      },
      calculated_data: {
        total_pickaxes: totalPickaxes,
        calculated_mining_power: calculatedMiningPower,
        current_gold: currentGold,
        time_since_checkpoint: timeSinceCheckpoint,
        gold_mined_since_checkpoint: goldMined
      },
      debug_checks: {
        has_inventory: !!user.inventory,
        inventory_is_object: typeof user.inventory === 'object',
        mining_power_matches: user.total_mining_power === calculatedMiningPower,
        has_recent_activity: (currentTime - user.lastActivity) < 300 // 5 minutes
      }
    };
    
    console.log(`🐛 DEBUG INFO for ${address.slice(0, 8)}:`, JSON.stringify(debugInfo, null, 2));
    
    res.json(debugInfo);
    
  } catch (error) {
    console.error('❌ Debug user error:', error);
    res.status(500).json({ 
      error: 'Failed to debug user', 
      details: error.message,
      stack: error.stack 
    });
  }
}