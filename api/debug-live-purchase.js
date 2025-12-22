// Real-time purchase debugging - check what's happening RIGHT NOW
export default async function handler(req, res) {
  const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
  
  try {
    console.log('🔍 LIVE PURCHASE DEBUG - checking current state...');
    
    // Check database connection
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get current user state
    const userQuery = await client.query(`SELECT * FROM users WHERE address = $1`, [address]);
    const user = userQuery.rows[0];
    
    // Get recent activity log
    const activityQuery = await client.query(`
      SELECT address, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes, 
             total_mining_power, last_activity, updated_at
      FROM users 
      WHERE address = $1
      ORDER BY updated_at DESC 
      LIMIT 1
    `, [address]);
    
    client.release();
    
    return res.json({
      debug_type: 'live_purchase_check',
      timestamp: new Date().toISOString(),
      current_user: user,
      last_activity_human: user ? new Date(user.last_activity * 1000).toLocaleString() : 'Never',
      last_update_human: user ? user.updated_at : 'Never',
      seconds_since_update: user ? Math.floor((Date.now() - new Date(user.updated_at).getTime()) / 1000) : 'Unknown',
      diagnosis: {
        if_updated_recently: 'Purchase system is working',
        if_updated_old: 'Purchase-confirm endpoint is failing',
        if_no_user: 'Database connection broken'
      },
      next_steps: [
        '1. Make a purchase RIGHT NOW',
        '2. Immediately refresh this debug URL',
        '3. Check if updated_at timestamp changes',
        '4. If not, purchase-confirm endpoint has an error'
      ]
    });
    
  } catch (error) {
    return res.json({
      debug_type: 'live_purchase_check',
      error: error.message,
      stack: error.stack,
      diagnosis: 'Database connection or query failed'
    });
  }
}