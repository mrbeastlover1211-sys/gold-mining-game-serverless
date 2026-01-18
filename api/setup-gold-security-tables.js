// 🔒 Setup database tables for gold security and monitoring
// Creates tables for purchase tracking and suspicious activity logging

import { sql } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🔒 Setting up gold security tables...');

    // 1. Create gold_purchases table (for rate limiting)
    await sql`
      CREATE TABLE IF NOT EXISTS gold_purchases (
        id SERIAL PRIMARY KEY,
        user_address TEXT NOT NULL,
        pickaxe_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        gold_spent BIGINT NOT NULL,
        purchased_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Created gold_purchases table');

    // Create index for fast lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_gold_purchases_user_time 
      ON gold_purchases(user_address, purchased_at)
    `;
    console.log('✅ Created index on gold_purchases');

    // 2. Create suspicious_activity table (for admin monitoring)
    await sql`
      CREATE TABLE IF NOT EXISTS suspicious_activity (
        id SERIAL PRIMARY KEY,
        user_address TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        claimed_value NUMERIC,
        max_allowed_value NUMERIC,
        details JSONB,
        detected_at TIMESTAMP DEFAULT NOW(),
        reviewed BOOLEAN DEFAULT FALSE,
        admin_notes TEXT
      )
    `;
    console.log('✅ Created suspicious_activity table');

    // Create index for admin queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_suspicious_activity_user 
      ON suspicious_activity(user_address, detected_at)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_suspicious_activity_reviewed 
      ON suspicious_activity(reviewed, detected_at)
    `;
    console.log('✅ Created indexes on suspicious_activity');

    // Get counts
    const goldPurchaseCount = await sql`
      SELECT COUNT(*) as count FROM gold_purchases
    `;

    const suspiciousCount = await sql`
      SELECT COUNT(*) as count FROM suspicious_activity
    `;

    const unreviewedCount = await sql`
      SELECT COUNT(*) as count FROM suspicious_activity WHERE reviewed = FALSE
    `;

    console.log('✅ All gold security tables created successfully!');

    return res.status(200).json({
      success: true,
      message: 'Gold security tables created successfully',
      tables: {
        gold_purchases: {
          created: true,
          recordCount: parseInt(goldPurchaseCount[0].count)
        },
        suspicious_activity: {
          created: true,
          recordCount: parseInt(suspiciousCount[0].count),
          unreviewedCount: parseInt(unreviewedCount[0].count)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating gold security tables:', error);
    return res.status(500).json({
      error: 'Failed to create security tables',
      message: error.message
    });
  }
}
