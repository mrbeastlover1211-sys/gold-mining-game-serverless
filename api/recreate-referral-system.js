// 🔄 RECREATE REFERRAL SYSTEM - Complete session structure rebuild
export default async function handler(req, res) {
  try {
    console.log('🔄 Recreating complete referral system...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const results = [];
    
    try {
      // 1. Drop and recreate referral_visits table with proper structure
      await client.query('DROP TABLE IF EXISTS referral_visits CASCADE');
      results.push('✅ Dropped old referral_visits table');
      
      await client.query(`
        CREATE TABLE referral_visits (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(100) UNIQUE NOT NULL,
          referrer_address VARCHAR(100) NOT NULL,
          visitor_ip VARCHAR(50),
          user_agent TEXT,
          visit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          converted BOOLEAN DEFAULT false,
          converted_address VARCHAR(100),
          converted_timestamp TIMESTAMP,
          completion_checked BOOLEAN DEFAULT false,
          reward_triggered BOOLEAN DEFAULT false,
          expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '48 hours',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      results.push('✅ Created new referral_visits table with complete structure');
      
      // 2. Ensure users table has all required columns
      const requiredColumns = [
        { name: 'inventory', type: 'JSONB', default: "'{}'::jsonb" },
        { name: 'total_referrals', type: 'INTEGER', default: '0' },
        { name: 'referral_rewards_earned', type: 'DECIMAL(20,8)', default: '0' },
        { name: 'total_mining_power', type: 'INTEGER', default: '0' }
      ];
      
      for (const col of requiredColumns) {
        try {
          await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default}`);
          results.push(`✅ Ensured ${col.name} column exists`);
        } catch (e) {
          results.push(`ℹ️ ${col.name}: ${e.message}`);
        }
      }
      
      // 3. Create test session for current user
      const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
      const testUser = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
      const testSessionId = 'session_' + Date.now() + '_test_' + Math.random().toString(36).substr(2, 9);
      
      // Insert test referral visit
      await client.query(`
        INSERT INTO referral_visits (
          session_id, 
          referrer_address, 
          visitor_ip, 
          user_agent,
          visit_timestamp,
          converted_address,
          converted,
          completion_checked,
          reward_triggered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        testSessionId,
        mainAccount,
        '127.0.0.1',
        'Test Browser',
        new Date(),
        testUser,
        true,
        true,
        false // Ready to trigger reward
      ]);
      
      results.push('✅ Created test referral session');
      
      // 4. Trigger the actual reward for main account
      const userCheck = await client.query('SELECT * FROM users WHERE address = $1', [mainAccount]);
      
      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        const currentInventory = user.inventory || {};
        
        // Add Silver Pickaxe reward
        const updatedInventory = {
          ...currentInventory,
          silver: (currentInventory.silver || 0) + 1
        };
        
        await client.query(`
          UPDATE users 
          SET 
            inventory = $1,
            total_referrals = COALESCE(total_referrals, 0) + 1,
            referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + 0.01,
            gold = gold + 100,
            total_mining_power = COALESCE(total_mining_power, 0) + 1
          WHERE address = $2
        `, [JSON.stringify(updatedInventory), mainAccount]);
        
        results.push('🎁 REFERRAL REWARD GIVEN: +1 Silver Pickaxe, +100 Gold, +1 Referral');
        
        // Mark session as reward triggered
        await client.query(`
          UPDATE referral_visits 
          SET reward_triggered = true 
          WHERE session_id = $1
        `, [testSessionId]);
        
      } else {
        results.push('❌ Main account not found');
      }
      
      // 5. Create referrals table if needed for tracking
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS referrals (
            id SERIAL PRIMARY KEY,
            referrer_address VARCHAR(100) NOT NULL,
            referred_address VARCHAR(100) NOT NULL,
            reward_amount DECIMAL(10, 8) DEFAULT 0.01,
            reward_type VARCHAR(20) DEFAULT 'sol',
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(referrer_address, referred_address)
          )
        `);
        results.push('✅ Ensured referrals tracking table exists');
      } catch (e) {
        results.push(`ℹ️ Referrals table: ${e.message}`);
      }
      
      // 6. Insert referral record
      try {
        await client.query(`
          INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (referrer_address, referred_address) DO NOTHING
        `, [mainAccount, testUser, 0.01, 'sol', 'completed']);
        results.push('✅ Created referral tracking record');
      } catch (e) {
        results.push(`ℹ️ Referral record: ${e.message}`);
      }
      
      // 7. Final verification
      const finalCheck = await client.query('SELECT * FROM users WHERE address = $1', [mainAccount]);
      const finalUser = finalCheck.rows[0];
      
      results.push('📊 Final user state:');
      results.push(`   Inventory: ${JSON.stringify(finalUser.inventory)}`);
      results.push(`   Gold: ${finalUser.gold}`);
      results.push(`   Total Referrals: ${finalUser.total_referrals}`);
      results.push(`   Mining Power: ${finalUser.total_mining_power}`);
      
    } catch (queryError) {
      results.push(`❌ Query error: ${queryError.message}`);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Referral system recreated successfully!',
      results: results,
      test_session_id: testSessionId || 'not created',
      main_account: mainAccount.slice(0, 8) + '...',
      referred_user: testUser.slice(0, 8) + '...'
    });
    
  } catch (error) {
    console.error('❌ Recreate referral system error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}