// Check if purchase-confirm endpoint is actually being called
export default async function handler(req, res) {
  try {
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('🔍 Checking if purchase-confirm endpoint is being called...');
    
    // Check raw database state
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get current user state
    const user = await client.query(`SELECT * FROM users WHERE address = $1`, [address]);
    
    console.log('Current DB state:', user.rows[0]);
    
    client.release();
    await pool.end();
    
    // Check if user exists and what the last activity was
    const userRecord = user.rows[0];
    
    return res.json({
      debug: 'purchase_endpoint_check',
      database_state: {
        user_exists: !!userRecord,
        current_inventory: userRecord ? {
          silver: userRecord.silver_pickaxes,
          gold: userRecord.gold_pickaxes,
          diamond: userRecord.diamond_pickaxes,
          netherite: userRecord.netherite_pickaxes
        } : null,
        last_activity: userRecord ? new Date(userRecord.last_activity * 1000).toLocaleString() : 'Never',
        mining_power: userRecord?.total_mining_power || 0,
        checkpoint_gold: userRecord?.last_checkpoint_gold || 0
      },
      next_steps: [
        '1. Try buying a pickaxe now',
        '2. Check Vercel function logs for purchase-confirm.js',
        '3. Look for: "✅ Purchase data saved successfully"',
        '4. If no logs appear, frontend might not be calling the endpoint',
        '5. If logs show errors, database save is failing'
      ],
      troubleshooting: {
        if_no_vercel_logs: 'Frontend is not calling /api/purchase-confirm',
        if_logs_but_no_save: 'Database save function has an error',
        if_logs_show_success: 'Something else is overriding the data'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return res.json({
      error: error.message
    });
  }
}