// 🧪 TEST DATABASE CONNECTION
import { pool } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test basic connection
    const client = await pool.connect();
    
    try {
      // Simple query
      const result = await client.query('SELECT NOW() as current_time, version() as db_version');
      
      client.release();
      
      return res.json({
        success: true,
        message: 'Database connection successful',
        timestamp: result.rows[0].current_time,
        database: result.rows[0].db_version,
        poolInfo: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
      });
    } catch (queryError) {
      client.release();
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
