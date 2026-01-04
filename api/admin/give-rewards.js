// Admin API - Give Free Rewards (Gold + Pickaxes)
// Secure endpoint for admins to grant free rewards to users

import { sql } from '../../database.js';
import { getUserOptimized, saveUserOptimized } from '../../database.js';

// Pickaxe mining power values (gold per minute)
const MINING_POWER = {
  silver: 1,
  gold: 10,
  diamond: 100,
  netherite: 1000
};

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔐 Verify admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', requireLogin: true });
    }

    const token = authHeader.substring(7);

    // Verify token (simplified - matches your auth.js implementation)
    const adminSession = await sql`
      SELECT username, created_at
      FROM admin_sessions
      WHERE session_token = ${token}
        AND expires_at > NOW()
        AND is_active = true
      LIMIT 1
    `;

    if (adminSession.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session', requireLogin: true });
    }

    const adminUsername = adminSession[0].username;

    // 📝 Get request parameters
    const {
      recipientAddress,
      goldAmount = 0,
      pickaxeType = null,
      pickaxeQuantity = 0,
      reason = 'Admin gift'
    } = req.body;

    // ✅ Validate inputs
    if (!recipientAddress || typeof recipientAddress !== 'string' || recipientAddress.length < 32) {
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

    if (quantity > 0 && !pickaxeType) {
      return res.status(400).json({ error: 'Pickaxe type required when quantity > 0' });
    }

    if (pickaxeType && !['silver', 'gold', 'diamond', 'netherite'].includes(pickaxeType)) {
      return res.status(400).json({ error: 'Invalid pickaxe type' });
    }

    if (quantity > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 pickaxes per gift' });
    }

    if (gold > 10000000) {
      return res.status(400).json({ error: 'Maximum 10,000,000 gold per gift' });
    }

    console.log(`🎁 Admin ${adminUsername} giving reward to ${recipientAddress.slice(0, 8)}...`);
    console.log(`   Gold: ${gold}, Pickaxes: ${quantity}x ${pickaxeType || 'none'}`);

    // 🔍 Check if user exists
    let user = await getUserOptimized(recipientAddress, false);

    if (!user) {
      // Create new user if doesn't exist
      console.log(`   Creating new user for ${recipientAddress.slice(0, 8)}...`);
      user = {
        address: recipientAddress,
        has_land: false,
        silver_pickaxes: 0,
        gold_pickaxes: 0,
        diamond_pickaxes: 0,
        netherite_pickaxes: 0,
        last_checkpoint_gold: 0,
        checkpoint_timestamp: Math.floor(Date.now() / 1000),
        total_mining_power: 0
      };
    }

    // 📊 Calculate mining power increase
    let miningPowerAdded = 0;
    if (quantity > 0 && pickaxeType) {
      miningPowerAdded = MINING_POWER[pickaxeType] * quantity;
    }

    // 🎁 Apply rewards to user
    const updatedUser = {
      ...user,
      last_checkpoint_gold: parseFloat(user.last_checkpoint_gold || 0) + gold,
      checkpoint_timestamp: Math.floor(Date.now() / 1000),
      total_mining_power: parseInt(user.total_mining_power || 0) + miningPowerAdded
    };

    // Add pickaxes
    if (quantity > 0 && pickaxeType) {
      const pickaxeField = `${pickaxeType}_pickaxes`;
      updatedUser[pickaxeField] = parseInt(user[pickaxeField] || 0) + quantity;
    }

    // 💾 Save user data
    await saveUserOptimized(recipientAddress, updatedUser);

    // 📝 Log the admin gift in database
    const giftRecord = await sql`
      INSERT INTO admin_gifts (
        admin_username,
        admin_ip,
        recipient_address,
        gold_amount,
        pickaxe_type,
        pickaxe_quantity,
        mining_power_added,
        reason,
        status
      ) VALUES (
        ${adminUsername},
        ${req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'},
        ${recipientAddress},
        ${gold},
        ${pickaxeType},
        ${quantity},
        ${miningPowerAdded},
        ${reason},
        'completed'
      )
      RETURNING id, created_at
    `;

    // 📝 Also log in admin_logs for audit trail
    await sql`
      INSERT INTO admin_logs (
        admin_address,
        action,
        target_user,
        new_values,
        reason,
        ip_address
      ) VALUES (
        ${adminUsername},
        'give_free_rewards',
        ${recipientAddress},
        ${JSON.stringify({
          gold_amount: gold,
          pickaxe_type: pickaxeType,
          pickaxe_quantity: quantity,
          mining_power_added: miningPowerAdded
        })},
        ${reason},
        ${req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null}
      )
    `;

    console.log(`✅ Gift delivered successfully! Gift ID: ${giftRecord[0].id}`);

    // 🎉 Return success with details
    return res.status(200).json({
      success: true,
      message: 'Rewards delivered successfully!',
      gift: {
        id: giftRecord[0].id,
        createdAt: giftRecord[0].created_at,
        recipient: recipientAddress,
        goldGiven: gold,
        pickaxesGiven: quantity > 0 ? `${quantity}x ${pickaxeType}` : 'none',
        miningPowerAdded: miningPowerAdded,
        newUserStats: {
          totalGold: updatedUser.last_checkpoint_gold,
          totalMiningPower: updatedUser.total_mining_power,
          silverPickaxes: updatedUser.silver_pickaxes,
          goldPickaxes: updatedUser.gold_pickaxes,
          diamondPickaxes: updatedUser.diamond_pickaxes,
          netheritePickaxes: updatedUser.netherite_pickaxes
        }
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
