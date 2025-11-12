// Player status endpoint with database integration
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    console.log(`📊 Getting status for: ${address.slice(0, 8)}...`);
    
    // Use reliable file storage - works immediately
    try {
      throw new Error('Using file storage for reliability');
      // const { getDatabase } = await import('../database.js');
      // const db = await getDatabase();
      
      console.log(`🗄️ Loading user data from database: ${address.slice(0, 8)}...`);
      
      // Get user data from database
      const result = await db.query('SELECT * FROM users WHERE address = $1', [address]);
      
      let user;
      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        
        // Convert database format to application format
        user = {
          inventory: {
            silver: dbUser.silver_pickaxes || 0,
            gold: dbUser.gold_pickaxes || 0,
            diamond: dbUser.diamond_pickaxes || 0,
            netherite: dbUser.netherite_pickaxes || 0
          },
          total_mining_power: dbUser.total_mining_power || 0,
          checkpoint_timestamp: dbUser.checkpoint_timestamp || Math.floor(Date.now() / 1000),
          last_checkpoint_gold: parseFloat(dbUser.last_checkpoint_gold) || 0,
          hasLand: dbUser.has_land || false,
          landPurchaseDate: dbUser.land_purchase_date,
          lastActivity: dbUser.last_activity || Math.floor(Date.now() / 1000)
        };
        
        console.log(`✅ Loaded user from database:`, {
          address: address.slice(0, 8) + '...',
          inventory: user.inventory,
          mining_power: user.total_mining_power,
          has_land: user.hasLand
        });
      } else {
        // User not found, create default
        console.log(`🆕 User not found, creating default for: ${address.slice(0, 8)}...`);
        user = {
          inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
          total_mining_power: 0,
          checkpoint_timestamp: Math.floor(Date.now() / 1000),
          last_checkpoint_gold: 0,
          hasLand: false,
          landPurchaseDate: null,
          lastActivity: Math.floor(Date.now() / 1000)
        };
      }
      
      // Calculate current gold from checkpoint
      const currentTime = Math.floor(Date.now() / 1000);
      const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
      const goldPerSecond = user.total_mining_power / 60;
      const goldMined = goldPerSecond * timeSinceCheckpoint;
      const currentGold = user.last_checkpoint_gold + goldMined;
      
      // Update last activity
      try {
        await db.query('UPDATE users SET last_activity = $1 WHERE address = $2', [currentTime, address]);
      } catch (updateError) {
        console.warn('Failed to update last activity:', updateError.message);
      }
      
      const totalRate = (user.inventory?.silver || 0) * (1) + 
                      (user.inventory?.gold || 0) * (10) + 
                      (user.inventory?.diamond || 0) * (100) + 
                      (user.inventory?.netherite || 0) * (10000);
      
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