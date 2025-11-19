// Debug version of purchase-confirm to test imports
export default async function handler(req, res) {
  try {
    console.log('🔍 Debug: Starting import tests...');
    
    // Test 1: Basic imports
    console.log('🔍 Testing Connection import...');
    try {
      const { Connection } = await import('@solana/web3.js');
      console.log('✅ Solana import successful');
    } catch (e) {
      console.log('❌ Solana import failed:', e.message);
      return res.status(500).json({ error: 'Solana import failed', details: e.message });
    }
    
    // Test 2: Database imports
    console.log('🔍 Testing database imports...');
    try {
      const { getUserOptimized, saveUserOptimized } = await import('../database.js');
      console.log('✅ Database imports successful');
      console.log('📊 Functions available:', {
        getUserOptimized: typeof getUserOptimized,
        saveUserOptimized: typeof saveUserOptimized
      });
    } catch (e) {
      console.log('❌ Database import failed:', e.message);
      return res.status(500).json({ error: 'Database import failed', details: e.message });
    }
    
    // Test 3: Basic variables
    console.log('🔍 Testing constants...');
    const PICKAXES = {
      silver: { name: 'Silver', costSol: 0.001, ratePerSec: 1/60 },
      gold: { name: 'Gold', costSol: 0.001, ratePerSec: 10/60 },
      diamond: { name: 'Diamond', costSol: 0.001, ratePerSec: 100/60 },
      netherite: { name: 'Netherite', costSol: 0.001, ratePerSec: 10000/60 },
    };
    console.log('✅ PICKAXES constant created');
    
    // Test 4: Helper functions
    function nowSec() { 
      return Math.floor(Date.now() / 1000); 
    }
    
    function totalRate(inv) {
      let r = 0;
      for (const k of Object.keys(PICKAXES)) {
        r += (inv[k] || 0) * PICKAXES[k].ratePerSec;
      }
      return r;
    }
    console.log('✅ Helper functions created');
    
    // All tests passed
    return res.status(200).json({
      success: true,
      message: 'All imports and basic setup working',
      test_results: {
        solana_import: 'success',
        database_import: 'success',
        constants: 'success',
        helpers: 'success'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug purchase error:', error);
    return res.status(500).json({
      error: 'Debug error',
      message: error.message,
      stack: error.stack
    });
  }
}