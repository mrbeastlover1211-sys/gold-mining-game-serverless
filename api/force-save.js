// Force save user data for testing
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, hasLand, inventory } = req.body || {};
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  try {
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    console.log(`🔧 Force saving data for: ${address}`);
    console.log('Data to save:', { hasLand, inventory });
    
    // Calculate total mining power
    const totalMiningPower = 
      (inventory?.silver || 0) * 60 + 
      (inventory?.gold || 0) * 600 + 
      (inventory?.diamond || 0) * 6000 + 
      (inventory?.netherite || 0) * 600000;
    
    const now = Math.floor(Date.now() / 1000);
    
    // Force insert/update user
    const result = await db.query(`
      INSERT INTO users (
        address, has_land, land_purchase_date, 
        silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes,
        total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (address) DO UPDATE SET
        has_land = EXCLUDED.has_land,
        land_purchase_date = COALESCE(users.land_purchase_date, EXCLUDED.land_purchase_date),
        silver_pickaxes = EXCLUDED.silver_pickaxes,
        gold_pickaxes = EXCLUDED.gold_pickaxes,
        diamond_pickaxes = EXCLUDED.diamond_pickaxes,
        netherite_pickaxes = EXCLUDED.netherite_pickaxes,
        total_mining_power = EXCLUDED.total_mining_power,
        checkpoint_timestamp = EXCLUDED.checkpoint_timestamp,
        last_checkpoint_gold = EXCLUDED.last_checkpoint_gold,
        last_activity = EXCLUDED.last_activity
      RETURNING *
    `, [
      address,
      hasLand || false,
      hasLand ? now : null,
      inventory?.silver || 0,
      inventory?.gold || 0,
      inventory?.diamond || 0,
      inventory?.netherite || 0,
      totalMiningPower,
      now,
      0,
      now
    ]);
    
    console.log(`✅ Force save result:`, result.rows[0]);
    
    res.json({
      success: true,
      saved_data: result.rows[0],
      message: 'Data force saved to database'
    });
    
  } catch (error) {
    console.error('Force save error:', error);
    res.status(500).json({
      error: 'Force save failed',
      message: error.message
    });
  }
}