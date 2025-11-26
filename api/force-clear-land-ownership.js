// 🗑️ FORCE CLEAR ALL LAND OWNERSHIP - Complete Database Reset
import { getPool } from '../database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🗑️ Starting COMPLETE land ownership clearing...');
    
    const pool = await getPool();
    const startTime = Date.now();
    
    // 1. Clear memory cache completely
    if (typeof global !== 'undefined') {
      global.users = {};
      console.log('✅ Cleared global.users memory cache');
    }
    
    // 2. Reset ALL land ownership in database
    console.log('🔄 Clearing all land ownership from database...');
    
    const resetLandQuery = `
      UPDATE users 
      SET 
        has_land = false,
        land_purchase_date = NULL,
        land_type = 'basic'
      WHERE has_land = true
    `;
    
    const resetResult = await pool.query(resetLandQuery);
    console.log(`📊 Reset land ownership for ${resetResult.rowCount} users`);
    
    // 3. Delete all land purchase transactions
    const deleteLandTransactions = `
      DELETE FROM transactions 
      WHERE transaction_type = 'land_purchase'
    `;
    
    const transactionResult = await pool.query(deleteLandTransactions);
    console.log(`🗑️ Deleted ${transactionResult.rowCount} land purchase transactions`);
    
    // 4. Verify no land ownership remains
    const verifyQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN has_land = true THEN 1 END) as land_owners,
        COUNT(CASE WHEN land_purchase_date IS NOT NULL THEN 1 END) as with_purchase_date
      FROM users
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const stats = verifyResult.rows[0];
    
    console.log('📊 Final verification:', {
      total_users: stats.total_users,
      land_owners: stats.land_owners,
      with_purchase_date: stats.with_purchase_date
    });
    
    // 5. Clear any cached user data that might show land ownership
    console.log('🔄 Clearing additional caches...');
    
    // Clear any potential app-level caches
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // Development environment - can clear module cache
      Object.keys(require.cache).forEach(key => {
        if (key.includes('user') || key.includes('land')) {
          delete require.cache[key];
        }
      });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const response = {
      success: true,
      message: 'ALL LAND OWNERSHIP COMPLETELY CLEARED',
      cleared: {
        memory_cache: true,
        land_ownership_reset: resetResult.rowCount,
        transactions_deleted: transactionResult.rowCount,
        duration_ms: duration
      },
      verification: {
        total_users: parseInt(stats.total_users),
        land_owners_remaining: parseInt(stats.land_owners),
        purchase_dates_remaining: parseInt(stats.with_purchase_date)
      },
      instructions: {
        next_step: 'Refresh your frontend - all users should now need to purchase land again',
        test_wallet: 'Connect any wallet and it should show the land purchase popup'
      }
    };
    
    console.log('✅ LAND OWNERSHIP CLEARING COMPLETE:', response);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error clearing land ownership:', error);
    res.status(500).json({ 
      error: 'Failed to clear land ownership', 
      details: error.message,
      stack: error.stack
    });
  }
}

// Test endpoint - call this to verify clearing worked
export async function verifyLandClearing() {
  try {
    const pool = await getPool();
    
    const result = await pool.query(`
      SELECT 
        address,
        has_land,
        land_purchase_date,
        land_type,
        last_activity
      FROM users 
      WHERE has_land = true 
      LIMIT 10
    `);
    
    return {
      land_owners_found: result.rowCount,
      sample_owners: result.rows
    };
  } catch (error) {
    return { error: error.message };
  }
}