// Secure Sell Gold API
// Server verifies ACTUAL balance from database - can't sell fake gold!

import { sql } from '../database.js';

// Gold to SOL conversion rate (should come from admin or config)
const GOLD_TO_SOL_RATE = 0.0001; // 10,000 gold = 1 SOL
const MIN_SELL_AMOUNT = 1000; // Minimum 1000 gold
const MAX_SELL_AMOUNT = 1000000; // Maximum 1M gold per transaction

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sellerAddress, goldAmount } = req.body;

    // Validate inputs
    if (!sellerAddress || sellerAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const goldToSell = parseFloat(goldAmount);
    
    if (isNaN(goldToSell) || goldToSell <= 0) {
      return res.status(400).json({ error: 'Invalid gold amount' });
    }

    if (goldToSell < MIN_SELL_AMOUNT) {
      return res.status(400).json({ 
        error: `Minimum sell amount is ${MIN_SELL_AMOUNT} gold`,
        minimum: MIN_SELL_AMOUNT
      });
    }

    if (goldToSell > MAX_SELL_AMOUNT) {
      return res.status(400).json({ 
        error: `Maximum sell amount is ${MAX_SELL_AMOUNT} gold per transaction`,
        maximum: MAX_SELL_AMOUNT
      });
    }

    console.log(`💰 Sell request from ${sellerAddress.slice(0, 8)}...`);
    console.log(`   Amount: ${goldToSell} gold`);

    // Calculate SOL payout
    const solPayout = goldToSell * GOLD_TO_SOL_RATE;
    console.log(`   SOL payout: ${solPayout}`);

    // 🔒 SECURITY: Get user's ACTUAL balance from database (NOT from request!)
    const users = await sql`
      SELECT 
        address,
        last_checkpoint_gold
      FROM users
      WHERE address = ${sellerAddress}
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const actualGoldBalance = parseFloat(user.last_checkpoint_gold || 0);

    console.log(`   Actual balance: ${actualGoldBalance} gold`);

    // 🔒 SECURITY: Verify user has enough gold in database
    if (actualGoldBalance < goldToSell) {
      console.log(`❌ Insufficient gold: ${actualGoldBalance} < ${goldToSell}`);
      return res.status(400).json({
        error: 'Insufficient gold balance',
        actualBalance: actualGoldBalance,
        requested: goldToSell,
        shortage: goldToSell - actualGoldBalance
      });
    }

    // 🔒 SECURITY: Check for duplicate pending sales
    const pendingSales = await sql`
      SELECT COUNT(*) as count
      FROM gold_sales
      WHERE seller_address = ${sellerAddress}
        AND status = 'pending'
    `;

    const pendingCount = parseInt(pendingSales[0].count || 0);
    
    if (pendingCount >= 3) {
      return res.status(400).json({
        error: 'You already have 3 pending sales. Wait for approval or cancellation.',
        pendingSalesCount: pendingCount
      });
    }

    // Calculate new balance after sale
    const newGoldBalance = actualGoldBalance - goldToSell;

    // 🔒 SECURITY: Use database transaction (atomic operation)
    const saleRecord = await sql.begin(async sql => {
      // Deduct gold immediately (reserve it for sale)
      await sql`
        UPDATE users
        SET 
          last_checkpoint_gold = ${newGoldBalance},
          checkpoint_timestamp = ${Math.floor(Date.now() / 1000)}
        WHERE address = ${sellerAddress}
      `;

      // Create sale record
      const sale = await sql`
        INSERT INTO gold_sales (
          seller_address,
          gold_amount,
          sol_price,
          status,
          created_at
        ) VALUES (
          ${sellerAddress},
          ${goldToSell},
          ${solPayout},
          'pending',
          NOW()
        )
        RETURNING id, created_at
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
          ${sellerAddress},
          'gold_sale_request',
          ${-goldToSell},
          ${JSON.stringify({
            gold_amount: goldToSell,
            sol_payout: solPayout,
            sale_id: sale[0].id,
            status: 'pending'
          })},
          NOW()
        )
      `;

      return sale[0];
    });

    console.log(`✅ Sale request created! Sale ID: ${saleRecord.id}`);
    console.log(`   Gold deducted from balance (reserved for sale)`);
    console.log(`   New balance: ${newGoldBalance} gold`);
    console.log(`   Status: Pending admin approval`);

    return res.status(200).json({
      success: true,
      message: 'Sale request created successfully! Awaiting admin approval.',
      sale: {
        saleId: saleRecord.id,
        goldAmount: goldToSell,
        solPayout: solPayout,
        status: 'pending',
        createdAt: saleRecord.created_at,
        note: 'Gold has been deducted from your balance and reserved for this sale. If rejected, gold will be refunded.'
      },
      newBalance: {
        gold: newGoldBalance,
        previousGold: actualGoldBalance
      }
    });

  } catch (error) {
    console.error('❌ Sell gold error:', error);
    return res.status(500).json({
      error: 'Failed to create sale request',
      details: error.message
    });
  }
}
