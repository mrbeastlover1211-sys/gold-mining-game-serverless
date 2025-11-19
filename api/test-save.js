// Test the actual database save to see what's failing
import { UltraOptimizedDatabase } from '../database-ultra-optimized.js';

export default async function handler(req, res) {
  try {
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('🧪 Testing actual database save...');
    
    // Get current user data
    const currentUser = await UltraOptimizedDatabase.getUser(address, true);
    console.log('📊 Current user data:', currentUser);
    
    // Try to add 1 netherite pickaxe
    const testUser = {
      ...currentUser,
      inventory: {
        ...currentUser.inventory,
        netherite: (currentUser.inventory.netherite || 0) + 1
      },
      total_mining_power: currentUser.total_mining_power + 10000,
      lastActivity: Math.floor(Date.now() / 1000),
      checkpoint_timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('🛒 Test data to save:', {
      before: currentUser.inventory.netherite,
      after: testUser.inventory.netherite,
      mining_power_before: currentUser.total_mining_power,
      mining_power_after: testUser.total_mining_power
    });
    
    // Test the ultra-optimized save function
    console.log('💾 Testing ultra-fast saveUserCore...');
    const saveResult = await UltraOptimizedDatabase.saveUserCore(address, testUser);
    console.log('📤 Save function returned:', saveResult);
    
    // Wait a moment then verify what's actually in the database
    console.log('⏳ Waiting 2 seconds then checking actual database...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyUser = await UltraOptimizedDatabase.getUser(address, true);
    console.log('📊 Verification data:', verifyUser);
    
    const actuallyUpdated = verifyUser.inventory.netherite !== currentUser.inventory.netherite;
    
    return res.json({
      test: 'database_save_test',
      before_save: {
        netherite: currentUser.inventory.netherite,
        mining_power: currentUser.total_mining_power
      },
      attempted_save: {
        netherite: testUser.inventory.netherite,
        mining_power: testUser.total_mining_power
      },
      after_verification: {
        netherite: verifyUser.inventory.netherite,
        mining_power: verifyUser.total_mining_power
      },
      save_function_returned: saveResult,
      actually_updated: actuallyUpdated,
      diagnosis: actuallyUpdated ? 
        '✅ Database save is working - issue must be elsewhere' :
        '❌ Database save is failing - SQL query has problems',
      next_step: actuallyUpdated ?
        'Check the purchase-confirm endpoint logic' :
        'Fix the database save query'
    });
    
  } catch (error) {
    console.error('🚨 Test save failed:', error);
    return res.json({
      test: 'database_save_test',
      error: error.message,
      stack: error.stack
    });
  }
}