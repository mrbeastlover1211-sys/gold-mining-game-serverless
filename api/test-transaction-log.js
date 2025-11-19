// Test transaction logging directly to see what's failing
export default async function handler(req, res) {
  try {
    const { UltraOptimizedDatabase } = await import('../database-ultra-optimized.js');
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('🧪 Testing transaction logging directly...');
    
    // Test transaction data
    const testTransaction = {
      transaction_type: 'pickaxe_purchase',  // ✅ FIXED: Use allowed constraint value
      item_type: 'netherite',
      quantity: 1,
      sol_amount: 0.001,
      signature: 'test_signature_123',
      status: 'confirmed'
    };
    
    console.log('📊 Test transaction data:', testTransaction);
    
    // Test the ultra-fast logTransaction function
    console.log('📝 Calling ultra-fast logTransaction...');
    const logResult = await UltraOptimizedDatabase.logTransaction(address, testTransaction);
    console.log('📤 Log result:', logResult);
    
    // Check if it actually appeared in the database
    console.log('🔍 Checking if transaction was saved...');
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Check table structure
    const columns = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Transactions table columns:', columns.rows);
    
    // Check recent transactions
    const transactions = await client.query(`
      SELECT * FROM transactions 
      WHERE user_address = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [address]);
    
    console.log('📊 Recent transactions:', transactions.rows);
    
    client.release();
    await pool.end();
    
    return res.json({
      test: 'transaction_logging',
      test_data: testTransaction,
      log_function_result: logResult,
      table_structure: columns.rows,
      recent_transactions: transactions.rows,
      diagnosis: {
        log_function_works: logResult === true,
        transactions_found: transactions.rows.length > 0,
        table_exists: columns.rows.length > 0
      },
      conclusion: logResult && transactions.rows.length > 0 ? 
        'Transaction logging works - issue is elsewhere' :
        'Transaction logging is broken - found the problem'
    });
    
  } catch (error) {
    console.error('🚨 Transaction log test failed:', error);
    return res.json({
      test: 'transaction_logging',
      error: error.message,
      stack: error.stack
    });
  }
}