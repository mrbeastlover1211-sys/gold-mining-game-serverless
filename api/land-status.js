export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Try database first, fallback to in-memory
    try {
      const { getDatabase } = await import('../database.js');
      const db = await getDatabase();
      
      const result = await db.query('SELECT address as wallet, has_land, land_purchase_date, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes FROM users WHERE address = $1', [address]);
      
      console.log(`🔍 Database query result for ${address}:`, result.rows);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        return res.json({
          hasLand: user.has_land || false,
          landPurchaseDate: user.land_purchase_date
        });
      } else {
        // User doesn't exist in database
        return res.json({
          hasLand: false,
          landPurchaseDate: null
        });
      }
      
    } catch (dbError) {
      console.warn('Database error, using in-memory fallback:', dbError.message);
      
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