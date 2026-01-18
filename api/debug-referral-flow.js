// 🔍 DEBUG REFERRAL FLOW - See exactly what's happening
import { pool } from '../database.js';

export default async function handler(req, res) {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'address parameter required' });
    }
    
    const client = await pool.connect();
    
    try {
      // Check referral_visits
      const visits = await client.query(`
        SELECT * FROM referral_visits 
        WHERE converted_address = $1 OR referrer_address = $1
        ORDER BY visit_timestamp DESC
      `, [address]);
      
      // Check referrals table
      const referrals = await client.query(`
        SELECT * FROM referrals 
        WHERE referred_address = $1 OR referrer_address = $1
        ORDER BY created_at DESC
      `, [address]);
      
      // Check user data
      const userData = await client.query(`
        SELECT 
          address, has_land, 
          silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes,
          total_referrals, referral_rewards_earned, referrer_address
        FROM users 
        WHERE address = $1
      `, [address]);
      
      client.release();
      
      return res.json({
        success: true,
        address: address,
        debug_info: {
          user_data: userData.rows[0] || null,
          referral_visits_as_referred: visits.rows.filter(v => v.converted_address === address),
          referral_visits_as_referrer: visits.rows.filter(v => v.referrer_address === address),
          referrals_as_referred: referrals.rows.filter(r => r.referred_address === address),
          referrals_as_referrer: referrals.rows.filter(r => r.referrer_address === address)
        }
      });
      
    } catch (queryError) {
      client.release();
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ Debug referral flow error:', error);
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}
