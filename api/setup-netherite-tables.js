// Emergency setup API to create Netherite Challenge tables/columns
// Uses Neon Serverless `sql` client (no pool.connect / no connection leaks)
import { sql } from '../database.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('🔧 Ensuring Netherite Challenge schema...');

    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS netherite_challenges (
        id SERIAL PRIMARY KEY,
        referrer_address VARCHAR(100) NOT NULL,
        challenge_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        challenge_expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        bonus_claimed BOOLEAN DEFAULT false,
        referred_user_address VARCHAR(100),
        referred_purchase_time TIMESTAMP,
        bonus_awarded BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_netherite_challenges_referrer
      ON netherite_challenges(referrer_address, is_active)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_netherite_challenges_expires
      ON netherite_challenges(challenge_expires_at, is_active)
    `;

    // Add columns to referral_visits
    await sql`
      ALTER TABLE referral_visits
      ADD COLUMN IF NOT EXISTS netherite_challenge_id INTEGER REFERENCES netherite_challenges(id)
    `;

    await sql`
      ALTER TABLE referral_visits
      ADD COLUMN IF NOT EXISTS purchased_netherite BOOLEAN DEFAULT false
    `;

    await sql`
      ALTER TABLE referral_visits
      ADD COLUMN IF NOT EXISTS netherite_purchase_time TIMESTAMP
    `;

    // Add columns to users
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS netherite_challenge_accepted BOOLEAN DEFAULT false
    `;

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS netherite_challenge_shown BOOLEAN DEFAULT false
    `;

    console.log('✅ Netherite Challenge schema ensured');

    return res.json({
      success: true,
      message: '✅ Netherite Challenge tables and columns ensured successfully!',
      tables: ['netherite_challenges', 'referral_visits (updated)', 'users (updated)']
    });
  } catch (error) {
    console.error('❌ Error setting up Netherite Challenge schema:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to setup Netherite Challenge schema',
      details: error.message
    });
  }
}
