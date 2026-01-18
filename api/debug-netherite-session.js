// Debug specific session
import pkg from 'pg';
const { Pool } = pkg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId query parameter required' });
  }
  
  let pool;
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1,
    });

    // Check the referral_visits table
    const visit = await pool.query(`
      SELECT * FROM referral_visits 
      WHERE session_id = $1
    `, [sessionId]);

    // Check active challenges for the referrer
    let challenges = { rows: [] };
    if (visit.rows.length > 0 && visit.rows[0].referrer_address) {
      challenges = await pool.query(`
        SELECT * FROM netherite_challenges
        WHERE referrer_address = $1
        ORDER BY challenge_started_at DESC
        LIMIT 5
      `, [visit.rows[0].referrer_address]);
    }

    return res.status(200).json({
      success: true,
      sessionId,
      visit: visit.rows[0] || null,
      challengesForReferrer: challenges.rows,
      problem: !visit.rows[0]?.netherite_challenge_id ? 
        'netherite_challenge_id is NULL or missing in referral_visits' : 
        'Visit found with challenge link'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (pool) await pool.end();
  }
}
