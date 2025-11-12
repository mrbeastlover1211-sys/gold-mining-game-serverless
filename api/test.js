// Simple test to check if database is actually connecting
export default async function handler(req, res) {
  try {
    console.log('🔍 Testing basic database connection...');
    
    // Check if environment variable exists
    const dbUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL exists:', !!dbUrl);
    
    if (!dbUrl) {
      return res.json({
        error: 'DATABASE_URL not set',
        env_check: process.env
      });
    }
    
    // Try to import database
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    // Simple query test
    const result = await db.query('SELECT NOW() as current_time');
    
    // Test users table
    const usersTest = await db.query('SELECT COUNT(*) as user_count FROM users');
    
    res.json({
      status: 'success',
      database_connected: true,
      current_time: result.rows[0].current_time,
      total_users: usersTest.rows[0].user_count,
      environment: {
        database_url_set: !!process.env.DATABASE_URL,
        database_url_length: process.env.DATABASE_URL?.length
      }
    });
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    
    res.status(500).json({
      status: 'failed',
      error: error.message,
      error_code: error.code,
      environment: {
        database_url_set: !!process.env.DATABASE_URL,
        database_url_length: process.env.DATABASE_URL?.length,
        node_env: process.env.NODE_ENV
      }
    });
  }
}