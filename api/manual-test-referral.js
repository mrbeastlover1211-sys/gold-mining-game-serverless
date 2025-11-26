// 🧪 MANUAL REFERRAL TEST - Test the referral system manually
import { getPool } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referrer_address, referee_address, action = 'test_complete' } = req.body;

  if (!referrer_address || !referee_address) {
    return res.status(400).json({ error: 'Missing referrer_address or referee_address' });
  }

  console.log('🧪 Manual referral test:', { referrer_address, referee_address, action });

  try {
    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Check if users exist and their current state
      const referrerCheck = await client.query(`
        SELECT address, gold, inventory, total_referrals, referral_gold_earned, has_land
        FROM users WHERE address = $1
      `, [referrer_address]);

      const refereeCheck = await client.query(`
        SELECT address, gold, inventory, has_land
        FROM users WHERE address = $1
      `, [referee_address]);

      if (referrerCheck.rows.length === 0) {
        throw new Error('Referrer not found in database');
      }

      if (refereeCheck.rows.length === 0) {
        throw new Error('Referee not found in database');
      }

      const referrer = referrerCheck.rows[0];
      const referee = refereeCheck.rows[0];

      // Calculate referee's pickaxe count
      const refereeInventory = referee.inventory || {};
      const totalPickaxes = (refereeInventory.silver || 0) + (refereeInventory.gold || 0) + 
                           (refereeInventory.diamond || 0) + (refereeInventory.netherite || 0);

      console.log('👥 User states:', {
        referrer: {
          address: referrer.address.slice(0, 8) + '...',
          gold: parseFloat(referrer.gold),
          total_referrals: referrer.total_referrals,
          has_land: referrer.has_land
        },
        referee: {
          address: referee.address.slice(0, 8) + '...',
          gold: parseFloat(referee.gold),
          has_land: referee.has_land,
          total_pickaxes: totalPickaxes
        }
      });

      // 2. Check if referral session exists
      const sessionCheck = await client.query(`
        SELECT * FROM referral_visits 
        WHERE referrer_address = $1 AND converted_address = $2
        ORDER BY converted_timestamp DESC LIMIT 1
      `, [referrer_address, referee_address]);

      let sessionExists = sessionCheck.rows.length > 0;
      let session = sessionExists ? sessionCheck.rows[0] : null;

      console.log('📊 Session check:', {
        exists: sessionExists,
        session_id: session?.session_id?.slice(0, 20) + '...' || 'none',
        converted: session?.converted || false
      });

      // 3. Create session if it doesn't exist (for testing)
      if (!sessionExists && action === 'test_complete') {
        console.log('🔧 Creating test referral session...');
        
        const sessionId = 'manual_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await client.query(`
          INSERT INTO referral_visits (
            session_id, referrer_address, visitor_ip, user_agent, 
            visit_timestamp, converted_address, converted, 
            converted_timestamp, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          sessionId,
          referrer_address,
          'manual_test',
          'manual_test_agent',
          new Date(),
          referee_address,
          true,
          new Date(),
          new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
        ]);

        session = { session_id: sessionId, referrer_address, converted_address: referee_address };
        sessionExists = true;
        
        console.log('✅ Created test session:', sessionId);
      }

      // 4. Check if referral already completed
      const referralCheck = await client.query(`
        SELECT * FROM referrals 
        WHERE referrer_address = $1 AND referee_address = $2
      `, [referrer_address, referee_address]);

      const alreadyRewarded = referralCheck.rows.length > 0 && referralCheck.rows[0].reward_given;

      console.log('🎁 Referral reward status:', {
        exists: referralCheck.rows.length > 0,
        already_rewarded: alreadyRewarded
      });

      // 5. Check requirements
      const requirementsMet = referee.has_land && totalPickaxes > 0;

      console.log('✅ Requirements check:', {
        has_land: referee.has_land,
        total_pickaxes: totalPickaxes,
        requirements_met: requirementsMet
      });

      // 6. Complete referral if requirements met and not already rewarded
      let rewardGiven = false;
      let rewardDetails = null;

      if (requirementsMet && !alreadyRewarded && sessionExists && action === 'test_complete') {
        console.log('🎁 Completing referral manually...');

        const GOLD_REWARD = 100;
        const PICKAXE_REWARD = 'silver';

        // Update referrer's gold and inventory
        const referrerUpdate = await client.query(`
          UPDATE users 
          SET 
            gold = gold + $1,
            inventory = jsonb_set(
              inventory, 
              '{silver}', 
              ((COALESCE((inventory->>'silver')::int, 0)) + 1)::text::jsonb
            ),
            total_referrals = total_referrals + 1,
            referral_gold_earned = referral_gold_earned + $1,
            last_update = extract(epoch from now())
          WHERE address = $2
          RETURNING gold, inventory, total_referrals, referral_gold_earned
        `, [GOLD_REWARD, referrer_address]);

        // Record the referral
        await client.query(`
          INSERT INTO referrals (
            referrer_address, referee_address, reward_given, 
            gold_rewarded, pickaxe_rewarded, completion_trigger, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (referee_address) DO UPDATE SET
            reward_given = true,
            gold_rewarded = $4,
            pickaxe_rewarded = $5,
            completion_trigger = $6
        `, [referrer_address, referee_address, true, GOLD_REWARD, PICKAXE_REWARD, 'manual_test']);

        rewardGiven = true;
        rewardDetails = {
          gold_reward: GOLD_REWARD,
          pickaxe_reward: PICKAXE_REWARD,
          referrer_new_state: referrerUpdate.rows[0]
        };

        console.log('🎉 Referral completed successfully!', rewardDetails);
      }

      await client.query('COMMIT');
      client.release();

      const result = {
        success: true,
        test_type: action,
        users: {
          referrer: {
            address: referrer.address.slice(0, 8) + '...',
            gold_before: parseFloat(referrer.gold),
            gold_after: rewardGiven ? parseFloat(rewardDetails.referrer_new_state.gold) : parseFloat(referrer.gold),
            total_referrals_before: referrer.total_referrals,
            total_referrals_after: rewardGiven ? rewardDetails.referrer_new_state.total_referrals : referrer.total_referrals,
            has_land: referrer.has_land
          },
          referee: {
            address: referee.address.slice(0, 8) + '...',
            has_land: referee.has_land,
            total_pickaxes: totalPickaxes,
            requirements_met: requirementsMet
          }
        },
        referral_session: {
          exists: sessionExists,
          session_id: session?.session_id?.slice(0, 20) + '...' || 'none'
        },
        completion_status: {
          already_rewarded: alreadyRewarded,
          requirements_met: requirementsMet,
          reward_given_now: rewardGiven,
          reward_details: rewardDetails
        },
        next_steps: !requirementsMet ? 'Referee needs to buy land and pickaxe' :
                    alreadyRewarded ? 'Referral already completed' :
                    !sessionExists ? 'No referral session found' :
                    rewardGiven ? 'Referral completed successfully!' :
                    'Unknown issue - check logs'
      };

      console.log('🧪 Manual test complete:', result);
      return res.json(result);

    } catch (queryError) {
      await client.query('ROLLBACK');
      client.release();
      throw queryError;
    }

  } catch (error) {
    console.error('❌ Manual test error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Manual test failed',
      details: error.message 
    });
  }
}