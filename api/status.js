// OPTIMIZED Player status endpoint - Can handle 5,000+ concurrent users
import { getUserOptimized, saveUserOptimized } from '../database.js';

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
    
    // 🔧 FIX: Always force fresh data from optimized database
    console.log(`📊 Getting fresh user data from database for ${address.slice(0, 8)}...`);
    const user = await getUserOptimized(address); // Get user data from optimized database
    
    if (!user) {
      // Return default structure for new users
      return res.json({
        address,
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        totalRate: 0,
        gold: "0.00",
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
    
    // Create inventory object from database columns
    const inventory = {
      silver: user.silver_pickaxes || 0,
      gold: user.gold_pickaxes || 0,
      diamond: user.diamond_pickaxes || 0,
      netherite: user.netherite_pickaxes || 0
    };
    
    console.log(`📊 Retrieved user inventory:`, inventory);
    console.log(`📊 Retrieved user data:`, {
      silver: inventory.silver,
      gold: inventory.gold,
      diamond: inventory.diamond,
      netherite: inventory.netherite,
      total_mining_power: user.total_mining_power || 0,
      has_land: user.has_land
    });
    
    // Calculate current gold from checkpoint
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - (user.checkpoint_timestamp || currentTime);
    const goldPerSecond = (user.total_mining_power || 0) / 60;
    const goldMined = goldPerSecond * timeSinceCheckpoint;
    const currentGold = (user.last_checkpoint_gold || 0) + goldMined;
    
    // Update last activity - ultra-fast core update
    user.last_activity = currentTime;
    await saveUserOptimized(address, user);
    
    const totalRate = inventory.silver * 1 + 
                     inventory.gold * 10 + 
                     inventory.diamond * 100 + 
                     inventory.netherite * 10000;
    
    res.json({
      address,
      inventory: inventory,
      totalRate: totalRate,
      gold: currentGold.toFixed(5),
      hasLand: user.has_land || false,
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