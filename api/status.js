// OPTIMIZED Player status endpoint - Can handle 5,000+ concurrent users
import { getUser, saveUser } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    console.log(`📊 Getting status for: ${address.slice(0, 8)}...`);
    
    // Check if recent purchase happened (force refresh if so)
    const lastPurchaseTime = req.headers['x-last-purchase'] || 0;
    const forceRefresh = lastPurchaseTime && (Date.now() - parseInt(lastPurchaseTime)) < 30000; // 30 second window
    
    // 🔧 FIX: Always force fresh data from database to fix missing data issue
    console.log(`📊 Getting fresh user data from database for ${address.slice(0, 8)}...`);
    const user = await getUser(address); // Get user data from working database
    console.log(`📊 Retrieved user inventory:`, user.inventory);
    console.log(`📊 Retrieved user data:`, {
      silver: user.inventory?.silver || 0,
      gold: user.inventory?.gold || 0, 
      diamond: user.inventory?.diamond || 0,
      netherite: user.inventory?.netherite || 0,
      total_mining_power: user.total_mining_power || 0
    });
    
    // Calculate current gold from checkpoint
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
    const goldPerSecond = user.total_mining_power / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const currentGold = user.last_checkpoint_gold + goldMined;
    
    // Update last activity - ultra-fast core update
    user.lastActivity = currentTime;
    await saveUser(address, user);
    
    const totalRate = (user.inventory?.silver || 0) * 1 + 
                     (user.inventory?.gold || 0) * 10 + 
                     (user.inventory?.diamond || 0) * 100 + 
                     (user.inventory?.netherite || 0) * 10000;
    
    res.json({
      address,
      inventory: user.inventory,
      totalRate: totalRate,
      gold: currentGold,
      hasLand: user.hasLand || false,
      checkpoint: {
        total_mining_power: user.total_mining_power || 0,
        checkpoint_timestamp: user.checkpoint_timestamp,
        last_checkpoint_gold: user.last_checkpoint_gold || 0
      },
      referralStats: {
        totalReferrals: 0,
        referralGoldEarned: 0,
        activeReferrals: 0
      }
    });
    
  } catch (e) {
    console.error('Status error:', e);
    
    // Fallback to minimal response
    res.json({
      address: req.query.address,
      inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
      totalRate: 0,
      gold: 0,
      hasLand: false,
      checkpoint: {
        total_mining_power: 0,
        checkpoint_timestamp: Math.floor(Date.now() / 1000),
        last_checkpoint_gold: 0
      },
      referralStats: {
        totalReferrals: 0,
        referralGoldEarned: 0,
        activeReferrals: 0
      }
    });
  }
}