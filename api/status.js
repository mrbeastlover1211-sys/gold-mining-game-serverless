// Player status endpoint with database integration
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Try to import and use database
    let UserDatabase;
    try {
      const dbModule = await import('../database.js');
      UserDatabase = dbModule.default;
      
      console.log(`🗄️ Loading user data from database: ${address.slice(0, 8)}...`);
      
      const user = await UserDatabase.getUser(address);
      
      // Calculate current gold from checkpoint
      const currentGold = UserDatabase.calculateCurrentGold(user);
      
      // Update last activity in database
      await UserDatabase.updateUser(address, {
        lastActivity: Math.floor(Date.now() / 1000)
      });
      
      const totalRate = (user.inventory?.silver || 0) * (1/60) + 
                      (user.inventory?.gold || 0) * (10/60) + 
                      (user.inventory?.diamond || 0) * (100/60) + 
                      (user.inventory?.netherite || 0) * (10000/60);
      
      res.json({
        address,
        inventory: user.inventory,
        totalRate: totalRate,
        gold: currentGold,
        hasLand: user.hasLand || false,
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
      
    } catch (dbError) {
      console.warn('⚠️ Database error, using in-memory fallback:', dbError.message);
      
      // In-memory fallback
      global.users = global.users || {};
      
      if (!global.users[address]) {
        global.users[address] = { 
          inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 }, 
          total_mining_power: 0,
          checkpoint_timestamp: Math.floor(Date.now() / 1000),
          last_checkpoint_gold: 0,
          lastActivity: Math.floor(Date.now() / 1000),
          hasLand: false,
          landPurchaseDate: null
        };
      }
      
      const u = global.users[address];
      u.lastActivity = Math.floor(Date.now() / 1000);
      
      // Calculate current gold from checkpoint
      const currentTime = Math.floor(Date.now() / 1000);
      const timeSinceCheckpoint = currentTime - u.checkpoint_timestamp;
      const goldPerSecond = u.total_mining_power / 60;
      const goldMined = goldPerSecond * timeSinceCheckpoint;
      const currentGold = u.last_checkpoint_gold + goldMined;
      
      res.json({
        address,
        inventory: u.inventory,
        totalRate: u.total_mining_power / 60,
        gold: currentGold,
        hasLand: u.hasLand || false,
        checkpoint: {
          total_mining_power: u.total_mining_power || 0,
          checkpoint_timestamp: u.checkpoint_timestamp,
          last_checkpoint_gold: u.last_checkpoint_gold || 0
        },
        referralStats: {
          totalReferrals: 0,
          referralGoldEarned: 0,
          activeReferrals: 0
        }
      });
    }
  } catch (e) {
    console.error('Status error:', e);
    res.status(500).json({ error: 'status failed: ' + e.message });
  }
}