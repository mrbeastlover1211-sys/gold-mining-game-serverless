// Check what values are allowed in transaction_type constraint
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get the exact check constraint definition
    const constraints = await client.query(`
      SELECT 
        constraint_name, 
        check_clause
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'transactions_transaction_type_check'
    `);
    
    console.log('🔒 Check constraint details:', constraints.rows);
    
    // Also get constraint from pg_constraint for more details
    const pgConstraints = await client.query(`
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'transactions_transaction_type_check'
    `);
    
    console.log('🔒 PostgreSQL constraint definition:', pgConstraints.rows);
    
    client.release();
    await pool.end();
    
    return res.json({
      test: 'check_constraints',
      check_constraint: constraints.rows[0],
      pg_constraint: pgConstraints.rows[0],
      problem: 'transaction_type has restricted values',
      solution: 'Use allowed values or remove constraint',
      likely_allowed_values: [
        'Based on constraint definition, probably:',
        '- buy',
        '- sell', 
        '- land_purchase',
        '- gold_sale',
        'etc. (check constraint definition above)'
      ]
    });
    
  } catch (error) {
    return res.json({
      test: 'check_constraints',
      error: error.message
    });
  }
}