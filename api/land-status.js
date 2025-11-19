export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Use UltraOptimizedDatabase (same as all other endpoints)
    try {
      const { UltraOptimizedDatabase } = await import('../database-ultra-optimized.js');
      
      console.log(`🔍 Checking land status for ${address.slice(0, 8)}...`);
      
      // Get user data using ultra-optimized system
      const userData = await UltraOptimizedDatabase.getUser(address, true);
      
      console.log(`📊 User data from OptimizedDatabase:`, {
        address: address.slice(0, 8) + '...',
        hasLand: userData.hasLand,
        landPurchaseDate: userData.landPurchaseDate
      });
      
      return res.json({
        hasLand: userData.hasLand || false,
        landPurchaseDate: userData.landPurchaseDate,
        debug: {
          user_exists: true,
          raw_hasLand: userData.hasLand,
          system: 'UltraOptimizedDatabase'
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