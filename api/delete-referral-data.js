// 🗑️ DELETE REFERRAL DATA - Simple direct deletion
import { pool } from '../database.js';

export default async function handler(req, res) {
  const client = await pool.connect();
  
  try {
    // Count before
    const before = await client.query('SELECT COUNT(*) as count FROM referral_visits');
    
    // Delete all referral data
    await client.query('DELETE FROM referral_visits WHERE id > 0');
    
    // Count after  
    const after = await client.query('SELECT COUNT(*) as count FROM referral_visits');
    
    // Reset sequence
    await client.query('ALTER SEQUENCE referral_visits_id_seq RESTART WITH 1');
    
    return res.json({
      success: true,
      before_count: before.rows[0].count,
      after_count: after.rows[0].count,
      cleared: parseInt(before.rows[0].count) - parseInt(after.rows[0].count)
    });
    
  } catch (error) {
    return res.json({ success: false, error: error.message });
  } finally {
    client.release();
  }
}