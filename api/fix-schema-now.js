// 🔧 FIX SCHEMA NOW - Add missing columns immediately
import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false },
    max: 2
  });
  
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding missing database columns...');
    
    // Check what columns exist
    const existingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    const columnNames = existingColumns.rows.map(row => row.column_name);
    console.log('Current columns:', columnNames);
    
    const results = [];
    
    // Add inventory column if missing
    if (!columnNames.includes('inventory')) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN inventory JSONB DEFAULT '{}'`);
        results.push('✅ Added inventory column');
      } catch (e) {
        results.push(`inventory: ${e.message}`);
      }
    } else {
      results.push('✅ inventory column exists');
    }
    
    // Add total_referrals column if missing
    if (!columnNames.includes('total_referrals')) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN total_referrals INTEGER DEFAULT 0`);
        results.push('✅ Added total_referrals column');
      } catch (e) {
        results.push(`total_referrals: ${e.message}`);
      }
    } else {
      results.push('✅ total_referrals column exists');
    }
    
    // Add referral_rewards_earned column if missing
    if (!columnNames.includes('referral_rewards_earned')) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN referral_rewards_earned DECIMAL(20,8) DEFAULT 0`);
        results.push('✅ Added referral_rewards_earned column');
      } catch (e) {
        results.push(`referral_rewards_earned: ${e.message}`);
      }
    } else {
      results.push('✅ referral_rewards_earned column exists');
    }
    
    // Add total_mining_power column if missing
    if (!columnNames.includes('total_mining_power')) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN total_mining_power INTEGER DEFAULT 0`);
        results.push('✅ Added total_mining_power column');
      } catch (e) {
        results.push(`total_mining_power: ${e.message}`);
      }
    } else {
      results.push('✅ total_mining_power column exists');
    }
    
    // Update existing users to have proper inventory structure
    try {
      await client.query(`
        UPDATE users 
        SET inventory = COALESCE(inventory, '{}')
        WHERE inventory IS NULL
      `);
      results.push('✅ Updated NULL inventories');
    } catch (e) {
      results.push(`inventory update: ${e.message}`);
    }
    
    console.log('Schema fix results:', results);
    
    return res.json({
      success: true,
      message: 'Database schema fixed successfully!',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Schema fix error:', error);
    return res.json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
}