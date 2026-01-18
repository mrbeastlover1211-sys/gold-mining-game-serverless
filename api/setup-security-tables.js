// 🔒 Setup database table for transaction verification
// Run this once to create the verified_transactions table

import { sql } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🔒 Creating verified_transactions table...');

    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS verified_transactions (
        id SERIAL PRIMARY KEY,
        signature TEXT UNIQUE NOT NULL,
        user_address TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount_lamports BIGINT NOT NULL,
        verified_at TIMESTAMP DEFAULT NOW(),
        block_time BIGINT
      )
    `;

    console.log('✅ Table created successfully!');

    // Create index for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_verified_tx_signature 
      ON verified_transactions(signature)
    `;

    console.log('✅ Index created successfully!');

    // Check if table exists and has data
    const count = await sql`
      SELECT COUNT(*) as count FROM verified_transactions
    `;

    return res.status(200).json({
      success: true,
      message: 'Security tables created successfully',
      transactionCount: parseInt(count[0].count)
    });

  } catch (error) {
    console.error('❌ Error creating security tables:', error);
    return res.status(500).json({
      error: 'Failed to create security tables',
      message: error.message
    });
  }
}
