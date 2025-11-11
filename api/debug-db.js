// Debug endpoint to test database connection and see what data exists
export default async function handler(req, res) {
  try {
    console.log('🔍 Testing database connection...');
    
    // Check environment variable
    const dbUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL exists:', !!dbUrl);
    console.log('DATABASE_URL preview:', dbUrl ? dbUrl.slice(0, 50) + '...' : 'NOT SET');
    
    // Try to connect to database
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    console.log('✅ Database connection successful');
    
    // Check if users table exists
    const tableCheck = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    console.log('Users table exists:', tableCheck.rows.length > 0);
    
    // Get total user count
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = userCount.rows[0].count;
    
    console.log('Total users in database:', totalUsers);
    
    // Get sample of users (first 5)
    const sampleUsers = await db.query('SELECT wallet, has_land, inventory FROM users LIMIT 5');
    
    // Get users with land
    const landOwners = await db.query('SELECT COUNT(*) as count FROM users WHERE has_land = true');
    const totalLandOwners = landOwners.rows[0].count;
    
    console.log('Users with land:', totalLandOwners);
    
    res.json({
      database_status: 'connected',
      environment_check: {
        database_url_exists: !!dbUrl,
        database_url_preview: dbUrl ? dbUrl.slice(0, 50) + '...' : 'NOT SET'
      },
      table_status: {
        users_table_exists: tableCheck.rows.length > 0,
        total_users: parseInt(totalUsers),
        users_with_land: parseInt(totalLandOwners)
      },
      sample_users: sampleUsers.rows.map(user => ({
        wallet: user.wallet.slice(0, 8) + '...',
        has_land: user.has_land,
        inventory: user.inventory
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Database debug error:', error);
    
    res.status(500).json({
      database_status: 'error',
      error_message: error.message,
      error_code: error.code,
      environment_check: {
        database_url_exists: !!process.env.DATABASE_URL
      },
      timestamp: new Date().toISOString()
    });
  }
}