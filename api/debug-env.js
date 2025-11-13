// Debug endpoint to check Vercel environment variables
export default async function handler(req, res) {
  console.log('🔍 VERCEL ENVIRONMENT DEBUG');
  console.log('==========================');
  
  try {
    // Check if DATABASE_URL exists
    const databaseUrl = process.env.DATABASE_URL;
    console.log('📊 DATABASE_URL exists:', !!databaseUrl);
    
    if (!databaseUrl) {
      console.log('❌ DATABASE_URL not found in environment');
      return res.json({
        status: 'error',
        issue: 'DATABASE_URL environment variable not set in Vercel',
        solution: 'Add DATABASE_URL to Vercel environment variables'
      });
    }
    
    // Parse the URL to show details (without exposing password)
    try {
      const url = new URL(databaseUrl);
      const maskedUrl = `${url.protocol}//${url.username}:***@${url.hostname}:${url.port}${url.pathname}${url.search}`;
      
      console.log('🌍 Protocol:', url.protocol);
      console.log('🏠 Hostname:', url.hostname);
      console.log('🚪 Port:', url.port || 'default');
      console.log('📁 Database:', url.pathname);
      console.log('🔐 Username:', url.username);
      console.log('🔑 Has Password:', !!url.password);
      console.log('⚙️ SSL Params:', url.search);
      console.log('🔒 Masked URL:', maskedUrl);
      
      // Test database connection
      console.log('⚡ Testing database connection...');
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: url.search.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
        connectTimeoutMillis: 10000
      });
      
      const client = await pool.connect();
      console.log('✅ Database connection successful!');
      
      // Test query
      const result = await client.query('SELECT NOW() as current_time, version() as db_version');
      console.log('📊 Database time:', result.rows[0].current_time);
      console.log('📊 Database version:', result.rows[0].db_version);
      
      // Check if tables exist
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'transactions')
      `);
      
      console.log('🗄️ Tables found:', tableCheck.rows.map(row => row.table_name));
      
      client.release();
      await pool.end();
      
      return res.json({
        status: 'success',
        database: {
          connected: true,
          hostname: url.hostname,
          tables: tableCheck.rows.map(row => row.table_name),
          timestamp: result.rows[0].current_time
        },
        message: '✅ Database working perfectly!'
      });
      
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      console.error('🔍 Error code:', dbError.code);
      
      let solution = 'Check database connection';
      if (dbError.code === 'ENOTFOUND') {
        solution = 'Database hostname cannot be resolved - check if database still exists';
      } else if (dbError.code === 'ECONNREFUSED') {
        solution = 'Database refusing connections - check if database is running';
      } else if (dbError.message.includes('password')) {
        solution = 'Database password incorrect - check your credentials';
      }
      
      return res.json({
        status: 'error',
        database: {
          connected: false,
          error: dbError.message,
          errorCode: dbError.code,
          solution: solution
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error.message);
    return res.json({
      status: 'error',
      message: 'Debug script failed',
      error: error.message
    });
  }
}