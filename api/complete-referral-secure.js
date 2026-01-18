// Secure Complete Referral API
// Server verifies requirements - prevents fake referral spam!

import { sql } from '../database.js';

// Referral requirements (must meet ALL to trigger reward)
const REFERRAL_REQUIREMENTS = {
  MIN_MINING_TIME_MINUTES: 60,        // Must mine for 1 hour
  MIN_GOLD_EARNED: 1000,              // Must earn 1000 gold
  MIN_CHECKPOINT_SAVES: 5             // Must have saved at least 5 times
};

// Referral rewards
const REFERRAL_REWARDS = {
  PICKAXE_TYPE: 'silver',
  PICKAXE_COUNT: 1,
  GOLD_REWARD: 100,
  MINING_POWER: 1  // Silver = 1 power
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refereeAddress, referrerAddress } = req.body;

    // Validate inputs
    if (!refereeAddress || !referrerAddress) {
      return res.status(400).json({ error: 'Missing required addresses' });
    }

    if (refereeAddress === referrerAddress) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    console.log(`🔗 Referral completion check:`);
    console.log(`   Referee: ${refereeAddress.slice(0, 8)}...`);
    console.log(`   Referrer: ${referrerAddress.slice(0, 8)}...`);

    // 🔒 SECURITY: Check if referral relationship exists and hasn't been rewarded
    const referralCheck = await sql`
      SELECT 
        id,
        referred_address,
        referrer_address,
        completed,
        created_at
      FROM referrals
      WHERE referred_address = ${refereeAddress}
        AND referrer_address = ${referrerAddress}
        AND completed = false
      LIMIT 1
    `;

    if (referralCheck.length === 0) {
      return res.status(400).json({ 
        error: 'No valid referral found or already completed',
        debug: {
          referralExists: false
        }
      });
    }

    const referral = referralCheck[0];
    const referralCreatedAt = new Date(referral.created_at).getTime() / 1000;

    // 🔒 SECURITY: Get referee's ACTUAL activity from database
    const refereeData = await sql`
      SELECT 
        address,
        last_checkpoint_gold,
        checkpoint_timestamp,
        created_at
      FROM users
      WHERE address = ${refereeAddress}
      LIMIT 1
    `;

    if (refereeData.length === 0) {
      return res.status(404).json({ error: 'Referee not found' });
    }

    const referee = refereeData[0];
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Calculate how long they've been active
    const accountCreatedAt = new Date(referee.created_at).getTime() / 1000;
    const minutesActive = (currentTime - accountCreatedAt) / 60;
    
    // Get their gold balance
    const goldEarned = parseFloat(referee.last_checkpoint_gold || 0);

    // 🔒 SECURITY: Count actual checkpoint saves (prevents spam clicking)
    const checkpointCount = await sql`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE user_address = ${refereeAddress}
        AND type = 'checkpoint'
    `;
    
    const saveCount = parseInt(checkpointCount[0]?.count || 0);

    console.log(`📊 Referee Activity:`);
    console.log(`   Time active: ${Math.floor(minutesActive)} minutes`);
    console.log(`   Gold earned: ${goldEarned}`);
    console.log(`   Checkpoints: ${saveCount}`);

    // 🔒 SECURITY: Verify ALL requirements are met
    const requirements = {
      hasMinedEnough: minutesActive >= REFERRAL_REQUIREMENTS.MIN_MINING_TIME_MINUTES,
      hasEarnedEnough: goldEarned >= REFERRAL_REQUIREMENTS.MIN_GOLD_EARNED,
      hasSavedEnough: saveCount >= REFERRAL_REQUIREMENTS.MIN_CHECKPOINT_SAVES
    };

    const allRequirementsMet = Object.values(requirements).every(req => req === true);

    if (!allRequirementsMet) {
      console.log(`❌ Requirements not met yet:`);
      console.log(`   Mining time: ${requirements.hasMinedEnough ? '✅' : '❌'} (${Math.floor(minutesActive)}/${REFERRAL_REQUIREMENTS.MIN_MINING_TIME_MINUTES} min)`);
      console.log(`   Gold earned: ${requirements.hasEarnedEnough ? '✅' : '❌'} (${goldEarned}/${REFERRAL_REQUIREMENTS.MIN_GOLD_EARNED})`);
      console.log(`   Checkpoints: ${requirements.hasSavedEnough ? '✅' : '❌'} (${saveCount}/${REFERRAL_REQUIREMENTS.MIN_CHECKPOINT_SAVES})`);
      
      return res.status(400).json({
        error: 'Referral requirements not met yet',
        requirements: {
          miningTime: { met: requirements.hasMinedEnough, current: Math.floor(minutesActive), required: REFERRAL_REQUIREMENTS.MIN_MINING_TIME_MINUTES },
          goldEarned: { met: requirements.hasEarnedEnough, current: goldEarned, required: REFERRAL_REQUIREMENTS.MIN_GOLD_EARNED },
          checkpoints: { met: requirements.hasSavedEnough, current: saveCount, required: REFERRAL_REQUIREMENTS.MIN_CHECKPOINT_SAVES }
        }
      });
    }

    console.log(`✅ All requirements met! Processing reward...`);

    // 🔒 SECURITY: Check if referrer exists
    const referrerData = await sql`
      SELECT 
        address,
        last_checkpoint_gold,
        ${sql(REFERRAL_REWARDS.PICKAXE_TYPE + '_pickaxes')} as current_pickaxes,
        total_mining_power
      FROM users
      WHERE address = ${referrerAddress}
      LIMIT 1
    `;

    if (referrerData.length === 0) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    const referrer = referrerData[0];

    // Calculate new values
    const newGold = parseFloat(referrer.last_checkpoint_gold) + REFERRAL_REWARDS.GOLD_REWARD;
    const newPickaxes = parseInt(referrer.current_pickaxes) + REFERRAL_REWARDS.PICKAXE_COUNT;
    const newMiningPower = parseInt(referrer.total_mining_power) + REFERRAL_REWARDS.MINING_POWER;

    // 🔒 SECURITY: Use database transaction to prevent double-claiming
    await sql.begin(async sql => {
      // Update referrer's rewards
      await sql`
        UPDATE users
        SET 
          last_checkpoint_gold = ${newGold},
          ${sql(REFERRAL_REWARDS.PICKAXE_TYPE + '_pickaxes')} = ${newPickaxes},
          total_mining_power = ${newMiningPower},
          checkpoint_timestamp = ${currentTime}
        WHERE address = ${referrerAddress}
      `;

      // Mark referral as completed (prevents duplicate rewards)
      await sql`
        UPDATE referrals
        SET 
          completed = true,
          completed_at = NOW()
        WHERE id = ${referral.id}
      `;

      // Log the transaction
      await sql`
        INSERT INTO transactions (
          user_address,
          type,
          amount,
          details,
          timestamp
        ) VALUES (
          ${referrerAddress},
          'referral_reward',
          ${REFERRAL_REWARDS.GOLD_REWARD},
          ${JSON.stringify({
            referee: refereeAddress,
            pickaxes: REFERRAL_REWARDS.PICKAXE_COUNT,
            pickaxe_type: REFERRAL_REWARDS.PICKAXE_TYPE,
            gold: REFERRAL_REWARDS.GOLD_REWARD
          })},
          NOW()
        )
      `;
    });

    console.log(`✅ Referral reward delivered to ${referrerAddress.slice(0, 8)}...`);

    return res.status(200).json({
      success: true,
      message: 'Referral completed successfully!',
      reward: {
        referrer: referrerAddress,
        goldAwarded: REFERRAL_REWARDS.GOLD_REWARD,
        pickaxesAwarded: `${REFERRAL_REWARDS.PICKAXE_COUNT}x ${REFERRAL_REWARDS.PICKAXE_TYPE}`,
        miningPowerAdded: REFERRAL_REWARDS.MINING_POWER,
        newTotals: {
          gold: newGold,
          pickaxes: newPickaxes,
          miningPower: newMiningPower
        }
      }
    });

  } catch (error) {
    console.error('❌ Complete referral error:', error);
    return res.status(500).json({
      error: 'Failed to complete referral',
      details: error.message
    });
  }
}
