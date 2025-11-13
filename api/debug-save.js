// Simple GET endpoint to test database saves
import { OptimizedDatabase } from '../database-optimized.js';

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing database save functionality...');
    
    // Use your wallet address from the logs
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    console.log('📊 Getting current user data...');
    const userBefore = await OptimizedDatabase.getUser(address, true);
    console.log('Current inventory:', userBefore.inventory);
    console.log('Current mining power:', userBefore.total_mining_power);
    
    // Test: Add 1 to silver pickaxes
    const testUser = {
      ...userBefore,
      inventory: {
        ...userBefore.inventory,
        silver: (userBefore.inventory.silver || 0) + 1
      },
      total_mining_power: userBefore.total_mining_power + 1,
      lastActivity: Math.floor(Date.now() / 1000),
      checkpoint_timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('🛒 Testing save with +1 silver pickaxe...');
    console.log('New inventory would be:', testUser.inventory);
    
    // Try to save
    console.log('💾 Attempting database save...');
    const saveResult = await OptimizedDatabase.saveUserImmediate(address, testUser);
    console.log('Save result:', saveResult);
    
    // Wait a moment then verify
    console.log('⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔍 Verifying save worked...');
    const userAfter = await OptimizedDatabase.getUser(address, true);
    console.log('Final inventory:', userAfter.inventory);
    
    const saveWorked = userAfter.inventory.silver === testUser.inventory.silver;
    
    return res.json({
      status: 'test_completed',
      before: {
        inventory: userBefore.inventory,
        mining_power: userBefore.total_mining_power
      },
      attempted: {
        inventory: testUser.inventory,
        mining_power: testUser.total_mining_power
      },
      after: {
        inventory: userAfter.inventory,
        mining_power: userAfter.total_mining_power
      },
      save_worked: saveWorked,
      save_result: saveResult,
      diagnosis: saveWorked ? 
        '✅ Database saves work! Issue is in purchase-confirm.js logic' : 
        '❌ Database save is failing',
      next_step: saveWorked ?
        'Fix the purchase confirmation code to wait for save completion' :
        'Debug the database save function'
    });
    
  } catch (error) {
    console.error('❌ Debug save test failed:', error);
    return res.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    });
  }
}