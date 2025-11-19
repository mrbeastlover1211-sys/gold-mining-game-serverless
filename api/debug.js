// CONSOLIDATED debug endpoint - combines all debug functions into one
import { UltraOptimizedDatabase } from '../database-ultra-optimized.js';

export default async function handler(req, res) {
  const { action, address } = req.query;
  
  try {
    const userAddress = address || 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    if (action === 'env') {
      // Database environment check (replaces debug-env.js)
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        return res.json({
          status: 'error',
          issue: 'DATABASE_URL environment variable not set'
        });
      }
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      await pool.end();
      
      return res.json({
        status: 'success',
        database: { connected: true, timestamp: result.rows[0].current_time }
      });
      
    } else if (action === 'user') {
      // User debug info (replaces debug-user.js)
      const user = await UltraOptimizedDatabase.getUser(userAddress, true);
      
      return res.json({
        status: 'user_debug',
        address: userAddress,
        inventory: user.inventory,
        mining_power: user.total_mining_power,
        gold: user.last_checkpoint_gold,
        last_activity: new Date(user.lastActivity * 1000).toLocaleString()
      });
      
    } else if (action === 'purchase') {
      // Purchase flow debug (replaces debug-purchase-flow.js and debug-last-purchase.js)
      const user = await UltraOptimizedDatabase.getUser(userAddress, true);
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      const client = await pool.connect();
      const rawUser = await client.query(`SELECT * FROM users_core WHERE address = $1`, [userAddress]);
      client.release();
      await pool.end();
      
      return res.json({
        status: 'purchase_debug',
        current_user_data: {
          inventory: user.inventory,
          mining_power: user.total_mining_power,
          last_activity: user.lastActivity
        },
        database_record: rawUser.rows[0],
        analysis: {
          user_exists_in_db: rawUser.rows.length > 0,
          last_save_time: rawUser.rows[0] ? new Date(rawUser.rows[0].last_activity * 1000).toLocaleString() : 'Never'
        }
      });
      
    } else if (action === 'db') {
      // Database state check (replaces check-db-simple.js)
      const user = await UltraOptimizedDatabase.getUser(userAddress, true);
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      const client = await pool.connect();
      const rawUser = await client.query(`SELECT * FROM users_core WHERE address = $1`, [userAddress]);
      const totalUsers = await client.query(`SELECT COUNT(*) as count FROM users_core`);
      client.release();
      await pool.end();
      
      return res.json({
        status: 'database_check',
        user_data_from_class: {
          inventory: user.inventory,
          mining_power: user.total_mining_power
        },
        raw_database_record: rawUser.rows[0],
        total_users_in_db: totalUsers.rows[0].count,
        analysis: {
          user_exists_in_db: rawUser.rows.length > 0,
          inventory_in_db: rawUser.rows[0]?.netherite_pickaxes || 0
        }
      });
      
    } else {
      // Default: show available debug actions
      return res.json({
        debug_endpoint: 'consolidated',
        available_actions: [
          'env - Database environment check',
          'user - User debug info',  
          'purchase - Purchase flow debug',
          'db - Database state check'
        ],
        usage: {
          env: '/api/debug?action=env',
          user: '/api/debug?action=user&address=YOUR_ADDRESS',
          purchase: '/api/debug?action=purchase&address=YOUR_ADDRESS',
          db: '/api/debug?action=db&address=YOUR_ADDRESS'
        }
      });
    }
    
  } catch (error) {
    return res.json({
      status: 'error',
      action: action || 'unknown',
      error: error.message
    });
  }
}