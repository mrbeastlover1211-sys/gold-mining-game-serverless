// 🔧 COMPLETE REFERRAL FIX - Auto-trigger after both land and pickaxe purchase

export default async function handler(req, res) {
  try {
    console.log('🔧 REFERRAL AUTO-COMPLETION FIX - Running comprehensive fix...');
    
    const { method } = req;
    
    if (method === 'GET') {
      // GET: Run the debug tool first
      console.log('📊 Running referral debug analysis...');
      
      const { Pool } = await import('pg');
      
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 2
      });
      
      const client = await pool.connect();
      
      // Find all referrals that should have been completed but weren't
      const missedReferrals = await client.query(`
        SELECT 
          rv.referrer_address,
          rv.converted_address,
          rv.session_id,
          u.has_land,
          u.silver_pickaxes + u.gold_pickaxes + u.diamond_pickaxes + u.netherite_pickaxes as total_pickaxes,
          u.total_referrals,
          u.referral_rewards_earned
        FROM referral_visits rv
        JOIN users u ON rv.converted_address = u.address
        WHERE rv.converted = true 
        AND u.has_land = true 
        AND (u.silver_pickaxes + u.gold_pickaxes + u.diamond_pickaxes + u.netherite_pickaxes) > 0
        ORDER BY rv.converted_timestamp DESC
        LIMIT 20
      `);
      
      console.log(`🔍 Found ${missedReferrals.rows.length} potential missed referrals`);
      
      client.release();
      await pool.end();
      
      return res.json({
        success: true,
        missed_referrals_count: missedReferrals.rows.length,
        missed_referrals: missedReferrals.rows.map(row => ({
          referrer: row.referrer_address.slice(0, 8) + '...',
          referred: row.converted_address.slice(0, 8) + '...',
          has_land: row.has_land,
          total_pickaxes: row.total_pickaxes,
          current_referral_count: row.total_referrals,
          current_rewards: row.referral_rewards_earned,
          session_id: row.session_id.slice(0, 20) + '...'
        })),
        action_needed: 'POST to this endpoint to fix all missed referrals'
      });
      
    } else if (method === 'POST') {
      // POST: Fix all missed referrals
      console.log('🔧 FIXING all missed referrals...');
      
      const { Pool } = await import('pg');
      
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 2
      });
      
      const client = await pool.connect();
      const fixedReferrals = [];
      let totalFixed = 0;
      
      try {
        await client.query('BEGIN');
        
        // Find all referrals that need fixing
        const missedReferrals = await client.query(`
          SELECT 
            rv.referrer_address,
            rv.converted_address,
            rv.session_id,
            u.has_land,
            u.silver_pickaxes + u.gold_pickaxes + u.diamond_pickaxes + u.netherite_pickaxes as total_pickaxes
          FROM referral_visits rv
          JOIN users u ON rv.converted_address = u.address
          WHERE rv.converted = true 
          AND u.has_land = true 
          AND (u.silver_pickaxes + u.gold_pickaxes + u.diamond_pickaxes + u.netherite_pickaxes) > 0
          AND rv.referrer_address NOT IN (
            SELECT COALESCE(r.referrer_address, '') 
            FROM referrals r 
            WHERE r.referred_address = rv.converted_address 
            AND r.status = 'completed_referral'
          )
          LIMIT 50
        `);
        
        console.log(`🎯 Processing ${missedReferrals.rows.length} missed referrals...`);
        
        for (const referral of missedReferrals.rows) {
          const { referrer_address, converted_address, session_id } = referral;
          
          try {
            // Get referrer data
            const referrerResult = await client.query('SELECT * FROM users WHERE address = $1', [referrer_address]);
            
            if (referrerResult.rows.length === 0) {
              console.log(`❌ Referrer ${referrer_address.slice(0, 8)}... not found, skipping`);
              continue;
            }
            
            const referrerData = referrerResult.rows[0];
            const currentReferrals = referrerData.total_referrals || 0;
            const newReferralCount = currentReferrals + 1;
            
            // Determine tier reward based on total referrals
            let rewardPickaxeType = 'silver';
            let rewardPickaxeCount = 1;
            let goldReward = 100;
            
            if (newReferralCount >= 11 && newReferralCount <= 17) {
              rewardPickaxeType = 'gold';
              goldReward = 500;
            } else if (newReferralCount >= 18 && newReferralCount <= 24) {
              rewardPickaxeType = 'diamond';
              goldReward = 2000;
            } else if (newReferralCount >= 25) {
              rewardPickaxeType = 'netherite';
              goldReward = 10000;
            }
            
            const pickaxePowerMap = { silver: 1, gold: 10, diamond: 100, netherite: 1000 };
            const additionalMiningPower = pickaxePowerMap[rewardPickaxeType] * rewardPickaxeCount;
            
            // Update referrer with rewards
            await client.query(`
              UPDATE users 
              SET 
                total_referrals = total_referrals + 1,
                referral_rewards_earned = referral_rewards_earned + 0.01,
                ${rewardPickaxeType}_pickaxes = ${rewardPickaxeType}_pickaxes + $1,
                total_mining_power = total_mining_power + $2,
                last_checkpoint_gold = last_checkpoint_gold + $3
              WHERE address = $4
            `, [rewardPickaxeCount, additionalMiningPower, goldReward, referrer_address]);
            
            // Create referral record
            await client.query(`
              INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type, status)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (referrer_address, referred_address) DO NOTHING
            `, [referrer_address, converted_address, 0.01, 'sol', 'completed_referral']);
            
            fixedReferrals.push({
              referrer: referrer_address.slice(0, 8) + '...',
              referred: converted_address.slice(0, 8) + '...',
              reward: {
                pickaxe_type: rewardPickaxeType,
                pickaxe_count: rewardPickaxeCount,
                gold_reward: goldReward,
                sol_reward: 0.01,
                new_referral_count: newReferralCount
              }
            });
            
            totalFixed++;
            
            console.log(`✅ Fixed referral ${totalFixed}: ${referrer_address.slice(0, 8)}... got ${rewardPickaxeType} pickaxe + ${goldReward} gold`);
            
          } catch (fixError) {
            console.error(`❌ Failed to fix referral for ${referrer_address.slice(0, 8)}...:`, fixError.message);
          }
        }
        
        await client.query('COMMIT');
        console.log(`🎉 Successfully fixed ${totalFixed} referrals!`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
        await pool.end();
      }
      
      return res.json({
        success: true,
        message: `Successfully fixed ${totalFixed} missed referrals!`,
        total_fixed: totalFixed,
        fixed_referrals: fixedReferrals,
        next_step: 'Update frontend to auto-trigger referral completion'
      });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed. Use GET to check or POST to fix.' });
    }
    
  } catch (error) {
    console.error('❌ Referral fix error:', error);
    return res.status(500).json({
      error: error.message,
      action: 'Failed to fix referral system'
    });
  }
}