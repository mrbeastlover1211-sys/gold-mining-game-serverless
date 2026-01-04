// Secure Save Checkpoint API
// Server calculates gold earned - client can't fake it!

import { sql } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body;

    if (!address || address.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    console.log(`💾 Save checkpoint request from: ${address.slice(0, 8)}...`);

    // 🔒 SECURITY: Get user data from DATABASE (not from client!)
    const users = await sql`
      SELECT 
        address,
        last_checkpoint_gold,
        checkpoint_timestamp,
        total_mining_power,
        silver_pickaxes,
        gold_pickaxes,
        diamond_pickaxes,
        netherite_pickaxes
      FROM users
      WHERE address = ${address}
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds

    // 🔒 SECURITY: Calculate gold based on TIME PASSED, not client data
    const lastCheckpointTime = parseInt(user.checkpoint_timestamp) || currentTime;
    const timePassed = currentTime - lastCheckpointTime; // Seconds passed
    
    // Validation: Don't allow negative time or extreme values
    if (timePassed < 0) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }
    
    // Limit to max 24 hours (86400 seconds) to prevent abuse
    const timePassedCapped = Math.min(timePassed, 86400);
    
    // Calculate gold earned: time (in minutes) × mining power
    const minutesPassed = timePassedCapped / 60;
    const goldEarned = minutesPassed * parseInt(user.total_mining_power || 0);
    
    // Round to 4 decimal places
    const goldEarnedRounded = Math.round(goldEarned * 10000) / 10000;
    
    // Calculate new total gold
    const previousGold = parseFloat(user.last_checkpoint_gold || 0);
    const newTotalGold = previousGold + goldEarnedRounded;

    console.log(`⏱️  Time passed: ${Math.floor(minutesPassed)} minutes`);
    console.log(`⚡ Mining power: ${user.total_mining_power}`);
    console.log(`💰 Gold earned: ${goldEarnedRounded}`);
    console.log(`💰 New total: ${newTotalGold}`);

    // 🔒 SECURITY: Update with SERVER-CALCULATED values only
    await sql`
      UPDATE users
      SET 
        last_checkpoint_gold = ${newTotalGold},
        checkpoint_timestamp = ${currentTime}
      WHERE address = ${address}
    `;

    console.log(`✅ Checkpoint saved for ${address.slice(0, 8)}...`);

    // Return the SERVER-CALCULATED values (client must accept these)
    return res.status(200).json({
      success: true,
      checkpoint: {
        gold: newTotalGold,
        goldEarned: goldEarnedRounded,
        timestamp: currentTime,
        timePassed: Math.floor(minutesPassed),
        miningPower: user.total_mining_power
      }
    });

  } catch (error) {
    console.error('❌ Save checkpoint error:', error);
    return res.status(500).json({ 
      error: 'Failed to save checkpoint',
      details: error.message 
    });
  }
}
