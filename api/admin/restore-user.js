// Admin endpoint to manually restore a single user's data
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, wallet, userData } = req.body || {};
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!wallet || !userData) {
    return res.status(400).json({ error: 'wallet and userData required' });
  }

  try {
    const { getDatabase } = await import('../../database.js');
    const db = await getDatabase();
    
    // Restore user data to database
    const result = await db.query(`
      INSERT INTO users (
        wallet, 
        has_land, 
        land_purchase_date, 
        inventory, 
        total_mining_power, 
        checkpoint_timestamp, 
        last_checkpoint_gold, 
        last_activity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (wallet) DO UPDATE SET
      has_land = $2,
      land_purchase_date = $3,
      inventory = $4,
      total_mining_power = $5,
      checkpoint_timestamp = $6,
      last_checkpoint_gold = $7,
      last_activity = $8
      RETURNING wallet, has_land, inventory
    `, [
      wallet,
      userData.hasLand || false,
      userData.landPurchaseDate || null,
      JSON.stringify(userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }),
      userData.total_mining_power || 0,
      userData.checkpoint_timestamp || Math.floor(Date.now() / 1000),
      userData.last_checkpoint_gold || userData.gold || 0,
      userData.lastActivity || Math.floor(Date.now() / 1000)
    ]);
    
    console.log(`✅ Restored user: ${wallet.slice(0, 8)}...`);
    
    res.json({
      success: true,
      wallet: wallet.slice(0, 8) + '...',
      restored: result.rows[0],
      message: `Successfully restored user data for ${wallet.slice(0, 8)}...`
    });
    
  } catch (e) {
    console.error('Restore error:', e);
    res.status(500).json({ 
      error: 'restore failed', 
      details: e.message 
    });
  }
}