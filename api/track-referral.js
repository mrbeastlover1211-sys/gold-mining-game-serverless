import { sql } from '../database.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { ref } = req.query;
    
    if (!ref) {
      return res.status(400).json({ error: 'Missing referrer address' });
    }

    const referrer = ref;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = new Date().toISOString();

    console.log('🔗 Tracking referral visit...');
    console.log('👥 Visitor info:', {
      sessionId: sessionId.slice(0, 30) + '...',
      referrer: referrer.slice(0, 8) + '...',
      ip: ip,
      timestamp: timestamp
    });

    // Create table and insert visit using Neon Serverless
    try {
      // Create table if needed
      await sql`
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
          expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '48 hours',
          netherite_challenge_id INTEGER,
          purchased_netherite BOOLEAN DEFAULT false,
          netherite_purchase_time TIMESTAMP
        )
      `;

      // Check for active Netherite Challenge
      const challengeCheck = await sql`
        SELECT id, challenge_expires_at 
        FROM netherite_challenges 
        WHERE referrer_address = ${referrer}
          AND is_active = true 
          AND challenge_expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `;
      
      let netheriteChallenge = null;
      if (challengeCheck.length > 0) {
        netheriteChallenge = challengeCheck[0];
        console.log('🔥 Active Netherite Challenge found:', {
          challengeId: netheriteChallenge.id,
          expires: netheriteChallenge.challenge_expires_at
        });
      }
      
      // Insert referral visit
      await sql`
        INSERT INTO referral_visits 
        (session_id, referrer_address, visitor_ip, user_agent, expires_at, netherite_challenge_id) 
        VALUES (${sessionId}, ${referrer}, ${ip}, ${userAgent}, CURRENT_TIMESTAMP + INTERVAL '7 days', ${netheriteChallenge?.id || null})
        ON CONFLICT (session_id) 
        DO UPDATE SET 
          visit_timestamp = CURRENT_TIMESTAMP,
          expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
          netherite_challenge_id = EXCLUDED.netherite_challenge_id
      `;
      
      console.log(`✅ Referral visit tracked: ${sessionId.slice(0, 20)}...`);
      console.log(`   Referrer: ${referrer.slice(0, 8)}...`);
      console.log(`   Netherite Challenge: ${netheriteChallenge ? 'LINKED' : 'none'}`);
      
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      throw dbError;
    }

    // Set cookie
    res.setHeader('Set-Cookie', [
      `referral_session=${sessionId}; Path=/; Max-Age=604800; SameSite=Lax`,
      `referrer=${referrer}; Path=/; Max-Age=604800; SameSite=Lax`
    ]);

    // Return 1x1 transparent GIF for tracking pixel compatibility
    // This allows the Image() element in frontend to trigger onload
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    
    // Also add referral info to response headers for debugging
    res.setHeader('X-Referral-Session', sessionId);
    res.setHeader('X-Referral-Status', 'tracked');
    
    return res.status(200).send(transparentGif);

  } catch (error) {
    console.error('❌ Track referral error:', error);
    return res.status(500).json({ 
      error: 'Failed to track referral',
      message: error.message 
    });
  }
}
