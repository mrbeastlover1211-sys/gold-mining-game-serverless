// 🎯 SESSION TRACKING REFERRAL SYSTEM - Server-side referral recognition
export default async function handler(req, res) {
  try {
    console.log('🔗 Tracking referral visit...');
    
    const { method, query, headers } = req;
    
    if (method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { ref } = query;
    
    if (!ref) {
      return res.status(400).json({ error: 'Missing referrer parameter' });
    }
    
    // Generate unique session ID
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Get visitor info
    const visitorIP = headers['x-forwarded-for'] || headers['x-real-ip'] || req.connection?.remoteAddress || 'unknown';
    const userAgent = headers['user-agent'] || 'unknown';
    const timestamp = new Date().toISOString();
    
    console.log('👥 Visitor info:', {
      sessionId: sessionId,
      referrer: ref.slice(0, 8) + '...',
      ip: visitorIP,
      timestamp: timestamp
    });
    
    // Store in database using shared pool
    const { pool } = await import('../database.js');
    const client = await pool.connect();
    
    // Create referral_visits table if it doesn't exist
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS referral_visits (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(50) UNIQUE NOT NULL,
          referrer_address VARCHAR(100) NOT NULL,
          visitor_ip VARCHAR(50),
          user_agent TEXT,
          visit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          converted BOOLEAN DEFAULT false,
          converted_address VARCHAR(100),
          converted_timestamp TIMESTAMP,
          expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '48 hours'
        )
      `);
      console.log('✅ Referral visits table ready');
    } catch (tableError) {
      console.log('ℹ️ Table creation info:', tableError.message);
    }
    
    // Store the visit
    try {
      const insertResult = await client.query(`
        INSERT INTO referral_visits (session_id, referrer_address, visitor_ip, user_agent, visit_timestamp, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id) DO UPDATE SET
          visit_timestamp = EXCLUDED.visit_timestamp,
          expires_at = EXCLUDED.expires_at
        RETURNING *
      `, [
        sessionId,
        ref, // FULL ADDRESS - no truncation
        visitorIP,
        userAgent,
        timestamp,
        new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours from now
      ]);
      
      console.log('✅ Referral visit logged:', insertResult.rows[0]);
      
      // Set session cookie
      res.setHeader('Set-Cookie', [
        `referral_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${48 * 60 * 60}`, // 48 hours
        `referral_tracked=true; Path=/; SameSite=Lax; Max-Age=${48 * 60 * 60}` // Tracking flag
      ]);
      
      // Clean up expired visits (optional housekeeping)
      try {
        const cleanupResult = await client.query(`
          DELETE FROM referral_visits 
          WHERE expires_at < CURRENT_TIMESTAMP
        `);
        if (cleanupResult.rowCount > 0) {
          console.log(`🧹 Cleaned up ${cleanupResult.rowCount} expired visits`);
        }
      } catch (cleanupError) {
        console.log('ℹ️ Cleanup info:', cleanupError.message);
      }
      
    } catch (insertError) {
      console.error('❌ Failed to log visit:', insertError.message);
      throw insertError;
    }
    
    client.release();
    
    // Return tracking pixel (1x1 transparent GIF)
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.send(pixel);
    
  } catch (error) {
    console.error('❌ Track referral error:', error);
    
    // Return tracking pixel even on error (silent failure)
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    return res.send(pixel);
  }
}