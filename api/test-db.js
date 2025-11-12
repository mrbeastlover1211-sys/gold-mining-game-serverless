// Test database connection and data
export default async function handler(req, res) {
  try {
    console.log('🔍 Testing database connection...');
    
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    // Test basic connection
    const connectionTest = await db.query('SELECT NOW() as current_time');
    console.log('✅ Database connected at:', connectionTest.rows[0].current_time);
    
    // Check if users table exists
    const tableCheck = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    // Get all users data
    const usersData = await db.query('SELECT address, has_land, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes, total_mining_power FROM users LIMIT 10');
    
    res.json({
      status: 'success',
      database_connected: true,
      current_time: connectionTest.rows[0].current_time,
      table_structure: tableCheck.rows,
      sample_users: usersData.rows.map(user => ({
        address: user.address?.slice(0, 8) + '...',
        has_land: user.has_land,
        pickaxes: {
          silver: user.silver_pickaxes,
          gold: user.gold_pickaxes,
          diamond: user.diamond_pickaxes,
          netherite: user.netherite_pickaxes
        },
        mining_power: user.total_mining_power
      })),
      total_users: usersData.rows.length
    });
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    
    res.status(500).json({
      status: 'error',
      database_connected: false,
      error_message: error.message,
      error_details: error.stack,
      environment_check: {
        database_url_exists: !!process.env.DATABASE_URL,
        database_url_length: process.env.DATABASE_URL?.length || 0
      }
    });
  }
}