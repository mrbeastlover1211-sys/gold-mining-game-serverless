// 📊 REFERRAL STATUS API - Check referral statistics and eligibility
import { getPool } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  console.log('📊 Checking referral status for:', address.slice(0, 8) + '...');

  try {
    const pool = await getPool();
    const client = await pool.connect();

    try {
      // Get user's referral statistics (as referrer)
      const referrerStats = await client.query(`
        SELECT 
          COUNT(*) as total_referrals,
          COALESCE(SUM(CASE WHEN reward_given = true THEN 1 ELSE 0 END), 0) as completed_referrals,
          COALESCE(SUM(CASE WHEN reward_given = true THEN gold_rewarded ELSE 0 END), 0) as total_gold_earned
        FROM referrals 
        WHERE referrer_address = $1
      `, [address]);

      // Check if user was referred (as referee)
      const refereeStatus = await client.query(`
        SELECT r.*, rv.referrer_address, rv.session_id
        FROM referrals r
        RIGHT JOIN referral_visits rv ON rv.converted_address = r.referee_address
        WHERE r.referee_address = $1 OR rv.converted_address = $1
        ORDER BY COALESCE(r.created_at, rv.converted_timestamp) DESC
        LIMIT 1
      `, [address]);

      // Get pending referral sessions that could complete
      const pendingSessions = await client.query(`
        SELECT rv.*, u.has_land, u.inventory
        FROM referral_visits rv
        LEFT JOIN users u ON u.address = rv.converted_address
        WHERE rv.referrer_address = $1 
          AND rv.converted = true
          AND rv.expires_at > CURRENT_TIMESTAMP
          AND NOT EXISTS (
            SELECT 1 FROM referrals r 
            WHERE r.referee_address = rv.converted_address 
              AND r.reward_given = true
          )
      `, [address]);

      client.release();

      const stats = referrerStats.rows[0];
      const wasReferred = refereeStatus.rows.length > 0;
      const pendingCount = pendingSessions.rows.length;

      // Calculate potential rewards from pending sessions
      const readyToComplete = pendingSessions.rows.filter(session => {
        if (!session.has_land) return false;
        const inventory = session.inventory || {};
        const totalPickaxes = (inventory.silver || 0) + (inventory.gold || 0) + 
                             (inventory.diamond || 0) + (inventory.netherite || 0);
        return totalPickaxes > 0;
      }).length;

      const response = {
        success: true,
        user_address: address,
        referrer_stats: {
          total_referrals: parseInt(stats.total_referrals),
          completed_referrals: parseInt(stats.completed_referrals),
          pending_referrals: pendingCount,
          ready_to_complete: readyToComplete,
          total_gold_earned: parseFloat(stats.total_gold_earned)
        },
        was_referred: wasReferred,
        referral_details: wasReferred ? {
          referrer_address: refereeStatus.rows[0].referrer_address,
          reward_given: refereeStatus.rows[0].reward_given || false,
          gold_received: parseFloat(refereeStatus.rows[0].gold_rewarded || 0),
          session_id: refereeStatus.rows[0].session_id
        } : null,
        pending_sessions: pendingSessions.rows.map(session => ({
          converted_address: session.converted_address,
          session_id: session.session_id.slice(0, 20) + '...',
          has_land: session.has_land,
          has_pickaxes: session.inventory ? 
            ((session.inventory.silver || 0) + (session.inventory.gold || 0) + 
             (session.inventory.diamond || 0) + (session.inventory.netherite || 0)) > 0 : false,
          ready_for_completion: session.has_land && session.inventory ? 
            ((session.inventory.silver || 0) + (session.inventory.gold || 0) + 
             (session.inventory.diamond || 0) + (session.inventory.netherite || 0)) > 0 : false
        }))
      };

      console.log('📊 Referral status response:', {
        total_referrals: response.referrer_stats.total_referrals,
        completed: response.referrer_stats.completed_referrals,
        pending: response.referrer_stats.pending_referrals,
        ready: response.referrer_stats.ready_to_complete
      });

      return res.json(response);

    } catch (queryError) {
      client.release();
      throw queryError;
    }

  } catch (error) {
    console.error('❌ Referral status error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to get referral status',
      details: error.message 
    });
  }
}