// Comprehensive database connection debugging
export default async function handler(req, res) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    // Log basic info
    console.log('🔍 Connection Debug Info:');
    console.log('- DATABASE_URL exists:', !!dbUrl);
    console.log('- URL length:', dbUrl?.length);
    console.log('- URL format check:', dbUrl?.includes('supabase.co'));
    
    if (!dbUrl) {
      return res.json({
        error: 'DATABASE_URL not set',
        debug: 'Environment variable missing'
      });
    }
    
    // Parse URL components
    let urlParts = {};
    try {
      const url = new URL(dbUrl);
      urlParts = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        username: url.username,
        password: url.password ? '[HIDDEN]' : 'NOT_SET'
      };
    } catch (urlError) {
      return res.json({
        error: 'Invalid DATABASE_URL format',
        debug: urlError.message
      });
    }
    
    // Try basic Node.js DNS lookup
    const dns = await import('dns').then(m => m.promises);
    let dnsResult = null;
    try {
      const addresses = await dns.lookup(urlParts.hostname);
      dnsResult = addresses;
    } catch (dnsError) {
      return res.json({
        error: 'DNS lookup failed',
        hostname: urlParts.hostname,
        dns_error: dnsError.message,
        url_parts: urlParts,
        suggestion: 'The Supabase project hostname is not resolvable. This usually means the project is not fully initialized or there is a DNS issue.'
      });
    }
    
    // Try database connection
    try {
      const { getDatabase } = await import('../database.js');
      const db = await getDatabase();
      const result = await db.query('SELECT NOW() as current_time, version() as postgres_version');
      
      return res.json({
        status: 'SUCCESS',
        message: 'Database connection working perfectly!',
        dns_result: dnsResult,
        url_parts: urlParts,
        database_info: result.rows[0]
      });
      
    } catch (dbError) {
      return res.json({
        error: 'Database connection failed after DNS success',
        dns_result: dnsResult,
        url_parts: urlParts,
        db_error: dbError.message,
        error_code: dbError.code
      });
    }
    
  } catch (error) {
    return res.json({
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    });
  }
}