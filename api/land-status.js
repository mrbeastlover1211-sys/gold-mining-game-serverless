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
      
      const result = await db.query('SELECT address, has_land, land_purchase_date, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes FROM users WHERE address = $1', [address]);
      
      console.log(`🔍 Database query result for ${address}:`, result.rows);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log(`✅ Found user in database:`, {
          address: user.address?.slice(0, 8) + '...',
          has_land: user.has_land,
          land_purchase_date: user.land_purchase_date
        });
        return res.json({
          hasLand: !!user.has_land, // Force boolean conversion
          landPurchaseDate: user.land_purchase_date,
          debug: {
            raw_has_land: user.has_land,
            user_exists: true
          }
        });
      } else {
        console.log(`❌ User ${address.slice(0, 8)}... not found in database`);
        // User doesn't exist in database
        return res.json({
          hasLand: false,
          landPurchaseDate: null,
          debug: {
            user_exists: false,
            message: 'User not found in database'
          }
        });
      }
      
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