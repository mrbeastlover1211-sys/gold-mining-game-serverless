// Temporary admin endpoint to manually set land ownership for testing
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, address } = req.body || {};
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  try {
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    // Force set land ownership for this user
    const result = await db.query(`
      INSERT INTO users (address, has_land, land_purchase_date, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes, total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (address) DO UPDATE SET
      has_land = $2, land_purchase_date = $3, last_activity = $11
      RETURNING address, has_land
    `, [
      address,
      true, // has_land
      Math.floor(Date.now() / 1000), // land_purchase_date
      0, // silver_pickaxes
      0, // gold_pickaxes
      0, // diamond_pickaxes
      0, // netherite_pickaxes
      0, // total_mining_power
      Math.floor(Date.now() / 1000), // checkpoint_timestamp
      0, // last_checkpoint_gold
      Math.floor(Date.now() / 1000) // last_activity
    ]);
    
    console.log(`🔧 Admin: Set land ownership for ${address}`);
    
    res.json({
      success: true,
      address: address.slice(0, 8) + '...',
      hasLand: true,
      message: 'Land ownership set successfully',
      result: result.rows[0]
    });
    
  } catch (e) {
    console.error('Admin set land error:', e);
    res.status(500).json({ 
      error: 'failed to set land ownership', 
      details: e.message 
    });
  }
}