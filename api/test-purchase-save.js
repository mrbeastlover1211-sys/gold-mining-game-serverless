// Test endpoint to verify if purchases are actually saving
import { OptimizedDatabase } from '../database-optimized.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }

    console.log('🧪 Testing purchase save for:', address.slice(0, 8));
    
    // Get current user data
    const userBefore = await OptimizedDatabase.getUser(address, true); // Force refresh
    console.log('📊 Before test:', {
      inventory: userBefore.inventory,
      mining_power: userBefore.total_mining_power
    });
    
    // Simulate a purchase: Add 1 silver pickaxe
    const userAfter = {
      ...userBefore,
      inventory: {
        ...userBefore.inventory,
        silver: (userBefore.inventory.silver || 0) + 1
      },
      total_mining_power: userBefore.total_mining_power + 1,
      lastActivity: Math.floor(Date.now() / 1000),
      checkpoint_timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('🛒 Simulating purchase: +1 silver pickaxe');
    console.log('📊 After purchase:', {
      inventory: userAfter.inventory,
      mining_power: userAfter.total_mining_power
    });
    
    // 🔧 TEST 1: Try immediate save (what purchase-confirm uses)
    console.log('⚡ Testing immediate save...');
    const immediateResult = await OptimizedDatabase.saveUserImmediate(address, userAfter);
    
    // 🔧 TEST 2: Wait and verify it actually saved
    console.log('🔍 Waiting 2 seconds then checking if it saved...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const userVerify = await OptimizedDatabase.getUser(address, true); // Force refresh from DB
    console.log('📊 Verification result:', {
      inventory: userVerify.inventory,
      mining_power: userVerify.total_mining_power
    });
    
    // Check if the save worked
    const saveWorked = userVerify.inventory.silver === userAfter.inventory.silver;
    
    return res.json({
      test: 'purchase_save_test',
      immediate_save_returned: immediateResult,
      purchase_simulated: {
        before: userBefore.inventory,
        after: userAfter.inventory
      },
      database_verification: {
        inventory: userVerify.inventory,
        mining_power: userVerify.total_mining_power
      },
      save_actually_worked: saveWorked,
      diagnosis: saveWorked ? 
        '✅ Save worked - issue must be elsewhere' : 
        '❌ Save failed - this is the problem!',
      solution: saveWorked ?
        'Check purchase-confirm.js logic' :
        'Fix database save or use synchronous save'
    });
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return res.json({
      test: 'purchase_save_test',
      error: error.message,
      diagnosis: '❌ Database connection or save function broken'
    });
  }
}