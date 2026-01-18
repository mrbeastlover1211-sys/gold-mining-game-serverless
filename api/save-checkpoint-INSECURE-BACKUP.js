// Save checkpoint API - Creates new checkpoint only on user actions
import { getUserOptimized, saveUserOptimized } from '../database.js';

export default async function handler(req, res) {
  // Allow both POST and sendBeacon requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, gold, timestamp, finalSync } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    console.log(`💾 Creating checkpoint for ${address.slice(0, 8)}...`, {
      gold: parseFloat(gold).toFixed(2),
      timestamp,
      finalSync: !!finalSync
    });

    // Get current user data
    let user = await getUserOptimized(address, false); // No cache for checkpoint

    if (!user) {
      // New user - create with checkpoint
      user = {
        address,
        last_checkpoint_gold: parseFloat(gold) || 0,
        checkpoint_timestamp: timestamp || Math.floor(Date.now() / 1000),
        total_mining_power: 0,
        silver_pickaxes: 0,
        gold_pickaxes: 0,
        diamond_pickaxes: 0,
        netherite_pickaxes: 0,
        has_land: false
      };
    } else {
      // Validate gold amount is reasonable (prevent cheating)
      const timeSinceCheckpoint = timestamp - (user.checkpoint_timestamp || 0);
      const maxPossibleGold = (user.last_checkpoint_gold || 0) + 
                              ((user.total_mining_power || 0) / 60 * timeSinceCheckpoint * 1.1); // 10% buffer
      
      if (gold > maxPossibleGold && timeSinceCheckpoint > 0) {
        console.warn(`⚠️ Suspicious gold amount detected for ${address.slice(0, 8)}:`, {
          clientGold: gold,
          maxPossible: maxPossibleGold,
          timeSince: timeSinceCheckpoint
        });
        
        // Use the validated amount instead
        user.last_checkpoint_gold = Math.min(parseFloat(gold), maxPossibleGold);
      } else {
        user.last_checkpoint_gold = parseFloat(gold) || 0;
      }
      
      user.checkpoint_timestamp = timestamp || Math.floor(Date.now() / 1000);
    }

    // Save updated checkpoint
    const savedUser = await saveUserOptimized(address, user);

    console.log(`✅ Checkpoint saved for ${address.slice(0, 8)}:`, {
      gold: savedUser.last_checkpoint_gold,
      timestamp: savedUser.checkpoint_timestamp
    });

    res.json({
      success: true,
      checkpoint: {
        gold: savedUser.last_checkpoint_gold,
        timestamp: savedUser.checkpoint_timestamp,
        miningPower: savedUser.total_mining_power
      }
    });

  } catch (error) {
    console.error('❌ Save checkpoint error:', error);
    res.status(500).json({
      error: 'Failed to save checkpoint',
      details: error.message
    });
  }
}
