// Debug specific user data
export default async function handler(req, res) {
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'address parameter required' });
  }
  
  try {
    console.log(`🔍 Debugging user data for: ${address}`);
    
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    // Get raw database data
    const result = await db.query('SELECT * FROM users WHERE address = $1', [address]);
    
    let debugInfo = {
      database_connected: true,
      user_address: address,
      user_found: result.rows.length > 0,
      raw_database_data: result.rows[0] || null
    };
    
    if (result.rows.length > 0) {
      const dbUser = result.rows[0];
      debugInfo.converted_data = {
        inventory: {
          silver: dbUser.silver_pickaxes || 0,
          gold: dbUser.gold_pickaxes || 0,
          diamond: dbUser.diamond_pickaxes || 0,
          netherite: dbUser.netherite_pickaxes || 0
        },
        has_land: dbUser.has_land,
        total_mining_power: dbUser.total_mining_power,
        last_checkpoint_gold: dbUser.last_checkpoint_gold
      };
    }
    
    res.json(debugInfo);
    
  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    });
  }
}