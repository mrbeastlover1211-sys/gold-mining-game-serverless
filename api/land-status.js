export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Use OptimizedDatabase with correct column names
    try {
      const { getUserOptimized } = await import('../database.js');
      
      console.log(`🔍 Checking land status for ${address.slice(0, 8)}...`);
      
      // IMPORTANT: Fetch fresh from DB (no cache) to avoid stale memory/Redis showing ghost land
      // especially after manual DB cleanup operations.
      const userData = await getUserOptimized(address, false);
      
      if (!userData) {
        console.log(`📊 No user found for ${address.slice(0, 8)}...`);
        return res.json({
          hasLand: false,
          landPurchaseDate: null,
          debug: {
            user_exists: false,
            system: 'OptimizedDatabase'
          }
        });
      }
      
      console.log(`📊 User data from OptimizedDatabase:`, {
        address: address.slice(0, 8) + '...',
        has_land: userData.has_land,
        land_purchase_date: userData.land_purchase_date,
        created_at: userData.created_at
      });
      
      return res.json({
        hasLand: userData.has_land || false,
        landPurchaseDate: userData.land_purchase_date,
        debug: {
          user_exists: true,
          raw_has_land: userData.has_land,
          land_purchase_date: userData.land_purchase_date,
          system: 'OptimizedDatabase'
        }
      });
      
    } catch (dbError) {
      console.error('❌ Database error in land-status:', dbError.message);
      console.error('Stack trace:', dbError.stack);
      
      // Fallback to in-memory storage
      global.users = global.users || {};
      
      if (!global.users[address]) {
        global.users[address] = {
          inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
          hasLand: false,
          landPurchaseDate: null
        };
      }
      
      const user = global.users[address];
      
      return res.json({
        hasLand: user.hasLand || false,
        landPurchaseDate: user.landPurchaseDate
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to check land status' });
  }
}