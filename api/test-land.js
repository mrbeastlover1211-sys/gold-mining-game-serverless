// Debug endpoint to test land status directly
export default async function handler(req, res) {
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'address parameter required' });
  }
  
  try {
    // Try database connection
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    // Check if user exists in database
    const result = await db.query('SELECT wallet, has_land, land_purchase_date, inventory FROM users WHERE wallet = $1', [address]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      return res.json({
        database_status: 'connected',
        user_exists: true,
        user_data: user,
        has_land: user.has_land,
        land_purchase_date: user.land_purchase_date
      });
    } else {
      return res.json({
        database_status: 'connected', 
        user_exists: false,
        has_land: false,
        message: 'User not found in database'
      });
    }
    
  } catch (error) {
    return res.json({
      database_status: 'error',
      error: error.message,
      has_land: false,
      message: 'Database connection failed'
    });
  }
}