// 🤖 AUTO COMPLETE REFERRAL - Automatic referral completion without manual intervention
import { getPool } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🤖 Auto completing referral...');
    
    const { method, body } = req;
    
    if (method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { address } = body;
    
    if (!address) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }
    
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      // 1. Find ANY referral session for this address (multiple methods)
      let referralSession = null;
      
      // Method A: Find by converted_address (full or partial)
      const sessionQuery1 = await client.query(`
        SELECT * FROM referral_visits 
        WHERE converted_address = $1 
        OR converted_address LIKE $2
        ORDER BY visit_timestamp DESC 
        LIMIT 1
      `, [address, address.slice(0, 8) + '%']);
      
      // Method B: Find recent unconverted sessions and auto-link them
      if (sessionQuery1.rows.length === 0) {
        const recentSessions = await client.query(`
          SELECT * FROM referral_visits 
          WHERE converted_address IS NULL 
          AND visit_timestamp > NOW() - INTERVAL '2 hours'
          ORDER BY visit_timestamp DESC 
          LIMIT 1
        `);
        
        if (recentSessions.rows.length > 0) {
          // Auto-link the recent session to this address
          const autoLinkResult = await client.query(`
            UPDATE referral_visits 
            SET converted_address = $1, converted = true, converted_timestamp = NOW()
            WHERE id = $2 
            RETURNING *
          `, [address, recentSessions.rows[0].id]);
          
          referralSession = autoLinkResult.rows[0];
          console.log('🔗 Auto-linked recent session to address');
        }
      } else {
        referralSession = sessionQuery1.rows[0];
      }
      
      if (!referralSession) {
        return res.json({
          success: true,
          referral_completed: false,
          message: 'No referral session found for auto-completion'
        });
      }
      
      const referrerAddress = referralSession.referrer_address;
      
      // 2. Check if user has both land and pickaxe
      const userCheck = await client.query('SELECT * FROM users WHERE address = $1', [address]);
      
      if (userCheck.rows.length === 0) {
        return res.json({
          success: true,
          referral_completed: false,
          message: 'User not found in database'
        });
      }
      
      const userData = userCheck.rows[0];
      const hasLand = userData.has_land;
      const inventory = userData.inventory || {};
      const totalPickaxes = Object.values(inventory).reduce((sum, count) => sum + (parseInt(count) || 0), 0);
      const hasPickaxe = totalPickaxes > 0;
      
      if (!hasLand || !hasPickaxe) {
        return res.json({
          success: true,
          referral_completed: false,
          message: 'User needs both land and pickaxe',
          requirements: { hasLand, hasPickaxe }
        });
      }
      
      // 3. Give referral reward to referrer
      const referrerCheck = await client.query('SELECT * FROM users WHERE address = $1', [referrerAddress]);
      
      if (referrerCheck.rows.length === 0) {
        return res.json({
          success: false,
          error: 'Referrer not found in database'
        });
      }
      
      const referrerData = referrerCheck.rows[0];
      const currentReferrals = referrerData.total_referrals || 0;
      const newReferralCount = currentReferrals + 1;
      
      // Determine tier reward
      let rewardPickaxeType = 'silver';
      if (newReferralCount >= 11 && newReferralCount <= 17) {
        rewardPickaxeType = 'gold';
      } else if (newReferralCount >= 18 && newReferralCount <= 24) {
        rewardPickaxeType = 'diamond';
      } else if (newReferralCount >= 25) {
        rewardPickaxeType = 'netherite';
      }
      
      // Update referrer with reward
      const referrerInventory = referrerData.inventory || {};
      const updatedInventory = {
        ...referrerInventory,
        [rewardPickaxeType]: (referrerInventory[rewardPickaxeType] || 0) + 1
      };
      
      const pickaxePower = { silver: 1, gold: 10, diamond: 100, netherite: 1000 };
      const additionalPower = pickaxePower[rewardPickaxeType] || 1;
      
      await client.query(`
        UPDATE users 
        SET 
          inventory = $1,
          total_referrals = total_referrals + 1,
          total_mining_power = total_mining_power + $2,
          referral_rewards_earned = referral_rewards_earned + 0.01
        WHERE address = $3
      `, [JSON.stringify(updatedInventory), additionalPower, referrerAddress]);
      
      // Mark session as completed
      await client.query(`
        UPDATE referral_visits 
        SET converted = true, converted_timestamp = NOW()
        WHERE id = $1
      `, [referralSession.id]);
      
      return res.json({
        success: true,
        referral_completed: true,
        message: 'Referral automatically completed!',
        referrer_address: referrerAddress,
        referred_address: address,
        reward_details: {
          pickaxe_type: rewardPickaxeType,
          pickaxe_count: 1,
          gold_reward: 100,
          new_referral_count: newReferralCount
        },
        session_id: referralSession.session_id
      });
      
    } catch (queryError) {
      console.error('❌ Auto completion query error:', queryError);
      throw queryError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Auto complete referral error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
}