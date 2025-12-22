// 🗑️ CLEAR ALL REFERRAL SESSIONS - Fresh Start
import { pool } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🗑️ Clearing ALL referral sessions for fresh start...');
    
    // pool already imported
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Clear all referral visits/sessions
      const clearVisits = await client.query('DELETE FROM referral_visits');
      console.log(`🗑️ Deleted ${clearVisits.rowCount} referral visits`);

      // Clear all referral completions
      const clearReferrals = await client.query('DELETE FROM referrals');
      console.log(`🗑️ Deleted ${clearReferrals.rowCount} referral completions`);

      // Reset referral stats in users table
      const resetStats = await client.query(`
        UPDATE users 
        SET 
          total_referrals = 0,
          referral_gold_earned = 0
        WHERE total_referrals > 0 OR referral_gold_earned > 0
      `);
      console.log(`🗑️ Reset referral stats for ${resetStats.rowCount} users`);

      await client.query('COMMIT');
      client.release();

      // Clear memory cache
      if (typeof global !== 'undefined') {
        global.users = {};
        console.log('✅ Cleared global memory cache');
      }

      const response = {
        success: true,
        message: 'ALL referral sessions cleared successfully',
        cleared: {
          referral_visits: clearVisits.rowCount,
          referral_completions: clearReferrals.rowCount,
          user_stats_reset: resetStats.rowCount
        },
        next_steps: [
          '1. Create new referral link',
          '2. Test with fresh browser/incognito window',
          '3. Complete land + pickaxe purchase',
          '4. Check for referral rewards'
        ]
      };

      console.log('✅ All referral sessions cleared:', response);
      return res.json(response);

    } catch (queryError) {
      await client.query('ROLLBACK');
      client.release();
      throw queryError;
    }

  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to clear sessions',
      details: error.message 
    });
  }
}