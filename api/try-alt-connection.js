// Try alternative connection methods for Supabase
export default async function handler(req, res) {
  const results = [];
  
  // Try different connection string formats
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    return res.json({ error: 'DATABASE_URL not set' });
  }
  
  // Extract parts from current URL
  const url = new URL(baseUrl);
  const password = url.password;
  const projectId = 'yxghqfdvnfgtexjzmerr';
  
  const connectionStrings = [
    // Original
    baseUrl,
    
    // Connection pooling format
    `postgresql://postgres:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    
    // Alternative pooler format
    `postgresql://postgres.${projectId}:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    
    // IPv4 forced
    baseUrl + '?sslmode=require',
    
    // No SSL
    baseUrl + '?sslmode=disable',
    
    // Transaction mode
    `postgresql://postgres:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ];
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const testUrl = connectionStrings[i];
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: testUrl,
        ssl: testUrl.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        max: 1
      });
      
      const client = await pool.connect();
      const result = await client.query('SELECT 1 as test');
      client.release();
      await pool.end();
      
      results.push({
        index: i,
        status: 'SUCCESS',
        url_type: [
          'original',
          'pooler_basic', 
          'pooler_full',
          'ipv4_ssl',
          'no_ssl',
          'transaction_mode'
        ][i],
        connection_string: testUrl.replace(password, '[HIDDEN]'),
        result: result.rows[0]
      });
      
      // If we found a working connection, return it immediately
      return res.json({
        success: true,
        working_connection: results[0],
        message: 'Found working connection!',
        use_this_url: testUrl.replace(password, '[HIDDEN]')
      });
      
    } catch (error) {
      results.push({
        index: i,
        status: 'FAILED',
        url_type: [
          'original',
          'pooler_basic', 
          'pooler_full', 
          'ipv4_ssl',
          'no_ssl',
          'transaction_mode'
        ][i],
        error: error.message
      });
    }
  }
  
  return res.json({
    success: false,
    message: 'No working connection found',
    tested_connections: results,
    suggestion: 'Try Railway or check Supabase project status'
  });
}