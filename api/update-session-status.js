// 🔧 UPDATE SESSION STATUS - Fix converted status for existing sessions
export default async function handler(req, res) {
  try {
    console.log('🔧 Updating session conversion status...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const { address } = req.query;
    const targetAddress = address || '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    const results = [];
    
    try {
      // 1. Find sessions that should be converted but aren't
      const unconvertedSessions = await client.query(`
        SELECT * FROM referral_visits 
        WHERE referrer_address = $1 
        AND (converted = false OR converted_address IS NULL)
        ORDER BY visit_timestamp DESC
      `, [mainAccount]);
      
      results.push(`Found ${unconvertedSessions.rows.length} unconverted sessions`);
      
      if (unconvertedSessions.rows.length > 0) {
        // 2. Update the most recent session to link with target address
        const latestSession = unconvertedSessions.rows[0];
        
        const updateResult = await client.query(`
          UPDATE referral_visits 
          SET 
            converted_address = $1,
            converted = true,
            converted_timestamp = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `, [targetAddress, latestSession.id]);
        
        results.push(`✅ Updated session ${latestSession.session_id}`);
        results.push(`   Linked to: ${targetAddress.slice(0, 8)}...${targetAddress.slice(-8)}`);
        results.push(`   Converted: false → true`);
        
        // 3. Verify the update
        const verification = await client.query(`
          SELECT 
            session_id, 
            referrer_address, 
            converted_address, 
            converted,
            LENGTH(converted_address) as addr_length
          FROM referral_visits 
          WHERE id = $1
        `, [latestSession.id]);
        
        if (verification.rows.length > 0) {
          const row = verification.rows[0];
          results.push('🔍 Verification:');
          results.push(`   Session: ${row.session_id.slice(0, 20)}...`);
          results.push(`   Referrer: ${row.referrer_address.slice(0, 8)}...`);
          results.push(`   Converted Address: ${row.converted_address.slice(0, 8)}...${row.converted_address.slice(-8)}`);
          results.push(`   Converted Status: ${row.converted ? '✅ TRUE' : '❌ FALSE'}`);
          results.push(`   Address Length: ${row.addr_length} chars`);
        }
        
        // 4. Check if this should trigger referral completion
        const userCheck = await client.query(`
          SELECT address, has_land, inventory 
          FROM users 
          WHERE address = $1
        `, [targetAddress]);
        
        if (userCheck.rows.length > 0) {
          const user = userCheck.rows[0];
          const inventory = user.inventory || {};
          const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
          const hasRequirements = user.has_land && totalPickaxes > 0;
          
          results.push('📊 User completion check:');
          results.push(`   Has land: ${user.has_land}`);
          results.push(`   Has pickaxe: ${totalPickaxes > 0} (${totalPickaxes} total)`);
          results.push(`   Ready for reward: ${hasRequirements ? '✅ YES' : '❌ NO'}`);
          
          if (hasRequirements) {
            results.push('🎁 User meets requirements - can trigger referral reward!');
          }
        }
      }
      
    } catch (queryError) {
      results.push(`❌ Query error: ${queryError.message}`);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Session status update completed',
      target_address: targetAddress.slice(0, 8) + '...',
      main_account: mainAccount.slice(0, 8) + '...',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Update session status error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}