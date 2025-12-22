// 🔍 DEBUG USER INVENTORY - Check why pickaxe detection fails
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    const testAddress = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    
    // Get raw database data
    const rawData = await client.query('SELECT * FROM users WHERE address = $1', [testAddress]);
    
    if (rawData.rows.length === 0) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const user = rawData.rows[0];
    
    // Test inventory parsing
    const inventory = user.inventory || {};
    const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
    
    client.release();
    
    
    return res.json({
      success: true,
      debug_data: {
        address: testAddress.slice(0, 8) + '...',
        raw_inventory: user.inventory,
        inventory_type: typeof user.inventory,
        inventory_keys: Object.keys(inventory),
        inventory_values: Object.values(inventory),
        total_pickaxes_calculated: totalPickaxes,
        has_land: user.has_land,
        all_user_columns: Object.keys(user)
      }
    });
    
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
    });
  }
}