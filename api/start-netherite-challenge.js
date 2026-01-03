import { sql } from '../database.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referrer_address } = req.body;

    if (!referrer_address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing referrer_address' 
      });
    }

    console.log('🔥 Starting Netherite Challenge for:', referrer_address.slice(0, 8) + '...');

    // Check if user already has an active challenge
    const existingChallenge = await sql`
      SELECT * FROM netherite_challenges
      WHERE referrer_address = ${referrer_address}
        AND is_active = true
        AND challenge_expires_at > CURRENT_TIMESTAMP
      ORDER BY challenge_started_at DESC
      LIMIT 1
    `;

    if (existingChallenge.length > 0) {
      const challenge = existingChallenge[0];
      const timeRemaining = Math.floor((new Date(challenge.challenge_expires_at) - new Date()) / 1000);
      
      console.log('⚠️ User already has active challenge, time remaining:', timeRemaining);
      
      return res.json({
        success: false,
        error: 'You already have an active Netherite Challenge!',
        existing_challenge: {
          challenge_id: challenge.id,
          expires_at: challenge.challenge_expires_at,
          time_remaining_seconds: timeRemaining
        }
      });
    }

    // Create new challenge (1 hour duration)
    const newChallenge = await sql`
      INSERT INTO netherite_challenges 
      (referrer_address, challenge_expires_at, is_active)
      VALUES (${referrer_address}, CURRENT_TIMESTAMP + INTERVAL '1 hour', true)
      RETURNING *
    `;

    const challenge = newChallenge[0];

    console.log('✅ Netherite Challenge created:', {
      id: challenge.id,
      starts: challenge.challenge_started_at,
      expires: challenge.challenge_expires_at
    });

    // Update user record to mark challenge as accepted
    await sql`
      INSERT INTO users (address, netherite_challenge_accepted)
      VALUES (${referrer_address}, true)
      ON CONFLICT (address) 
      DO UPDATE SET netherite_challenge_accepted = true
    `;

    return res.json({
      success: true,
      message: '🔥 Netherite Challenge started! Share your link now!',
      challenge: {
        challenge_id: challenge.id,
        referrer_address: challenge.referrer_address,
        started_at: challenge.challenge_started_at,
        expires_at: challenge.challenge_expires_at,
        duration_seconds: 3600,
        referral_link: `https://www.thegoldmining.com/?ref=${referrer_address}`
      }
    });

  } catch (error) {
    console.error('❌ Error starting Netherite Challenge:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to start challenge',
      details: error.message,
      stack: error.stack,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
  }
}
