// 🔍 CHECK REFERRAL SESSION - Find referrer from session when wallet connects
export default async function handler(req, res) {
  try {
    console.log('🔍 Checking referral session...');
    
    const { method, query, headers } = req;
    
    if (method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { address } = query;
    
    if (!address) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }
    
    // Get session from cookie
    const cookies = headers.cookie || '';
    const sessionMatch = cookies.match(/referral_session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;
    
    console.log('🍪 Session info:', {
      address: address.slice(0, 8) + '...',
      sessionId: sessionId ? sessionId.slice(0, 20) + '...' : 'none',
      hasCookie: !!sessionId
    });
    
    if (!sessionId) {
      return res.json({
        success: true,
        referrer_found: false,
        message: 'No referral session found',
        session_id: null,
        referrer_address: null
      });
    }
    
    // Check database for referral visit
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    try {
      // Find referral visit by session
      const visitQuery = await client.query(`
        SELECT * FROM referral_visits 
        WHERE session_id = $1 
        AND expires_at > CURRENT_TIMESTAMP 
        AND converted = false
      `, [sessionId]);
      
      if (visitQuery.rows.length === 0) {
        console.log('❌ No valid referral visit found');
        return res.json({
          success: true,
          referrer_found: false,
          message: 'Referral session expired or already used',
          session_id: sessionId,
          referrer_address: null
        });
      }
      
      const visit = visitQuery.rows[0];
      const referrerAddress = visit.referrer_address;
      
      console.log('✅ Referral found:', {
        sessionId: sessionId.slice(0, 20) + '...',
        referrer: referrerAddress.slice(0, 8) + '...',
        visitTime: visit.visit_timestamp
      });
      
      // Check if referrer is not the same as referred user (anti-self-referral)
      if (referrerAddress === address) {
        console.log('❌ Self-referral detected');
        return res.json({
          success: true,
          referrer_found: false,
          message: 'Cannot refer yourself',
          session_id: sessionId,
          referrer_address: referrerAddress
        });
      }
      
      // Mark as pending conversion (don't convert until land + pickaxe purchased)
      await client.query(`
        UPDATE referral_visits 
        SET converted_address = $1, converted_timestamp = CURRENT_TIMESTAMP
        WHERE session_id = $2
      `, [address, sessionId]);
      
      console.log('📋 Referral session linked to wallet address');
      
      client.release();
      await pool.end();
      
      return res.json({
        success: true,
        referrer_found: true,
        message: 'Referral session found and linked',
        session_id: sessionId,
        referrer_address: referrerAddress,
        visit_timestamp: visit.visit_timestamp,
        expires_at: visit.expires_at
      });
      
    } catch (queryError) {
      console.error('❌ Database query error:', queryError.message);
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ Check referral session error:', error);
    return res.json({
      success: false,
      error: error.message,
      referrer_found: false
    });
  }
}