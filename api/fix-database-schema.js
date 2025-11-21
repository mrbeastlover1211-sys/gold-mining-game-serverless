// 🔧 FIX DATABASE SCHEMA - Add missing columns for referral rewards
export default async function handler(req, res) {
  try {
    console.log('🔧 Fixing database schema...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    try {
      // Check current users table structure
      const tableInfo = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('📊 Current users table columns:', tableInfo.rows);
      
      const existingColumns = tableInfo.rows.map(row => row.column_name);
      const requiredColumns = [
        'inventory',
        'total_referrals', 
        'referral_rewards_earned',
        'total_mining_power'
      ];
      
      console.log('📋 Existing columns:', existingColumns);
      console.log('📋 Required columns:', requiredColumns);
      
      // Add missing columns
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      console.log('🔧 Missing columns to add:', missingColumns);
      
      for (const column of missingColumns) {
        try {
          let alterQuery = '';
          
          switch (column) {
            case 'inventory':
              alterQuery = 'ALTER TABLE users ADD COLUMN inventory JSONB DEFAULT \'{}\'';
              break;
            case 'total_referrals':
              alterQuery = 'ALTER TABLE users ADD COLUMN total_referrals INTEGER DEFAULT 0';
              break;
            case 'referral_rewards_earned':
              alterQuery = 'ALTER TABLE users ADD COLUMN referral_rewards_earned DECIMAL(20,8) DEFAULT 0';
              break;
            case 'total_mining_power':
              alterQuery = 'ALTER TABLE users ADD COLUMN total_mining_power INTEGER DEFAULT 0';
              break;
          }
          
          if (alterQuery) {
            await client.query(alterQuery);
            console.log(`✅ Added column: ${column}`);
          }
        } catch (columnError) {
          console.log(`ℹ️ Column ${column} info:`, columnError.message);
        }
      }
      
      // Check final structure
      const finalTableInfo = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('✅ Final users table structure:', finalTableInfo.rows);
      
      client.release();
      await pool.end();
      
      return res.json({
        success: true,
        message: 'Database schema fixed!',
        columns_added: missingColumns,
        final_structure: finalTableInfo.rows.map(row => ({
          name: row.column_name,
          type: row.data_type,
          default: row.column_default
        }))
      });
      
    } catch (schemaError) {
      console.error('❌ Schema fix error:', schemaError);
      throw schemaError;
    }
    
  } catch (error) {
    console.error('❌ Database schema fix error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
}