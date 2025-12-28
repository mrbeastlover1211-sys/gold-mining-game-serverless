// Test Netherite Challenge Flow
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

    const results = {
      challenges: null,
      visits: null,
      users: null,
      summary: {}
    };

    // 1. Check active challenges
    const challenges = await pool.query(`
      SELECT 
        id,
        referrer_address,
        challenge_started_at,
        challenge_expires_at,
        is_active,
        bonus_claimed,
        bonus_awarded
      FROM netherite_challenges
      WHERE is_active = true
      ORDER BY challenge_started_at DESC
      LIMIT 10
    `);
    results.challenges = challenges.rows;
    results.summary.activeChallenges = challenges.rows.length;

    // 2. Check recent referral visits with challenge links
    const visits = await pool.query(`
      SELECT 
        session_id,
        referrer_address,
        referred_address,
        netherite_challenge_id,
        purchased_netherite,
        visit_time,
        netherite_purchase_time
      FROM referral_visits
      WHERE netherite_challenge_id IS NOT NULL
      ORDER BY visit_time DESC
      LIMIT 20
    `);
    results.visits = visits.rows;
    results.summary.visitsWithChallenge = visits.rows.length;

    // 3. Check users with netherite pickaxes
    const users = await pool.query(`
      SELECT 
        address,
        netherite_pickaxes,
        total_mining_power,
        active_netherite_challenge_id
      FROM users
      WHERE netherite_pickaxes > 0 OR active_netherite_challenge_id IS NOT NULL
      LIMIT 10
    `);
    results.users = users.rows;
    results.summary.usersWithNetherite = users.rows.length;

    // 4. Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('netherite_challenges', 'referral_visits', 'users')
    `);
    results.summary.tablesExist = tables.rows.map(r => r.table_name);

    // 5. Check columns in referral_visits
    const columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'referral_visits'
      ORDER BY ordinal_position
    `);
    results.summary.referralVisitsColumns = columns.rows;

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
