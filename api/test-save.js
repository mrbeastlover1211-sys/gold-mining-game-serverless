// Test database save function to debug the issue
import { OptimizedDatabase } from '../database-optimized.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ error: 'address parameter required' });
  }

  try {
    console.log('🧪 Testing database save for:', address.slice(0, 8));
    
    // Get current user data
    const user = await OptimizedDatabase.getUser(address);
    console.log('📊 Current user data:', user);
    
    // Try to increment netherite by 1 and save
    const testUser = {
      ...user,
      inventory: {
        ...user.inventory,
        netherite: (user.inventory?.netherite || 0) + 1
      },
      total_mining_power: user.total_mining_power + 10000,
      checkpoint_timestamp: Math.floor(Date.now() / 1000),
      lastActivity: Math.floor(Date.now() / 1000)
    };
    
    console.log('🧪 Test data to save:', testUser);
    
    // Try immediate save
    const saveResult = await OptimizedDatabase.saveUserImmediate(address, testUser);
    
    console.log('💾 Save result:', saveResult);
    
    // Verify save by reading back
    const verification = await OptimizedDatabase.getUser(address, true);
    console.log('🔍 Verification data:', verification);
    
    res.json({
      success: true,
      original: user,
      testData: testUser,
      saveResult: saveResult,
      verification: verification,
      match: verification.inventory?.netherite === testUser.inventory.netherite
    });
    
  } catch (error) {
    console.error('❌ Test save error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}