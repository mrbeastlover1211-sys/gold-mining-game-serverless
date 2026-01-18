// Test if netherite_challenges table exists and can be cleared
import pkg from 'pg';
const { Pool } = pkg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  let pool;
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1,
    });

    const results = {};

    // 1. Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'netherite_challenges'
      );
    `);
    results.tableExists = tableCheck.rows[0].exists;

    // 2. Count rows
    if (results.tableExists) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM netherite_challenges`);
      results.rowCount = parseInt(countResult.rows[0].count);
    }

    // 3. Try to delete (if user confirms)
    if (req.query.delete === 'yes' && results.tableExists) {
      const beforeCount = await pool.query(`SELECT COUNT(*) as count FROM netherite_challenges`);
      results.beforeDelete = parseInt(beforeCount.rows[0].count);
      
      await pool.query(`DELETE FROM netherite_challenges`);
      
      const afterCount = await pool.query(`SELECT COUNT(*) as count FROM netherite_challenges`);
      results.afterDelete = parseInt(afterCount.rows[0].count);
      
      results.deletionSuccessful = true;
    }

    return res.status(200).json({
      success: true,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (pool) await pool.end();
  }
}
