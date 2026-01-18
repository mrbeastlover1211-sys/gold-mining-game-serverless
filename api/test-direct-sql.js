// Test direct SQL INSERT to see exact database error
export default async function handler(req, res) {
  try {
    console.log('🧪 Testing direct SQL INSERT to transactions table...');
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Test 1: Simple INSERT with minimal data
    console.log('📝 Test 1: Minimal INSERT...');
    try {
      const result1 = await client.query(`
        INSERT INTO transactions (user_address, transaction_type) 
        VALUES ($1, $2) 
        RETURNING id
      `, ['test_address', 'test_transaction']);
      
      console.log('✅ Minimal INSERT success:', result1.rows[0]);
      
    } catch (error1) {
      console.error('❌ Minimal INSERT failed:', error1.message);
      console.error('❌ Error code:', error1.code);
      console.error('❌ Error detail:', error1.detail);
    }
    
    // Test 2: Full INSERT matching our logTransaction
    console.log('📝 Test 2: Full INSERT...');
    try {
      const result2 = await client.query(`
        INSERT INTO transactions (
          user_address, transaction_type, item_type, quantity, 
          sol_amount, signature, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG',
        'purchase',
        'netherite',
        1,
        0.001,
        'test_signature_123',
        'confirmed'
      ]);
      
      console.log('✅ Full INSERT success:', result2.rows[0]);
      
    } catch (error2) {
      console.error('❌ Full INSERT failed:', error2.message);
      console.error('❌ Error code:', error2.code);
      console.error('❌ Error detail:', error2.detail);
      console.error('❌ Error hint:', error2.hint);
      console.error('❌ Full error:', error2);
    }
    
    // Test 3: Check table permissions
    console.log('📝 Test 3: Checking permissions...');
    try {
      const permissions = await client.query(`
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'transactions'
      `);
      console.log('🔒 Table permissions:', permissions.rows);
      
    } catch (error3) {
      console.error('❌ Permission check failed:', error3.message);
    }
    
    // Test 4: Check if table has triggers
    console.log('📝 Test 4: Checking triggers...');
    try {
      const triggers = await client.query(`
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'transactions'
      `);
      console.log('⚡ Table triggers:', triggers.rows);
      
    } catch (error4) {
      console.error('❌ Trigger check failed:', error4.message);
    }
    
    // Get recent transactions to verify
    const recentTransactions = await client.query(`
      SELECT * FROM transactions ORDER BY created_at DESC LIMIT 3
    `);
    
    client.release();
    await pool.end();
    
    return res.json({
      test: 'direct_sql_test',
      results: {
        minimal_insert: 'Check logs for result',
        full_insert: 'Check logs for result',
        permissions_check: 'Check logs for result',
        triggers_check: 'Check logs for result'
      },
      recent_transactions: recentTransactions.rows,
      message: 'Check Vercel function logs for detailed error messages'
    });
    
  } catch (error) {
    console.error('🚨 Direct SQL test completely failed:', error);
    return res.json({
      test: 'direct_sql_test',
      error: error.message,
      stack: error.stack
    });
  }
}