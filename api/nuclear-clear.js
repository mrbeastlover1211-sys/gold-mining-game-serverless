// 💥 NUCLEAR CLEAR - Guaranteed complete database wipe including referrals
export default async function handler(req, res) {
  try {
    console.log('💥 Nuclear database clearing...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const results = [];
    
    try {
      // 1. Check what tables exist before clearing
      const tablesBefore = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      results.push(`📊 Found ${tablesBefore.rows.length} tables before clearing:`);
      tablesBefore.rows.forEach(row => {
        results.push(`   - ${row.table_name}`);
      });
      
      // 2. Clear referral_visits table specifically
      try {
        const refVisitsBefore = await client.query('SELECT COUNT(*) as count FROM referral_visits');
        results.push(`🎯 Referral visits before: ${refVisitsBefore.rows[0].count}`);
        
        await client.query('DELETE FROM referral_visits');
        
        const refVisitsAfter = await client.query('SELECT COUNT(*) as count FROM referral_visits');
        results.push(`✅ Referral visits after DELETE: ${refVisitsAfter.rows[0].count}`);
        
        // Reset auto-increment
        await client.query('ALTER SEQUENCE referral_visits_id_seq RESTART WITH 1');
        results.push('✅ Reset referral_visits sequence');
        
      } catch (refError) {
        results.push(`❌ Referral visits clear error: ${refError.message}`);
      }
      
      // 3. Clear users table specifically
      try {
        const usersBefore = await client.query('SELECT COUNT(*) as count FROM users');
        results.push(`👥 Users before: ${usersBefore.rows[0].count}`);
        
        await client.query('DELETE FROM users');
        
        const usersAfter = await client.query('SELECT COUNT(*) as count FROM users');
        results.push(`✅ Users after DELETE: ${usersAfter.rows[0].count}`);
        
      } catch (userError) {
        results.push(`❌ Users clear error: ${userError.message}`);
      }
      
      // 4. Clear all other tables one by one
      // NOTE: Order matters due to foreign key constraints!
      // netherite_challenges must be cleared AFTER referral_visits (already cleared above)
      const tablesToClear = ['referrals', 'transactions', 'gold_sales', 'netherite_challenges'];
      
      for (const tableName of tablesToClear) {
        try {
          const countBefore = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`Clearing ${tableName}: ${countBefore.rows[0].count} rows`);
          
          await client.query(`DELETE FROM ${tableName}`);
          
          const countAfter = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          
          results.push(`✅ ${tableName}: ${countBefore.rows[0].count} → ${countAfter.rows[0].count}`);
          console.log(`✅ ${tableName} cleared successfully`);
        } catch (tableError) {
          console.error(`❌ Error clearing ${tableName}:`, tableError.message);
          results.push(`❌ ${tableName}: ${tableError.message}`);
        }
      }
      
      // 5. Final verification
      try {
        const finalRefVisits = await client.query('SELECT COUNT(*) as count FROM referral_visits');
        const finalUsers = await client.query('SELECT COUNT(*) as count FROM users');
        
        results.push('🔍 Final verification:');
        results.push(`   Referral visits: ${finalRefVisits.rows[0].count}`);
        results.push(`   Users: ${finalUsers.rows[0].count}`);
        
        const allClear = finalRefVisits.rows[0].count == 0 && finalUsers.rows[0].count == 0;
        results.push(`   Status: ${allClear ? '✅ COMPLETELY CLEAR' : '❌ SOME DATA REMAINS'}`);
        
      } catch (verifyError) {
        results.push(`❌ Verification error: ${verifyError.message}`);
      }
      
    } catch (queryError) {
      results.push(`❌ Query error: ${queryError.message}`);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Nuclear database clearing completed',
      method: 'DELETE statements on each table individually',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Nuclear clear error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}