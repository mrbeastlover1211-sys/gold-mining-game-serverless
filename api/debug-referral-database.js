// 🔍 DEBUG REFERRAL DATABASE - Check actual database state
import { getPool } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔍 DEBUG: Checking referral database state...');

  try {
    const pool = await getPool();
    const client = await pool.connect();

    try {
      // 1. Check referral_visits table
      console.log('📊 Checking referral_visits table...');
      const visits = await client.query(`
        SELECT 
          session_id, 
          referrer_address, 
          converted_address, 
          converted, 
          visit_timestamp, 
          converted_timestamp,
          expires_at,
          completion_checked,
          reward_completed
        FROM referral_visits 
        ORDER BY visit_timestamp DESC 
        LIMIT 10
      `);

      // 2. Check referrals table
      console.log('📊 Checking referrals table...');
      const referrals = await client.query(`
        SELECT 
          referrer_address, 
          referee_address, 
          reward_given, 
          gold_rewarded,
          pickaxe_rewarded,
          completion_trigger,
          created_at
        FROM referrals 
        ORDER BY created_at DESC 
        LIMIT 10
      `);

      // 3. Check users table for referral data
      console.log('📊 Checking users table referral stats...');
      const users = await client.query(`
        SELECT 
          address,
          has_land,
          inventory,
          total_referrals,
          referral_gold_earned,
          gold
        FROM users 
        WHERE total_referrals > 0 OR referral_gold_earned > 0
        ORDER BY total_referrals DESC
        LIMIT 10
      `);

      // 4. Check for users with land and pickaxes (potential referral completions)
      console.log('📊 Checking potential referral completions...');
      const potentialCompletions = await client.query(`
        SELECT 
          rv.session_id,
          rv.referrer_address,
          rv.converted_address,
          rv.converted,
          rv.completion_checked,
          u.has_land,
          u.inventory,
          r.reward_given
        FROM referral_visits rv
        LEFT JOIN users u ON u.address = rv.converted_address
        LEFT JOIN referrals r ON r.referee_address = rv.converted_address
        WHERE rv.converted = true 
          AND rv.expires_at > CURRENT_TIMESTAMP
        ORDER BY rv.converted_timestamp DESC
        LIMIT 20
      `);

      // 5. Check table structures
      console.log('📊 Checking table structures...');
      const visitsStructure = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'referral_visits' 
        ORDER BY ordinal_position
      `);

      const referralsStructure = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'referrals' 
        ORDER BY ordinal_position
      `);

      client.release();

      // Calculate completion statistics
      const totalSessions = visits.rows.length;
      const convertedSessions = visits.rows.filter(v => v.converted).length;
      const completedReferrals = referrals.rows.filter(r => r.reward_given).length;
      const readyForCompletion = potentialCompletions.rows.filter(p => {
        if (!p.has_land) return false;
        const inventory = p.inventory || {};
        const totalPickaxes = (inventory.silver || 0) + (inventory.gold || 0) + 
                             (inventory.diamond || 0) + (inventory.netherite || 0);
        return totalPickaxes > 0 && !p.reward_given;
      }).length;

      const debugData = {
        success: true,
        timestamp: new Date().toISOString(),
        statistics: {
          total_visits: totalSessions,
          converted_sessions: convertedSessions,
          completed_referrals: completedReferrals,
          ready_for_completion: readyForCompletion
        },
        tables: {
          referral_visits: {
            count: visits.rows.length,
            structure: visitsStructure.rows,
            recent_data: visits.rows.map(row => ({
              ...row,
              session_id: row.session_id?.slice(0, 20) + '...',
              referrer_address: row.referrer_address?.slice(0, 8) + '...',
              converted_address: row.converted_address?.slice(0, 8) + '...'
            }))
          },
          referrals: {
            count: referrals.rows.length,
            structure: referralsStructure.rows,
            recent_data: referrals.rows.map(row => ({
              ...row,
              referrer_address: row.referrer_address?.slice(0, 8) + '...',
              referee_address: row.referee_address?.slice(0, 8) + '...'
            }))
          },
          users_with_referrals: {
            count: users.rows.length,
            data: users.rows.map(row => ({
              ...row,
              address: row.address?.slice(0, 8) + '...',
              inventory_summary: row.inventory ? {
                total_pickaxes: (row.inventory.silver || 0) + (row.inventory.gold || 0) + 
                               (row.inventory.diamond || 0) + (row.inventory.netherite || 0)
              } : null
            }))
          }
        },
        potential_completions: potentialCompletions.rows.map(row => {
          const inventory = row.inventory || {};
          const totalPickaxes = (inventory.silver || 0) + (inventory.gold || 0) + 
                               (inventory.diamond || 0) + (inventory.netherite || 0);
          return {
            session_id: row.session_id?.slice(0, 20) + '...',
            referrer: row.referrer_address?.slice(0, 8) + '...',
            referee: row.converted_address?.slice(0, 8) + '...',
            has_land: row.has_land,
            total_pickaxes: totalPickaxes,
            reward_given: row.reward_given,
            ready_for_completion: row.has_land && totalPickaxes > 0 && !row.reward_given,
            completion_checked: row.completion_checked
          };
        })
      };

      console.log('🔍 Database debug complete:', {
        total_visits: debugData.statistics.total_visits,
        converted: debugData.statistics.converted_sessions,
        completed: debugData.statistics.completed_referrals,
        ready: debugData.statistics.ready_for_completion
      });

      return res.json(debugData);

    } catch (queryError) {
      client.release();
      throw queryError;
    }

  } catch (error) {
    console.error('❌ Database debug error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Database debug failed',
      details: error.message 
    });
  }
}