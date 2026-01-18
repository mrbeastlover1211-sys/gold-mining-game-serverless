// Simple referral checker
import { pool } from '../database.js';

export default async function handler(req, res) {
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }
  
  const client = await pool.connect();
  
  try {
    // Check referrals table
    const referralsTable = await client.query(`
      SELECT * FROM referrals WHERE referrer_address = $1
    `, [address]);
    
    // Check referral_visits table
    const visitsTable = await client.query(`
      SELECT * FROM referral_visits WHERE referrer_address = $1
    `, [address]);
    
    // Check users table for total_referrals
    const usersTable = await client.query(`
      SELECT address, total_referrals, referral_rewards_earned FROM users WHERE address = $1
    `, [address]);
    
    return res.json({
      address,
      referrals_table: {
        count: referralsTable.rows.length,
        data: referralsTable.rows
      },
      referral_visits_table: {
        count: visitsTable.rows.length,
        data: visitsTable.rows
      },
      users_table: {
        data: usersTable.rows[0] || null
      }
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
}
