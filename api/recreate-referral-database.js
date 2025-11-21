// 🔄 RECREATE REFERRAL DATABASE - Clean slate with proper full address storage
export default async function handler(req, res) {
  try {
    console.log('🔄 Recreating referral database with proper structure...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const steps = [];
    
    try {
      // 1. DROP old broken tables
      steps.push('🗑️ Removing old broken tables...');
      
      await client.query('DROP TABLE IF EXISTS referral_visits CASCADE');
      steps.push('✅ Dropped old referral_visits table');
      
      await client.query('DROP TABLE IF EXISTS referrals CASCADE');
      steps.push('✅ Dropped old referrals table');
      
      // 2. CREATE new referral_visits table with PROPER structure
      steps.push('🏗️ Creating new referral_visits table...');
      
      await client.query(`
        CREATE TABLE referral_visits (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(150) UNIQUE NOT NULL,
          referrer_address VARCHAR(150) NOT NULL,
          referred_address VARCHAR(150),
          visitor_ip VARCHAR(50),
          user_agent TEXT,
          visit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          wallet_connected BOOLEAN DEFAULT false,
          wallet_connect_timestamp TIMESTAMP,
          land_purchased BOOLEAN DEFAULT false,
          land_purchase_timestamp TIMESTAMP,
          pickaxe_purchased BOOLEAN DEFAULT false,
          pickaxe_purchase_timestamp TIMESTAMP,
          referral_completed BOOLEAN DEFAULT false,
          reward_delivered BOOLEAN DEFAULT false,
          reward_delivery_timestamp TIMESTAMP,
          expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '48 hours',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      steps.push('✅ Created referral_visits with FULL ADDRESS support');
      
      // 3. CREATE new referrals table for tracking completed referrals
      await client.query(`
        CREATE TABLE referrals (
          id SERIAL PRIMARY KEY,
          referrer_address VARCHAR(150) NOT NULL,
          referred_address VARCHAR(150) NOT NULL,
          session_id VARCHAR(150),
          reward_type VARCHAR(20) DEFAULT 'pickaxe',
          reward_details JSONB DEFAULT '{}',
          status VARCHAR(20) DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(referrer_address, referred_address)
        )
      `);
      steps.push('✅ Created referrals tracking table');
      
      // 4. Ensure users table has proper columns
      const userColumns = [
        { name: 'inventory', type: 'JSONB', default: "'{}'::jsonb" },
        { name: 'total_referrals', type: 'INTEGER', default: '0' },
        { name: 'referral_rewards_earned', type: 'DECIMAL(20,8)', default: '0' },
        { name: 'total_mining_power', type: 'INTEGER', default: '0' }
      ];
      
      for (const col of userColumns) {
        try {
          await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default}`);
          steps.push(`✅ Ensured users.${col.name} exists`);
        } catch (e) {
          steps.push(`ℹ️ users.${col.name}: Already exists`);
        }
      }
      
      // 5. Create TEST referral with FULL ADDRESSES
      const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
      const testUser = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
      const testSessionId = 'clean_session_' + Date.now() + '_full_address';
      
      steps.push('🧪 Creating test referral with FULL addresses...');
      
      // Insert clean test session
      const sessionResult = await client.query(`
        INSERT INTO referral_visits (
          session_id,
          referrer_address,
          referred_address,
          visitor_ip,
          user_agent,
          visit_timestamp,
          wallet_connected,
          wallet_connect_timestamp,
          land_purchased,
          pickaxe_purchased,
          referral_completed,
          reward_delivered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        testSessionId,
        mainAccount,                    // FULL referrer address
        testUser,                       // FULL referred address  
        '127.0.0.1',
        'Clean Database Test',
        new Date(),
        true,                          // Wallet connected
        new Date(),
        true,                          // Land purchased  
        true,                          // Pickaxe purchased
        true,                          // Referral completed
        false                          // Reward not yet delivered
      ]);
      
      steps.push(`✅ Created test session with FULL addresses:`);
      steps.push(`   Session: ${testSessionId}`);
      steps.push(`   Referrer: ${mainAccount.slice(0, 8)}...${mainAccount.slice(-8)}`);
      steps.push(`   Referred: ${testUser.slice(0, 8)}...${testUser.slice(-8)}`);
      
      // 6. Verify full address storage
      const verifyQuery = await client.query(`
        SELECT 
          session_id,
          referrer_address,
          referred_address,
          LENGTH(referrer_address) as referrer_length,
          LENGTH(referred_address) as referred_length,
          referral_completed
        FROM referral_visits 
        WHERE session_id = $1
      `, [testSessionId]);
      
      if (verifyQuery.rows.length > 0) {
        const row = verifyQuery.rows[0];
        steps.push('🔍 Address storage verification:');
        steps.push(`   Referrer length: ${row.referrer_length} chars (should be ~44)`);
        steps.push(`   Referred length: ${row.referred_length} chars (should be ~44)`);
        steps.push(`   Full addresses stored: ${row.referrer_length > 40 && row.referred_length > 40 ? '✅ YES' : '❌ NO'}`);
        steps.push(`   Referral ready: ${row.referral_completed ? '✅ YES' : '❌ NO'}`);
      }
      
      steps.push('🎉 Database recreation completed successfully!');
      
    } catch (queryError) {
      steps.push(`❌ Database error: ${queryError.message}`);
      throw queryError;
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Referral database recreated with proper structure!',
      steps: steps,
      test_session: testSessionId,
      next_step: 'Now ready to deliver referral rewards with full address support'
    });
    
  } catch (error) {
    console.error('❌ Recreate referral database error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}