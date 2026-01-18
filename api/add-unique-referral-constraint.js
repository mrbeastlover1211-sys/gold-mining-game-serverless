// 🔒 ADD UNIQUE CONSTRAINT - Prevent duplicate referral rewards
import { pool } from '../database.js';

export default async function handler(req, res) {
  const client = await pool.connect();
  
  try {
    console.log('🔒 Adding unique constraint to referrals table...');
    
    // Check if constraint already exists
    const checkConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'referrals' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'unique_referred_address'
    `);
    
    if (checkConstraint.rows.length > 0) {
      console.log('✅ Constraint already exists');
      client.release();
      return res.json({
        success: true,
        message: 'Unique constraint already exists',
        constraint_name: 'unique_referred_address'
      });
    }
    
    // Add the unique constraint
    await client.query(`
      ALTER TABLE referrals 
      ADD CONSTRAINT unique_referred_address 
      UNIQUE (referred_address)
    `);
    
    console.log('✅ Unique constraint added successfully');
    
    client.release();
    
    return res.json({
      success: true,
      message: 'Unique constraint added successfully - each user can only complete referral once',
      constraint_name: 'unique_referred_address',
      effect: 'Database will now prevent duplicate referral rewards automatically'
    });
    
  } catch (error) {
    console.error('❌ Error adding constraint:', error);
    if (client) client.release();
    
    return res.json({
      success: false,
      error: error.message,
      detail: error.detail,
      hint: 'If constraint already exists or there are duplicate rows, this will fail'
    });
  }
}
