// Simple Give Rewards API - No Auth Required (Use Carefully!)
// This is a temporary endpoint for quick testing
// DELETE THIS FILE in production and use give-rewards.js with auth instead

import { sql } from '../../database.js';

const MINING_POWER = {
  silver: 1,
  gold: 5,
  diamond: 20,
  netherite: 100
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      recipientAddress,
      goldAmount = 0,
      pickaxeType = null,
      pickaxeQuantity = 0,
      reason = 'Admin gift',
      adminName = 'admin'
    } = req.body;

    // Basic validation
    if (!recipientAddress || recipientAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    const gold = parseFloat(goldAmount) || 0;
    const quantity = parseInt(pickaxeQuantity) || 0;

    if (gold < 0 || quantity < 0) {
      return res.status(400).json({ error: 'Amounts cannot be negative' });
    }

    if (gold === 0 && quantity === 0) {
      return res.status(400).json({ error: 'Must give at least gold or pickaxes' });
    }

    console.log(`🎁 Giving reward to ${recipientAddress.slice(0, 8)}...`);
    console.log(`   Gold: ${gold}, Pickaxes: ${quantity}x ${pickaxeType || 'none'}`);

    // Calculate mining power
    let miningPowerAdded = 0;
    if (quantity > 0 && pickaxeType) {
      miningPowerAdded = MINING_POWER[pickaxeType] * quantity;
    }

    // Update user directly in database
    const pickaxeField = pickaxeType ? `${pickaxeType}_pickaxes` : null;
    
    if (pickaxeField) {
      await sql`
        UPDATE users
        SET 
          last_checkpoint_gold = last_checkpoint_gold + ${gold},
          ${sql(pickaxeField)} = ${sql(pickaxeField)} + ${quantity},
          total_mining_power = total_mining_power + ${miningPowerAdded},
          checkpoint_timestamp = ${Math.floor(Date.now() / 1000)}
        WHERE address = ${recipientAddress}
      `;
    } else {
      await sql`
        UPDATE users
        SET 
          last_checkpoint_gold = last_checkpoint_gold + ${gold},
          checkpoint_timestamp = ${Math.floor(Date.now() / 1000)}
        WHERE address = ${recipientAddress}
      `;
    }

    // Log the gift
    await sql`
      INSERT INTO admin_gifts (
        admin_username,
        recipient_address,
        gold_amount,
        pickaxe_type,
        pickaxe_quantity,
        mining_power_added,
        reason,
        status
      ) VALUES (
        ${adminName},
        ${recipientAddress},
        ${gold},
        ${pickaxeType},
        ${quantity},
        ${miningPowerAdded},
        ${reason},
        'completed'
      )
    `;

    // Get updated user stats
    const updatedUser = await sql`
      SELECT 
        last_checkpoint_gold,
        total_mining_power,
        silver_pickaxes,
        gold_pickaxes,
        diamond_pickaxes,
        netherite_pickaxes
      FROM users
      WHERE address = ${recipientAddress}
    `;

    console.log(`✅ Gift delivered successfully!`);

    return res.status(200).json({
      success: true,
      message: 'Rewards delivered successfully!',
      gift: {
        recipient: recipientAddress,
        goldGiven: gold,
        pickaxesGiven: quantity > 0 ? `${quantity}x ${pickaxeType}` : 'none',
        miningPowerAdded: miningPowerAdded,
        newUserStats: updatedUser[0]
      }
    });

  } catch (error) {
    console.error('❌ Give rewards error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to give rewards',
      details: error.message
    });
  }
}
