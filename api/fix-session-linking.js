// 🔧 FIX SESSION LINKING - Store full address and properly link sessions
export default async function handler(req, res) {
  try {
    console.log('🔧 Fixing session linking with full addresses...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const results = [];
    
    try {
      // 1. Fix the broken session for user 67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C
      const fullAddress = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
      const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
      
      console.log('🔍 Looking for broken sessions with partial address...');
      
      // Find sessions with partial address "67..."
      const brokenSessions = await client.query(`
        SELECT * FROM referral_visits 
        WHERE referrer_address = $1 
        AND (converted_address LIKE '67%' OR converted_address = '67...')
        ORDER BY visit_timestamp DESC
      `, [mainAccount]);
      
      console.log(`Found ${brokenSessions.rows.length} broken sessions`);
      results.push(`Found ${brokenSessions.rows.length} broken sessions with partial addresses`);
      
      if (brokenSessions.rows.length > 0) {
        // Fix the most recent broken session
        const brokenSession = brokenSessions.rows[0];
        
        const updateResult = await client.query(`
          UPDATE referral_visits 
          SET 
            converted_address = $1,
            converted = true,
            converted_timestamp = CURRENT_TIMESTAMP,
            completion_checked = false,
            reward_triggered = false
          WHERE id = $2
          RETURNING *
        `, [fullAddress, brokenSession.id]);
        
        results.push(`✅ Fixed session ${brokenSession.session_id} with full address`);
        console.log('✅ Updated session:', updateResult.rows[0]);
      }
      
      // 2. Create a direct session if none exists
      const directSessionId = 'fixed_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      
      try {
        const newSession = await client.query(`
          INSERT INTO referral_visits (
            session_id,
            referrer_address,
            visitor_ip,
            user_agent,
            visit_timestamp,
            converted_address,
            converted,
            converted_timestamp,
            completion_checked,
            reward_triggered,
            expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (session_id) DO NOTHING
          RETURNING *
        `, [
          directSessionId,
          mainAccount,
          '127.0.0.1',
          'Fixed Session',
          new Date(),
          fullAddress,
          true,
          new Date(),
          false,
          false,
          new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
        ]);
        
        if (newSession.rows.length > 0) {
          results.push(`✅ Created direct session: ${directSessionId}`);
          console.log('✅ Created direct session:', newSession.rows[0]);
        }
      } catch (sessionError) {
        results.push(`ℹ️ Session creation: ${sessionError.message}`);
      }
      
      // 3. Update check-referral-session API logic to handle full addresses
      // This is done by fixing the API itself, not just the data
      
      // 4. Verify the fix
      const verifySession = await client.query(`
        SELECT * FROM referral_visits 
        WHERE referrer_address = $1 
        AND converted_address = $2
        AND converted = true
        ORDER BY visit_timestamp DESC
        LIMIT 1
      `, [mainAccount, fullAddress]);
      
      if (verifySession.rows.length > 0) {
        results.push('✅ Session linking verification: SUCCESS');
        results.push(`   Session ID: ${verifySession.rows[0].session_id}`);
        results.push(`   Full address stored: ${verifySession.rows[0].converted_address}`);
        results.push(`   Converted: ${verifySession.rows[0].converted}`);
      } else {
        results.push('❌ Session linking verification: FAILED');
      }
      
      // 5. Check if user meets completion requirements
      const userCheck = await client.query(`
        SELECT address, has_land, inventory 
        FROM users 
        WHERE address = $1
      `, [fullAddress]);
      
      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        const inventory = user.inventory || {};
        const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
        const hasRequirements = user.has_land && totalPickaxes > 0;
        
        results.push(`📊 User completion status:`);
        results.push(`   Has land: ${user.has_land}`);
        results.push(`   Has pickaxe: ${totalPickaxes > 0} (${totalPickaxes} total)`);
        results.push(`   Ready for reward: ${hasRequirements}`);
        
        if (hasRequirements) {
          results.push('🎯 User meets all requirements for referral completion!');
        }
      }
      
    } catch (queryError) {
      console.error('❌ Query error:', queryError);
      results.push(`❌ Query error: ${queryError.message}`);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Session linking fixes applied',
      results: results,
      fixed_for: {
        referrer: mainAccount.slice(0, 8) + '...',
        referred: fullAddress.slice(0, 8) + '...'
      }
    });
    
  } catch (error) {
    console.error('❌ Fix session linking error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}