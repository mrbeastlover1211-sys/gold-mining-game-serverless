// Check transaction history for user to see purchase records
export default async function handler(req, res) {
  const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
  
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Check if transactions table exists and get recent transactions
    const transactionsExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'transactions'
      );
    `);
    
    console.log('Transactions table exists:', transactionsExist.rows[0].exists);
    
    if (transactionsExist.rows[0].exists) {
      // Get recent transactions for this user
      const transactions = await client.query(`
        SELECT * FROM transactions 
        WHERE user_address = $1 
        ORDER BY created_at DESC 
        LIMIT 10
      `, [address]);
      
      console.log('Found transactions:', transactions.rows.length);
      
      client.release();
      await pool.end();
      
      return res.json({
        status: 'transaction_check',
        address: address.slice(0, 8) + '...',
        transactions_table_exists: true,
        recent_transactions: transactions.rows,
        total_transactions: transactions.rows.length,
        analysis: {
          are_purchases_recorded: transactions.rows.length > 0,
          latest_purchase: transactions.rows[0] || null
        }
      });
      
    } else {
      client.release();
      await pool.end();
      
      return res.json({
        status: 'transaction_check',
        address: address.slice(0, 8) + '...',
        transactions_table_exists: false,
        message: 'Transactions table does not exist - purchases are not being logged',
        solution: 'Need to run database setup to create transactions table'
      });
    }
    
  } catch (error) {
    return res.json({
      status: 'error',
      error: error.message,
      message: 'Failed to check transaction history'
    });
  }
}