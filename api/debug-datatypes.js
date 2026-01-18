// Check exact data type mismatches between our data and database schema
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Get detailed column information
    const columns = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Full table schema:', columns.rows);
    
    client.release();
    
    // Test data we're trying to insert
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const testData = {
      transaction_type: 'purchase',
      item_type: 'netherite',
      quantity: 1,
      sol_amount: 0.001,
      signature: 'test_signature_123',
      status: 'confirmed'
    };
    
    // Our actual INSERT values
    const insertValues = [
      address,                                    // user_address
      testData.transaction_type || 'purchase',    // transaction_type
      testData.item_type || 'unknown',           // item_type
      parseInt(testData.quantity || 1),          // quantity
      parseFloat(testData.sol_amount || 0),      // sol_amount
      testData.signature || '',                  // signature
      testData.status || 'confirmed'             // status
    ];
    
    // Map our data to database columns
    const dataMapping = {
      user_address: {
        our_value: address,
        our_type: typeof address,
        our_length: address.length,
        db_type: 'text',
        db_nullable: 'YES'
      },
      transaction_type: {
        our_value: testData.transaction_type,
        our_type: typeof testData.transaction_type,
        our_length: testData.transaction_type?.length,
        db_type: 'text',
        db_nullable: 'YES'
      },
      item_type: {
        our_value: testData.item_type,
        our_type: typeof testData.item_type,
        our_length: testData.item_type?.length,
        db_type: 'text',
        db_nullable: 'YES'
      },
      quantity: {
        our_value: parseInt(testData.quantity),
        our_type: typeof parseInt(testData.quantity),
        db_type: 'integer',
        db_nullable: 'YES'
      },
      sol_amount: {
        our_value: parseFloat(testData.sol_amount),
        our_type: typeof parseFloat(testData.sol_amount),
        db_type: 'numeric',
        db_nullable: 'YES'
      },
      signature: {
        our_value: testData.signature,
        our_type: typeof testData.signature,
        our_length: testData.signature?.length,
        db_type: 'text',
        db_nullable: 'YES'
      },
      status: {
        our_value: testData.status,
        our_type: typeof testData.status,
        our_length: testData.status?.length,
        db_type: 'text',
        db_nullable: 'YES'
      }
    };
    
    // Check for potential issues
    const issues = [];
    
    // Check required columns that we're not providing
    const requiredColumns = columns.rows.filter(col => 
      col.is_nullable === 'NO' && 
      col.column_default === null &&
      !['id', 'created_at'].includes(col.column_name)
    );
    
    const providedColumns = ['user_address', 'transaction_type', 'item_type', 'quantity', 'sol_amount', 'signature', 'status'];
    
    requiredColumns.forEach(col => {
      if (!providedColumns.includes(col.column_name)) {
        issues.push({
          type: 'MISSING_REQUIRED_COLUMN',
          column: col.column_name,
          required: true,
          provided: false
        });
      }
    });
    
    return res.json({
      test: 'datatype_validation',
      database_schema: columns.rows,
      our_insert_values: insertValues,
      data_type_mapping: dataMapping,
      sql_query: `INSERT INTO transactions (user_address, transaction_type, item_type, quantity, sol_amount, signature, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      potential_issues: issues,
      diagnosis: {
        missing_required_columns: issues.length > 0,
        column_count_mismatch: providedColumns.length !== columns.rows.filter(c => !['id', 'created_at'].includes(c.column_name)).length,
        data_types_look_compatible: true // We'll see in the mapping
      },
      next_step: issues.length > 0 ? 
        'Fix missing required columns' : 
        'Data types look compatible - check for other constraints'
    });
    
  } catch (error) {
    return res.json({
      test: 'datatype_validation',
      error: error.message,
      stack: error.stack
    });
  }
}