// Simple database check to see current state
import { OptimizedDatabase } from '../database-optimized.js';

export default async function handler(req, res) {
  try {
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('🔍 Checking database state...');
    
    // Get user data through the OptimizedDatabase class
    const user = await OptimizedDatabase.getUser(address, true);
    
    console.log('User data:', user);
    
    // Also check raw database
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Check what's actually in the users table
    const rawUser = await client.query(`SELECT * FROM users WHERE address = $1`, [address]);
    
    console.log('Raw DB record:', rawUser.rows[0]);
    
    // Count total users
    const totalUsers = await client.query(`SELECT COUNT(*) as count FROM users`);
    
    // Check table structure
    const userColumns = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'users' ORDER BY ordinal_position
    `);
    
    client.release();
    await pool.end();
    
    return res.json({
      status: 'database_check',
      user_data_from_class: {
        inventory: user.inventory,
        mining_power: user.total_mining_power,
        last_activity: user.lastActivity,
        checkpoint_gold: user.last_checkpoint_gold
      },
      raw_database_record: rawUser.rows[0],
      total_users_in_db: totalUsers.rows[0].count,
      users_table_structure: userColumns.rows,
      analysis: {
        user_exists_in_db: rawUser.rows.length > 0,
        inventory_in_db: rawUser.rows[0]?.silver_pickaxes || 0,
        last_save_time: rawUser.rows[0] ? new Date(rawUser.rows[0].last_activity * 1000).toLocaleString() : 'Never'
      }
    });
    
  } catch (error) {
    console.error('❌ Database check error:', error);
    return res.json({
      error: error.message,
      stack: error.stack
    });
  }
}