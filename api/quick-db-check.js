// ⚡ QUICK DB CHECK - Simple JSON view of address storage
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get latest visits with address lengths
    const visits = await client.query(`
      SELECT 
        id, session_id, referrer_address, converted_address,
        LENGTH(referrer_address) as ref_len,
        LENGTH(converted_address) as conv_len,
        converted, visit_timestamp
      FROM referral_visits 
      WHERE referrer_address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG'
      ORDER BY visit_timestamp DESC 
      LIMIT 5
    `);
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Address storage check',
      your_referral_visits: visits.rows.map(row => ({
        session_id: row.session_id.slice(0, 20) + '...',
        referrer_full: row.referrer_address,
        referrer_length: row.ref_len,
        converted_address: row.converted_address,
        converted_length: row.conv_len || 0,
        is_full_referrer: row.ref_len === 44,
        is_full_converted: (row.conv_len || 0) === 44,
        converted_status: row.converted,
        timestamp: row.visit_timestamp
      })),
      analysis: {
        total_visits_checked: visits.rows.length,
        full_referrer_addresses: visits.rows.filter(r => r.ref_len === 44).length,
        full_converted_addresses: visits.rows.filter(r => (r.conv_len || 0) === 44).length,
        partial_converted_addresses: visits.rows.filter(r => r.conv_len > 0 && r.conv_len < 44).length
      }
    });
    
  } catch (error) {
    return res.json({ success: false, error: error.message });
  }
}