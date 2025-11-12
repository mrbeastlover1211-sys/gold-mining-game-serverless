// Emergency endpoint to manually set land ownership for users who already purchased
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.body || {};
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  try {
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    console.log(`🔧 Manually setting land ownership for: ${address}`);
    
    // FORCE set land ownership in database
    const result = await db.query(`
      INSERT INTO users (address, has_land, land_purchase_date, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes, total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (address) DO UPDATE SET
      has_land = true, 
      land_purchase_date = COALESCE(users.land_purchase_date, $3),
      last_activity = $11
      RETURNING address, has_land, land_purchase_date
    `, [
      address,
      true, // has_land - FORCE TRUE
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
    
    console.log(`✅ Land ownership set:`, result.rows[0]);
    
    // Verify it worked by checking
    const checkResult = await db.query('SELECT address, has_land, land_purchase_date FROM users WHERE address = $1', [address]);
    
    res.json({
      success: true,
      message: 'Land ownership manually set',
      before: 'No land or not properly saved',
      after: checkResult.rows[0],
      instructions: 'Now refresh your game and try buying pickaxes - should work!'
    });
    
  } catch (e) {
    console.error('Fix land error:', e);
    res.status(500).json({ 
      error: 'failed to set land ownership', 
      details: e.message 
    });
  }
}