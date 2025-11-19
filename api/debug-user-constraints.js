// Check constraints on users table that might be blocking saves
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get all constraints on users table
    const constraints = await client.query(`
      SELECT 
        constraint_name, 
        check_clause
      FROM information_schema.check_constraints 
      WHERE constraint_name LIKE '%users%'
    `);
    
    // Get users table schema
    const userColumns = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    // Test a simple INSERT to users table
    console.log('🧪 Testing simple users table INSERT...');
    try {
      const testResult = await client.query(`
        INSERT INTO users (address, silver_pickaxes) 
        VALUES ($1, $2) 
        RETURNING address
      `, ['test_user_address', 1]);
      
      console.log('✅ Users INSERT success:', testResult.rows[0]);
      
      // Clean up test
      await client.query('DELETE FROM users WHERE address = $1', ['test_user_address']);
      
    } catch (userError) {
      console.error('❌ Users INSERT failed:', userError.message);
      console.error('❌ Error code:', userError.code);
      console.error('❌ Error detail:', userError.detail);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      test: 'user_constraints_check',
      users_table_schema: userColumns.rows,
      check_constraints: constraints.rows,
      users_insert_test: 'Check logs for result',
      diagnosis: 'Users table might have similar constraint issues as transactions table'
    });
    
  } catch (error) {
    return res.json({
      test: 'user_constraints_check',
      error: error.message,
      stack: error.stack
    });
  }
}