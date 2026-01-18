// 🔍 COMPREHENSIVE REFERRAL SYSTEM DEBUG
// This will test the entire referral flow step by step

export default async function handler(req, res) {
  try {
    console.log('🔍 STARTING COMPREHENSIVE REFERRAL DEBUG');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const debugResults = {
      step1_referral_visits: null,
      step2_users_table: null,
      step3_referrals_table: null,
      step4_commission_flow: null,
      step5_missing_triggers: null,
      issues_found: []
    };
    
    // STEP 1: Check referral_visits table
    console.log('📊 STEP 1: Checking referral_visits table...');
    try {
      const visitsResult = await client.query(`
        SELECT 
          COUNT(*) as total_visits,
          COUNT(CASE WHEN converted = true THEN 1 END) as converted_visits,
          COUNT(CASE WHEN converted_address IS NOT NULL THEN 1 END) as linked_visits
        FROM referral_visits
      `);
      
      debugResults.step1_referral_visits = visitsResult.rows[0];
      console.log('✅ Referral visits stats:', debugResults.step1_referral_visits);
      
      // Get recent converted visits
      const recentConverted = await client.query(`
        SELECT referrer_address, converted_address, converted_timestamp, session_id
        FROM referral_visits 
        WHERE converted = true 
        ORDER BY converted_timestamp DESC 
        LIMIT 5
      `);
      
      debugResults.step1_referral_visits.recent_conversions = recentConverted.rows;
      console.log('🕐 Recent conversions:', recentConverted.rows);
      
    } catch (error) {
      debugResults.issues_found.push(`STEP 1 ERROR: ${error.message}`);
    }
    
    // STEP 2: Check users table for referral data integrity
    console.log('📊 STEP 2: Checking users table referral data...');
    try {
      const usersStats = await client.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN total_referrals > 0 THEN 1 END) as users_with_referrals,
          COUNT(CASE WHEN referral_rewards_earned > 0 THEN 1 END) as users_with_rewards,
          SUM(total_referrals) as total_referrals_given,
          SUM(referral_rewards_earned) as total_rewards_earned
        FROM users
      `);
      
      debugResults.step2_users_table = usersStats.rows[0];
      console.log('✅ Users referral stats:', debugResults.step2_users_table);
      
      // Check specific users who should have received commissions
      const topReferrers = await client.query(`
        SELECT address, total_referrals, referral_rewards_earned, 
               silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes
        FROM users 
        WHERE total_referrals > 0 
        ORDER BY total_referrals DESC 
        LIMIT 5
      `);
      
      debugResults.step2_users_table.top_referrers = topReferrers.rows;
      console.log('🏆 Top referrers:', topReferrers.rows);
      
    } catch (error) {
      debugResults.issues_found.push(`STEP 2 ERROR: ${error.message}`);
    }
    
    // STEP 3: Check referrals table
    console.log('📊 STEP 3: Checking referrals table...');
    try {
      const referralsStats = await client.query(`
        SELECT 
          COUNT(*) as total_referral_records,
          COUNT(CASE WHEN status = 'completed_referral' THEN 1 END) as completed_referrals,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_referrals,
          SUM(reward_amount) as total_rewards_tracked
        FROM referrals
      `);
      
      debugResults.step3_referrals_table = referralsStats.rows[0];
      console.log('✅ Referrals table stats:', debugResults.step3_referrals_table);
      
    } catch (error) {
      debugResults.issues_found.push(`STEP 3 ERROR: ${error.message}`);
    }
    
    // STEP 4: Test commission flow simulation
    console.log('📊 STEP 4: Testing commission flow...');
    try {
      // Find a real referral to test
      const testReferral = await client.query(`
        SELECT rv.referrer_address, rv.converted_address, rv.session_id
        FROM referral_visits rv
        WHERE rv.converted = true AND rv.converted_address IS NOT NULL
        LIMIT 1
      `);
      
      if (testReferral.rows.length > 0) {
        const { referrer_address, converted_address } = testReferral.rows[0];
        
        // Check if both users exist and referred user has land+pickaxe
        const referrerData = await client.query('SELECT * FROM users WHERE address = $1', [referrer_address]);
        const referredData = await client.query('SELECT * FROM users WHERE address = $1', [converted_address]);
        
        debugResults.step4_commission_flow = {
          test_referrer: referrer_address.slice(0, 8) + '...',
          test_referred: converted_address.slice(0, 8) + '...',
          referrer_exists: referrerData.rows.length > 0,
          referred_exists: referredData.rows.length > 0,
          referred_has_land: referredData.rows[0]?.has_land || false,
          referred_inventory: referredData.rows[0]?.inventory || {},
          referrer_before: {
            total_referrals: referrerData.rows[0]?.total_referrals || 0,
            referral_rewards_earned: referrerData.rows[0]?.referral_rewards_earned || 0
          }
        };
        
        // Check if referred user meets completion criteria
        const referredUser = referredData.rows[0];
        const hasLand = referredUser?.has_land || false;
        const inventory = JSON.parse(referredUser?.inventory || '{}');
        const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
        const hasPickaxe = totalPickaxes > 0;
        
        debugResults.step4_commission_flow.completion_criteria = {
          has_land: hasLand,
          has_pickaxe: hasPickaxe,
          total_pickaxes: totalPickaxes,
          meets_criteria: hasLand && hasPickaxe
        };
        
        console.log('🧪 Commission flow test:', debugResults.step4_commission_flow);
        
      } else {
        debugResults.issues_found.push('No referral conversions found to test');
      }
      
    } catch (error) {
      debugResults.issues_found.push(`STEP 4 ERROR: ${error.message}`);
    }
    
    // STEP 5: Check for missing auto-completion triggers
    console.log('📊 STEP 5: Checking auto-completion triggers...');
    try {
      // Find users who should trigger referral completion but haven't
      const missedCompletions = await client.query(`
        SELECT 
          rv.referrer_address,
          rv.converted_address,
          rv.converted_timestamp,
          u.has_land,
          u.inventory,
          u.silver_pickaxes + u.gold_pickaxes + u.diamond_pickaxes + u.netherite_pickaxes as total_pickaxes
        FROM referral_visits rv
        JOIN users u ON rv.converted_address = u.address
        WHERE rv.converted = true 
        AND u.has_land = true 
        AND (u.silver_pickaxes + u.gold_pickaxes + u.diamond_pickaxes + u.netherite_pickaxes) > 0
        AND rv.referrer_address NOT IN (
          SELECT r.referrer_address 
          FROM referrals r 
          WHERE r.referred_address = rv.converted_address 
          AND r.status = 'completed_referral'
        )
        LIMIT 10
      `);
      
      debugResults.step5_missing_triggers = {
        count: missedCompletions.rows.length,
        missed_completions: missedCompletions.rows.map(row => ({
          referrer: row.referrer_address.slice(0, 8) + '...',
          referred: row.converted_address.slice(0, 8) + '...',
          has_land: row.has_land,
          total_pickaxes: row.total_pickaxes,
          converted_time: row.converted_timestamp
        }))
      };
      
      console.log('🚨 Missed completions found:', debugResults.step5_missing_triggers);
      
      if (missedCompletions.rows.length > 0) {
        debugResults.issues_found.push(`${missedCompletions.rows.length} referrals should have completed but didn't`);
      }
      
    } catch (error) {
      debugResults.issues_found.push(`STEP 5 ERROR: ${error.message}`);
    }
    
    // ANALYSIS: Identify root causes
    console.log('🔍 ANALYZING ROOT CAUSES...');
    
    const analysis = {
      potential_issues: [],
      recommendations: []
    };
    
    // Check if auto-completion is being triggered
    if (debugResults.step5_missing_triggers?.count > 0) {
      analysis.potential_issues.push('AUTO_COMPLETION_NOT_TRIGGERED');
      analysis.recommendations.push('Check if complete-referral API is being called after land+pickaxe purchase');
    }
    
    // Check if commission flow is working
    if (debugResults.step2_users_table?.users_with_rewards === 0 && debugResults.step1_referral_visits?.converted_visits > 0) {
      analysis.potential_issues.push('COMMISSION_NOT_BEING_PAID');
      analysis.recommendations.push('Check complete-referral.js logic for reward distribution');
    }
    
    // Check data flow integrity
    if (debugResults.step1_referral_visits?.converted_visits !== debugResults.step3_referrals_table?.completed_referrals) {
      analysis.potential_issues.push('DATA_FLOW_MISMATCH');
      analysis.recommendations.push('Sessions are converting but not creating referral records');
    }
    
    debugResults.analysis = analysis;
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      debug_results: debugResults,
      summary: {
        total_visits: debugResults.step1_referral_visits?.total_visits || 0,
        converted_visits: debugResults.step1_referral_visits?.converted_visits || 0,
        users_with_rewards: debugResults.step2_users_table?.users_with_rewards || 0,
        missed_completions: debugResults.step5_missing_triggers?.count || 0,
        issues_count: debugResults.issues_found.length,
        main_issues: analysis.potential_issues,
        recommendations: analysis.recommendations
      }
    });
    
  } catch (error) {
    console.error('❌ Referral debug error:', error);
    return res.status(500).json({
      error: error.message,
      debug: 'Comprehensive referral debug failed'
    });
  }
}