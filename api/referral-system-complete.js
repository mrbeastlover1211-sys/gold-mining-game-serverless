// 🎁 COMPLETE REFERRAL SYSTEM - Recreated with proper session tracking and rewards
import { pool } from '../database.js';

export default async function handler(req, res) {
  console.log('🎁 Complete Referral System Handler');
  
  try {
    const { method, query, body } = req;
    
    if (method === 'GET') {
      return handleGetReferralStatus(query, res);
    } else if (method === 'POST') {
      return handleCompleteReferral(body, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('❌ Referral system error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Referral system error',
      details: error.message 
    });
  }
}

// GET: Check referral status and eligibility
async function handleGetReferralStatus(query, res) {
  const { address } = query;
  
  if (!address) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  console.log('🔍 Checking referral status for:', address.slice(0, 8) + '...');

  // pool already imported
  const client = await pool.connect();

  try {
    // Check if this user was referred (has a referral session)
    const referralCheck = await client.query(`
      SELECT rv.*, u.gold as referrer_gold, u.inventory as referrer_inventory
      FROM referral_visits rv
      LEFT JOIN users u ON u.address = rv.referrer_address
      WHERE rv.converted_address = $1 
        AND rv.converted = true
        AND rv.expires_at > CURRENT_TIMESTAMP
      ORDER BY rv.converted_timestamp DESC
      LIMIT 1
    `, [address]);

    if (referralCheck.rows.length === 0) {
      return res.json({
        success: true,
        is_referred_user: false,
        message: 'User was not referred or session expired'
      });
    }

    const referralData = referralCheck.rows[0];
    
    // Check if user has completed requirements (land + any pickaxe purchase)
    const userCheck = await client.query(`
      SELECT 
        has_land,
        inventory,
        gold,
        (COALESCE((inventory->>'silver')::int, 0) + 
         COALESCE((inventory->>'gold')::int, 0) + 
         COALESCE((inventory->>'diamond')::int, 0) + 
         COALESCE((inventory->>'netherite')::int, 0)) as total_pickaxes
      FROM users 
      WHERE address = $1
    `, [address]);

    if (userCheck.rows.length === 0) {
      return res.json({
        success: true,
        is_referred_user: true,
        referrer_address: referralData.referrer_address,
        requirements_met: false,
        message: 'User not found in database'
      });
    }

    const userData = userCheck.rows[0];
    const requirementsMet = userData.has_land && userData.total_pickaxes > 0;

    // Check if reward already given
    const rewardCheck = await client.query(`
      SELECT * FROM referrals 
      WHERE referee_address = $1 AND reward_given = true
    `, [address]);

    const rewardAlreadyGiven = rewardCheck.rows.length > 0;

    client.release();

    return res.json({
      success: true,
      is_referred_user: true,
      referrer_address: referralData.referrer_address,
      session_id: referralData.session_id,
      requirements_met: requirementsMet,
      reward_given: rewardAlreadyGiven,
      user_status: {
        has_land: userData.has_land,
        total_pickaxes: userData.total_pickaxes,
        current_gold: parseFloat(userData.gold || 0)
      },
      message: rewardAlreadyGiven ? 'Reward already given' : 
               requirementsMet ? 'Ready for reward' : 
               'Requirements not yet met'
    });

  } catch (error) {
    client.release();
    throw error;
  }
}

// POST: Complete referral and give rewards
async function handleCompleteReferral(body, res) {
  const { address, force = false, trigger = 'manual' } = body;
  
  if (!address) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  console.log('🎁 Processing referral completion for:', address.slice(0, 8) + '...', 
              'Force:', force, 'Trigger:', trigger);

  // pool already imported
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Step 1: Find referral session
    const sessionCheck = await client.query(`
      SELECT rv.*, u.gold as referrer_gold, u.inventory as referrer_inventory
      FROM referral_visits rv
      LEFT JOIN users u ON u.address = rv.referrer_address
      WHERE rv.converted_address = $1 
        AND rv.converted = true
        AND rv.expires_at > CURRENT_TIMESTAMP
      ORDER BY rv.converted_timestamp DESC
      LIMIT 1
    `, [address]);

    if (sessionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.json({
        success: false,
        message: 'No valid referral session found for this user',
        referral_completed: false
      });
    }

    const referralData = sessionCheck.rows[0];
    const referrerAddress = referralData.referrer_address;

    console.log('🔍 Found referral session:', {
      referrer: referrerAddress.slice(0, 8) + '...',
      session: referralData.session_id.slice(0, 20) + '...'
    });

    // Step 2: Check if reward already given
    const existingReward = await client.query(`
      SELECT * FROM referrals 
      WHERE referee_address = $1 AND referrer_address = $2
    `, [address, referrerAddress]);

    if (existingReward.rows.length > 0 && existingReward.rows[0].reward_given) {
      await client.query('ROLLBACK');
      client.release();
      return res.json({
        success: false,
        message: 'Reward already given for this referral',
        referral_completed: true,
        already_rewarded: true
      });
    }

    // Step 3: Check requirements (land + pickaxe)
    const userCheck = await client.query(`
      SELECT 
        has_land,
        inventory,
        gold,
        (COALESCE((inventory->>'silver')::int, 0) + 
         COALESCE((inventory->>'gold')::int, 0) + 
         COALESCE((inventory->>'diamond')::int, 0) + 
         COALESCE((inventory->>'netherite')::int, 0)) as total_pickaxes
      FROM users 
      WHERE address = $1
    `, [address]);

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.json({
        success: false,
        message: 'Referred user not found in database',
        referral_completed: false
      });
    }

    const userData = userCheck.rows[0];
    const requirementsMet = userData.has_land && userData.total_pickaxes > 0;

    if (!requirementsMet && !force) {
      await client.query('ROLLBACK');
      client.release();
      return res.json({
        success: false,
        message: 'Requirements not met yet (need land + pickaxe)',
        referral_completed: false,
        requirements: {
          has_land: userData.has_land,
          has_pickaxe: userData.total_pickaxes > 0,
          total_pickaxes: userData.total_pickaxes
        }
      });
    }

    // Step 4: Give rewards to referrer
    const GOLD_REWARD = 100;
    const PICKAXE_REWARD = 'silver'; // Give free silver pickaxe

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
    `, [GOLD_REWARD, referrerAddress]);

    if (referrerUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.json({
        success: false,
        message: 'Referrer not found in database',
        referral_completed: false
      });
    }

    const updatedReferrer = referrerUpdate.rows[0];

    // Step 5: Record the referral in referrals table
    await client.query(`
      INSERT INTO referrals (
        referrer_address, 
        referee_address, 
        reward_given, 
        gold_rewarded,
        pickaxe_rewarded,
        completion_trigger,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (referee_address) DO UPDATE SET
        reward_given = true,
        gold_rewarded = $4,
        pickaxe_rewarded = $5,
        completion_trigger = $6,
        created_at = CURRENT_TIMESTAMP
    `, [referrerAddress, address, true, GOLD_REWARD, PICKAXE_REWARD, trigger]);

    // Step 6: Mark referral visit as completed
    await client.query(`
      UPDATE referral_visits
      SET 
        completion_checked = true,
        reward_completed = true,
        reward_timestamp = CURRENT_TIMESTAMP
      WHERE session_id = $1
    `, [referralData.session_id]);

    // Commit transaction
    await client.query('COMMIT');
    client.release();

    console.log('🎉 Referral completed successfully!', {
      referrer: referrerAddress.slice(0, 8) + '...',
      referee: address.slice(0, 8) + '...',
      gold_given: GOLD_REWARD,
      pickaxe_given: PICKAXE_REWARD,
      new_referrer_gold: parseFloat(updatedReferrer.gold),
      total_referrals: updatedReferrer.total_referrals
    });

    return res.json({
      success: true,
      message: 'Referral completed and rewards given!',
      referral_completed: true,
      reward_details: {
        referrer_address: referrerAddress,
        referee_address: address,
        gold_reward: GOLD_REWARD,
        pickaxe_reward: PICKAXE_REWARD,
        referrer_new_gold: parseFloat(updatedReferrer.gold),
        referrer_total_referrals: updatedReferrer.total_referrals,
        trigger: trigger,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('❌ Referral completion error:', error);
    throw error;
  }
}