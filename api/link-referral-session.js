// 🔗 LINK REFERRAL SESSION - Create session from localStorage backup
import { pool } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🔗 Linking referral session from localStorage...');
    
    const { method, body } = req;
    
    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { referrerAddress, referredAddress, timestamp } = body;
    
    if (!referrerAddress || !referredAddress) {
      return res.status(400).json({ error: 'Missing required addresses' });
    }
    
    // Prevent self-referral
    if (referrerAddress === referredAddress) {
      return res.json({
        success: false,
        error: 'Cannot refer yourself'
      });
    }
    
    const client = await pool.connect();
    
    try {
      // Check if session already exists
      const existingSession = await client.query(`
        SELECT * FROM referral_visits 
        WHERE referrer_address = $1 AND converted_address = $2
      `, [referrerAddress, referredAddress]);
      
      if (existingSession.rows.length > 0) {
        console.log('ℹ️ Referral session already exists');
        return res.json({
          success: true,
          message: 'Referral session already exists',
          session_id: existingSession.rows[0].session_id
        });
      }
      
      // Create new session from localStorage data
      const sessionId = 'localStorage_' + timestamp + '_' + Math.random().toString(36).substr(2, 9);
      
      const insertResult = await client.query(`
        INSERT INTO referral_visits (
          session_id,
          referrer_address,
          visitor_ip,
          user_agent,
          visit_timestamp,
          converted_address,
          converted,
          completion_checked,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        sessionId,
        referrerAddress,
        'localStorage_backup',
        'localStorage_referral',
        new Date(parseInt(timestamp)),
        referredAddress,
        true, // Mark as converted since wallet is connected
        false, // Not yet checked for completion
        new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
      ]);
      
      console.log('✅ Created referral session from localStorage:', insertResult.rows[0]);
      
      client.release();
      
      return res.json({
        success: true,
        message: 'Referral session linked successfully',
        session_id: sessionId,
        referrer_address: referrerAddress,
        referred_address: referredAddress
      });
      
    } catch (queryError) {
      console.error('❌ Database query error:', queryError);
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ Link referral session error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
}