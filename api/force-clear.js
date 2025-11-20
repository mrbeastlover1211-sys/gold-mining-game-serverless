// 🚨 FORCE CLEAR DATABASE - Alternative approach with direct SQL
export default async function handler(req, res) {
  try {
    console.log('🚨 FORCE CLEARING DATABASE with direct approach...');
    
    const { Pool } = await import('pg');
    
    // Use direct database URL with full permissions
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10000
    });
    
    const client = await pool.connect();
    
    console.log('📊 Checking database before force clear...');
    
    // Get initial counts
    let beforeCounts = {};
    try {
      const usersBefore = await client.query('SELECT COUNT(*) as count FROM users');
      beforeCounts.users = parseInt(usersBefore.rows[0].count);
      console.log(`👥 Users to clear: ${beforeCounts.users}`);
    } catch (e) {
      beforeCounts.users = 0;
    }
    
    // Force clear with multiple methods
    console.log('🗑️ FORCE DELETION STARTING...');
    
    let results = {
      users_cleared: 0,
      method_used: 'none',
      errors: []
    };
    
    try {
      // Method 1: Try TRUNCATE CASCADE (most powerful)
      console.log('🔥 Trying TRUNCATE CASCADE...');
      await client.query('TRUNCATE TABLE users, transactions, referrals, gold_sales RESTART IDENTITY CASCADE');
      results.users_cleared = beforeCounts.users;
      results.method_used = 'TRUNCATE CASCADE';
      console.log('✅ TRUNCATE CASCADE successful!');
    } catch (truncateError) {
      console.log('❌ TRUNCATE CASCADE failed:', truncateError.message);
      results.errors.push(`TRUNCATE failed: ${truncateError.message}`);
      
      try {
        // Method 2: Try DROP and RECREATE (nuclear option)
        console.log('💥 Trying DROP and RECREATE...');
        
        await client.query('DROP TABLE IF EXISTS referrals CASCADE');
        await client.query('DROP TABLE IF EXISTS transactions CASCADE');  
        await client.query('DROP TABLE IF EXISTS gold_sales CASCADE');
        await client.query('DROP TABLE IF EXISTS users CASCADE');
        
        // Recreate basic users table
        await client.query(`
          CREATE TABLE users (
            address VARCHAR(100) PRIMARY KEY,
            inventory JSONB DEFAULT '{}',
            total_mining_power INTEGER DEFAULT 0,
            gold DECIMAL(20,8) DEFAULT 0,
            has_land BOOLEAN DEFAULT false,
            checkpoint_data JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        results.users_cleared = beforeCounts.users;
        results.method_used = 'DROP/RECREATE';
        console.log('✅ DROP/RECREATE successful!');
      } catch (dropError) {
        console.log('❌ DROP/RECREATE failed:', dropError.message);
        results.errors.push(`DROP failed: ${dropError.message}`);
        
        try {
          // Method 3: Force delete specific records
          console.log('🎯 Trying targeted DELETE...');
          const deleteResult = await client.query('DELETE FROM users WHERE address = $1', ['67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C']);
          results.users_cleared = deleteResult.rowCount;
          results.method_used = 'TARGETED DELETE';
          console.log('✅ Targeted delete successful!');
        } catch (deleteError) {
          console.log('❌ All methods failed:', deleteError.message);
          results.errors.push(`DELETE failed: ${deleteError.message}`);
        }
      }
    }
    
    // Verify results
    console.log('🔍 Verifying clearance...');
    let afterCounts = {};
    try {
      const usersAfter = await client.query('SELECT COUNT(*) as count FROM users');
      afterCounts.users = parseInt(usersAfter.rows[0].count);
      console.log(`👥 Users remaining: ${afterCounts.users}`);
    } catch (e) {
      afterCounts.users = 'unknown';
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      status: 'force_clear_completed',
      method_used: results.method_used,
      before_counts: beforeCounts,
      after_counts: afterCounts,
      users_cleared: results.users_cleared,
      success: results.users_cleared > 0 || afterCounts.users === 0,
      errors: results.errors,
      verification: {
        target_address: '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C',
        database_status: afterCounts.users === 0 ? 'completely_clear' : 'still_has_data'
      }
    });
    
  } catch (error) {
    console.error('❌ Force clear completely failed:', error);
    return res.json({
      status: 'force_clear_failed',
      error: error.message,
      stack: error.stack
    });
  }
}