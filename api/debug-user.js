// Debug endpoint to check what's happening with user lookup
import { getUserOptimized } from '../database.js';

export default async function handler(req, res) {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    console.log(`🔍 Debug: Looking up user ${address.slice(0, 8)}...`);
    
    // Test the exact same function the status API uses
    const user = await getUserOptimized(address);
    
    console.log(`📊 Debug: getUserOptimized result:`, {
      user_found: !!user,
      has_land: user?.has_land,
      land_purchase_date: user?.land_purchase_date,
      address: user?.address,
      silver_pickaxes: user?.silver_pickaxes
    });
    
    if (!user) {
      return res.json({
        debug: 'USER_NOT_FOUND',
        message: 'getUserOptimized returned null',
        searched_address: address,
        function_used: 'getUserOptimized'
      });
    }
    
    return res.json({
      debug: 'USER_FOUND',
      user_data: {
        address: user.address,
        has_land: user.has_land,
        land_purchase_date: user.land_purchase_date,
        silver_pickaxes: user.silver_pickaxes,
        gold_pickaxes: user.gold_pickaxes,
        diamond_pickaxes: user.diamond_pickaxes,
        netherite_pickaxes: user.netherite_pickaxes,
        total_mining_power: user.total_mining_power,
        created_at: user.created_at
      },
      message: 'User found successfully'
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return res.status(500).json({
      debug: 'ERROR',
      error: error.message,
      stack: error.stack
    });
  }
}