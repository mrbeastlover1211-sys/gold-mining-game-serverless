// 🔄 FIX SWAPPED ADDRESSES - Correct referrer/referred address mixup
import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    const correctMainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const correctReferredUser = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    
    const results = [];
    
    // Fix swapped addresses
    const swappedSessions = await client.query(`
      SELECT * FROM referral_visits 
      WHERE referrer_address = $1 
      ORDER BY visit_timestamp DESC
    `, [correctReferredUser]);
    
    results.push(`Found ${swappedSessions.rows.length} sessions with swapped addresses`);
    
    for (const session of swappedSessions.rows) {
      await client.query(`
        UPDATE referral_visits 
        SET 
          referrer_address = $1,
          converted_address = $2,
          converted = true,
          converted_timestamp = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [correctMainAccount, correctReferredUser, session.id]);
      
      results.push(`✅ Fixed session ${session.id}: ${session.session_id.slice(0, 20)}...`);
    }
    
    // Create fresh correct session
    const newSessionId = 'corrected_' + Date.now();
    await client.query(`
      INSERT INTO referral_visits (
        session_id, referrer_address, converted_address, converted, 
        visitor_ip, user_agent, visit_timestamp, converted_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      newSessionId, correctMainAccount, correctReferredUser, true,
      '127.0.0.1', 'Address Fix', new Date(), new Date()
    ]);
    
    results.push(`✅ Created corrected session: ${newSessionId}`);
    
    return res.json({
      success: true,
      results: results,
      corrected_mapping: {
        referrer: correctMainAccount.slice(0, 8) + '...',
        referred: correctReferredUser.slice(0, 8) + '...'
      }
    });
    
  } catch (error) {
    return res.json({ success: false, error: error.message });
  } finally {
    client.release();
    await pool.end();
  }
}