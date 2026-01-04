// Secure Buy With Gold API
// Server verifies balance BEFORE purchase - can't buy without gold!

import { sql } from '../database.js';

// Item prices and mining power values
const ITEMS = {
  silver_pickaxe: {
    price: 100,
    miningPower: 1
  },
  gold_pickaxe: {
    price: 1000,
    miningPower: 10
  },
  diamond_pickaxe: {
    price: 10000,
    miningPower: 100
  },
  netherite_pickaxe: {
    price: 100000,
    miningPower: 1000
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, itemType, quantity = 1 } = req.body;

    // Validate inputs
    if (!address || address.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (!itemType || !ITEMS[itemType]) {
      return res.status(400).json({ 
        error: 'Invalid item type',
        validItems: Object.keys(ITEMS)
      });
    }

    const qty = parseInt(quantity);
    if (qty <= 0 || qty > 100) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
    }

    console.log(`🛒 Purchase request from ${address.slice(0, 8)}...`);
    console.log(`   Item: ${itemType}`);
    console.log(`   Quantity: ${qty}`);

    // Calculate total cost
    const item = ITEMS[itemType];
    const totalCost = item.price * qty;
    const totalMiningPower = item.miningPower * qty;

    console.log(`   Total cost: ${totalCost} gold`);

    // 🔒 SECURITY: Get user's ACTUAL balance from database
    const users = await sql`
      SELECT 
        address,
        last_checkpoint_gold,
        ${sql(itemType + 's')} as current_item_count,
        total_mining_power
      FROM users
      WHERE address = ${address}
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const currentGold = parseFloat(user.last_checkpoint_gold || 0);

    console.log(`   User balance: ${currentGold} gold`);

    // 🔒 SECURITY: Verify user has enough gold
    if (currentGold < totalCost) {
      console.log(`❌ Insufficient funds: ${currentGold} < ${totalCost}`);
      return res.status(400).json({
        error: 'Insufficient gold',
        balance: currentGold,
        required: totalCost,
        shortage: totalCost - currentGold
      });
    }

    // Calculate new values
    const newGold = currentGold - totalCost;
    const newItemCount = parseInt(user.current_item_count || 0) + qty;
    const newMiningPower = parseInt(user.total_mining_power || 0) + totalMiningPower;

    // 🔒 SECURITY: Use database transaction (atomic operation)
    await sql.begin(async sql => {
      // Deduct gold and add items
      await sql`
        UPDATE users
        SET 
          last_checkpoint_gold = ${newGold},
          ${sql(itemType + 's')} = ${newItemCount},
          total_mining_power = ${newMiningPower},
          checkpoint_timestamp = ${Math.floor(Date.now() / 1000)}
        WHERE address = ${address}
      `;

      // Log the purchase
      await sql`
        INSERT INTO transactions (
          user_address,
          type,
          amount,
          details,
          timestamp
        ) VALUES (
          ${address},
          'purchase',
          ${-totalCost},
          ${JSON.stringify({
            item: itemType,
            quantity: qty,
            price_per_item: item.price,
            total_cost: totalCost,
            mining_power_added: totalMiningPower
          })},
          NOW()
        )
      `;
    });

    console.log(`✅ Purchase completed!`);
    console.log(`   New balance: ${newGold} gold`);
    console.log(`   New ${itemType} count: ${newItemCount}`);

    return res.status(200).json({
      success: true,
      message: 'Purchase successful!',
      purchase: {
        item: itemType,
        quantity: qty,
        costPerItem: item.price,
        totalCost: totalCost,
        miningPowerAdded: totalMiningPower
      },
      newBalance: {
        gold: newGold,
        itemCount: newItemCount,
        miningPower: newMiningPower
      }
    });

  } catch (error) {
    console.error('❌ Purchase error:', error);
    return res.status(500).json({
      error: 'Failed to complete purchase',
      details: error.message
    });
  }
}
