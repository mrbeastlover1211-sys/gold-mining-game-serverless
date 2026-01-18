// View all Netherite Challenges in database
import pkg from 'pg';
const { Pool } = pkg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  let pool;
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1,
    });

    // Get ALL challenges (no limit)
    const challenges = await pool.query(`
      SELECT 
        id,
        referrer_address,
        challenge_started_at,
        challenge_expires_at,
        is_active,
        bonus_claimed,
        bonus_awarded,
        referred_user_address,
        referred_purchase_time,
        EXTRACT(EPOCH FROM (challenge_expires_at - CURRENT_TIMESTAMP)) as seconds_remaining,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - challenge_started_at)) as seconds_elapsed,
        CASE 
          WHEN challenge_expires_at > CURRENT_TIMESTAMP THEN 'ACTIVE'
          ELSE 'EXPIRED'
        END as status
      FROM netherite_challenges
      ORDER BY id DESC
    `);

    // Group by status
    const active = challenges.rows.filter(c => c.status === 'ACTIVE');
    const expired = challenges.rows.filter(c => c.status === 'EXPIRED');
    
    // Group by referrer
    const byReferrer = {};
    challenges.rows.forEach(c => {
      const addr = c.referrer_address.substring(0, 8) + '...';
      if (!byReferrer[addr]) {
        byReferrer[addr] = [];
      }
      byReferrer[addr].push(c.id);
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      
      summary: {
        total_challenges: challenges.rows.length,
        active_challenges: active.length,
        expired_challenges: expired.length,
        unique_referrers: Object.keys(byReferrer).length
      },
      
      by_referrer: byReferrer,
      
      all_challenge_ids: challenges.rows.map(c => c.id),
      
      active_challenges: active.map(c => ({
        id: c.id,
        referrer: c.referrer_address.substring(0, 8) + '...',
        started: c.challenge_started_at,
        expires: c.challenge_expires_at,
        time_remaining_seconds: Math.floor(parseFloat(c.seconds_remaining)),
        bonus_awarded: c.bonus_awarded
      })),
      
      expired_challenges: expired.map(c => ({
        id: c.id,
        referrer: c.referrer_address.substring(0, 8) + '...',
        started: c.challenge_started_at,
        expired: c.challenge_expires_at,
        bonus_awarded: c.bonus_awarded
      })),
      
      // Full details (limit to 50 for performance)
      detailed_list: challenges.rows.slice(0, 50).map(c => ({
        id: c.id,
        referrer_address: c.referrer_address,
        started_at: c.challenge_started_at,
        expires_at: c.challenge_expires_at,
        is_active: c.is_active,
        status: c.status,
        bonus_claimed: c.bonus_claimed,
        bonus_awarded: c.bonus_awarded,
        referred_user: c.referred_user_address,
        purchase_time: c.referred_purchase_time,
        seconds_elapsed: Math.floor(parseFloat(c.seconds_elapsed))
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (pool) await pool.end();
  }
}
