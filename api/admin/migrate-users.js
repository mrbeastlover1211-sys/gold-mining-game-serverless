// Admin endpoint to migrate users from old system to new database
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, users } = req.body || {};
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!users || typeof users !== 'object') {
    return res.status(400).json({ error: 'users object required' });
  }

  try {
    const { getDatabase } = await import('../../database.js');
    const db = await getDatabase();
    
    let migrated = 0;
    let errors = [];
    
    for (const [wallet, userData] of Object.entries(users)) {
      try {
        // Migrate user data to database
        await db.query(`
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
          has_land = COALESCE($2, users.has_land),
          land_purchase_date = COALESCE($3, users.land_purchase_date),
          inventory = COALESCE($4, users.inventory),
          total_mining_power = COALESCE($5, users.total_mining_power),
          checkpoint_timestamp = COALESCE($6, users.checkpoint_timestamp),
          last_checkpoint_gold = COALESCE($7, users.last_checkpoint_gold),
          last_activity = COALESCE($8, users.last_activity)
        `, [
          wallet,
          userData.hasLand || false,
          userData.landPurchaseDate || null,
          JSON.stringify(userData.inventory || { silver: 0, gold: 0, diamond: 0, netherite: 0 }),
          userData.total_mining_power || 0,
          userData.checkpoint_timestamp || Math.floor(Date.now() / 1000),
          userData.last_checkpoint_gold || 0,
          userData.lastActivity || Math.floor(Date.now() / 1000)
        ]);
        
        migrated++;
        console.log(`✅ Migrated user: ${wallet.slice(0, 8)}...`);
        
      } catch (userError) {
        console.error(`❌ Failed to migrate ${wallet}:`, userError.message);
        errors.push({
          wallet: wallet.slice(0, 8) + '...',
          error: userError.message
        });
      }
    }
    
    res.json({
      success: true,
      migrated,
      total: Object.keys(users).length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully migrated ${migrated} users to database`
    });
    
  } catch (e) {
    console.error('Migration error:', e);
    res.status(500).json({ 
      error: 'migration failed', 
      details: e.message 
    });
  }
}