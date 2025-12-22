// 🔍 DEBUG SESSION TRACKING - Check what's happening with the new system
export default async function handler(req, res) {
  try {
    console.log('🔍 Debugging session tracking system...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    // Check if referral_visits table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_visits'
      )
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log('🗂️ referral_visits table exists:', tableExists);
    
    if (!tableExists) {
      console.log('🛠️ Creating referral_visits table...');
      await client.query(`
        CREATE TABLE referral_visits (
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
      console.log('✅ referral_visits table created');
    }
    
    // Check current data in table
    const allVisits = await client.query('SELECT * FROM referral_visits ORDER BY visit_timestamp DESC LIMIT 10');
    console.log('📊 Recent visits:', allVisits.rows);
    
    // Check for specific referrer
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const specificVisits = await client.query(`
      SELECT * FROM referral_visits 
      WHERE referrer_address = $1 
      ORDER BY visit_timestamp DESC
    `, [mainAccount]);
    
    console.log('👤 Visits for main account:', specificVisits.rows);
    
    // Test creating a visit manually
    const testSessionId = 'test_session_' + Date.now();
    try {
      const testInsert = await client.query(`
        INSERT INTO referral_visits (session_id, referrer_address, visitor_ip, user_agent)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [testSessionId, mainAccount, '127.0.0.1', 'Debug Test']);
      
      console.log('✅ Test visit created:', testInsert.rows[0]);
    } catch (insertError) {
      console.error('❌ Test insert failed:', insertError.message);
    }
    
    // Check other tables
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
    const referralsCount = await client.query('SELECT COUNT(*) as count FROM referrals WHERE id > 0').catch(() => ({ rows: [{ count: 'N/A' }] }));
    
    client.release();
    
    
    return res.json({
      success: true,
      debug_results: {
        referral_visits_table_exists: tableExists,
        total_visits: allVisits.rows.length,
        visits_for_main_account: specificVisits.rows.length,
        recent_visits: allVisits.rows,
        main_account_visits: specificVisits.rows,
        users_count: usersCount.rows[0].count,
        referrals_count: referralsCount.rows[0].count,
        test_session_created: testSessionId
      }
    });
    
  } catch (error) {
    console.error('❌ Debug session tracking error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}