// 🎁 MANUAL COMPLETE REFERRAL - Direct referral completion bypassing schema issues
import { pool } from '../database.js';

export default async function handler(req, res) {
  const client = await pool.connect();
  
  try {
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const referredUser = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    
    const results = [];
    
    // 1. Manually complete the referral in database
    results.push('🎁 Manually completing referral...');
    
    // Create/update referral session with FULL addresses
    const sessionId = 'manual_complete_' + Date.now();
    
    try {
      await client.query(`
        INSERT INTO referral_visits (
          session_id,
          referrer_address,
          converted_address,
          visitor_ip,
          user_agent,
          visit_timestamp,
          converted,
          converted_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_id) DO UPDATE SET
          converted_address = EXCLUDED.converted_address,
          converted = EXCLUDED.converted,
          converted_timestamp = EXCLUDED.converted_timestamp
      `, [
        sessionId,
        mainAccount,
        referredUser, // FULL ADDRESS
        '127.0.0.1',
        'Manual Completion',
        new Date(),
        true,
        new Date()
      ]);
      
      results.push('✅ Created referral session with FULL addresses');
    } catch (e) {
      results.push(`⚠️ Session creation: ${e.message}`);
    }
    
    // 2. Give referral reward to main account
    try {
      const mainUser = await client.query('SELECT * FROM users WHERE address = $1', [mainAccount]);
      
      if (mainUser.rows.length > 0) {
        const user = mainUser.rows[0];
        const currentInventory = user.inventory || {};
        
        // Add Silver Pickaxe (1st referral reward)
        const newInventory = {
          ...currentInventory,
          silver: (currentInventory.silver || 0) + 1
        };
        
        await client.query(`
          UPDATE users 
          SET 
            inventory = $1,
            total_referrals = COALESCE(total_referrals, 0) + 1,
            total_mining_power = COALESCE(total_mining_power, 0) + 1
          WHERE address = $2
        `, [JSON.stringify(newInventory), mainAccount]);
        
        results.push('🎁 REFERRAL REWARD DELIVERED:');
        results.push('   +1 Silver Pickaxe');
        results.push('   +1 Total Referrals');
        results.push('   +1 Mining Power');
      }
    } catch (rewardError) {
      results.push(`❌ Reward delivery error: ${rewardError.message}`);
    }
    
    // 3. Create tracking record
    try {
      await client.query(`
        INSERT INTO referrals (referrer_address, referred_address, reward_type, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (referrer_address, referred_address) DO NOTHING
      `, [mainAccount, referredUser, 'silver_pickaxe', 'completed']);
      
      results.push('✅ Created referral tracking record');
    } catch (e) {
      results.push(`ℹ️ Tracking record: ${e.message}`);
    }
    
    // 4. Verify completion
    const verification = await client.query('SELECT * FROM users WHERE address = $1', [mainAccount]);
    
    if (verification.rows.length > 0) {
      const verifiedUser = verification.rows[0];
      results.push('📊 Verification - Main account now has:');
      results.push(`   Inventory: ${JSON.stringify(verifiedUser.inventory)}`);
      results.push(`   Total Referrals: ${verifiedUser.total_referrals || 0}`);
      results.push(`   Mining Power: ${verifiedUser.total_mining_power || 0}`);
    }
    
    return res.json({
      success: true,
      message: 'Referral manually completed!',
      results: results,
      referrer: mainAccount.slice(0, 8) + '...',
      referred: referredUser.slice(0, 8) + '...',
      session_id: sessionId
    });
    
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}