import { pool } from '../database.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;

  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing address parameter' 
      });
    }

    client = await pool.connect();

    // Check if user has active challenge
    const activeChallenge = await client.query(`
      SELECT * FROM netherite_challenges
      WHERE referrer_address = $1
        AND is_active = true
        AND challenge_expires_at > CURRENT_TIMESTAMP
      ORDER BY challenge_started_at DESC
      LIMIT 1
    `, [address]);

    if (activeChallenge.rows.length === 0) {
      return res.json({
        success: true,
        has_active_challenge: false,
        challenge_accepted: false
      });
    }

    const challenge = activeChallenge.rows[0];
    const now = new Date();
    const expiresAt = new Date(challenge.challenge_expires_at);
    const timeRemaining = Math.floor((expiresAt - now) / 1000);

    return res.json({
      success: true,
      has_active_challenge: true,
      challenge_accepted: true,
      challenge: {
        challenge_id: challenge.id,
        started_at: challenge.challenge_started_at,
        expires_at: challenge.challenge_expires_at,
        time_remaining_seconds: timeRemaining,
        is_expired: timeRemaining <= 0,
        bonus_claimed: challenge.bonus_claimed
      }
    });

  } catch (error) {
    console.error('❌ Error checking Netherite Challenge:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check challenge',
      details: error.message 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
