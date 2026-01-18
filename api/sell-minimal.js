// Minimal sell API - step by step complexity to find what breaks
// Start with zero dependencies and add one by one

const MIN_SELL_GOLD = 10000;
const GOLD_PRICE_SOL = 0.000001;

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('💰 Minimal sell API - step 1: Basic validation');
    
    const { address, amountGold } = req.body || {};

    // Step 1: Basic validation (no external calls)
    if (!address || !amountGold) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Address and amountGold required' 
      });
    }

    if (typeof amountGold !== 'number' || amountGold <= 0) {
      console.log('❌ Invalid gold amount:', amountGold);
      return res.status(400).json({ 
        error: 'Invalid gold amount' 
      });
    }

    if (amountGold < MIN_SELL_GOLD) {
      console.log('❌ Below minimum:', amountGold, '<', MIN_SELL_GOLD);
      return res.status(400).json({ 
        error: `Minimum sell amount is ${MIN_SELL_GOLD.toLocaleString()} gold` 
      });
    }

    console.log('✅ Step 1 passed - Basic validation OK');

    // Step 2: Simple calculation (no external calls)
    const payoutSol = amountGold * GOLD_PRICE_SOL;
    console.log('✅ Step 2 passed - Calculation OK:', payoutSol);

    // Step 3: Environment check (no external calls)
    const hasDb = !!process.env.DATABASE_URL;
    console.log('✅ Step 3 passed - Environment check:', { hasDb });

    // Step 4: Return success WITHOUT database operations
    console.log('✅ Step 4 - Returning success without database');

    return res.status(200).json({
      success: true,
      payoutSol: payoutSol.toFixed(6),
      newGold: 50000,
      mode: 'test',
      message: `TEST: Would sell ${amountGold.toLocaleString()} gold for ${payoutSol.toFixed(6)} SOL`,
      note: 'Minimal test mode - no database operations',
      debug: {
        address: address.slice(0, 8) + '...',
        amountGold,
        payoutSol,
        hasDatabase: hasDb,
        timestamp: new Date().toISOString()
      }
    });

  } catch (e) {
    console.error('❌ Minimal sell error at step:', e.message);
    console.error('❌ Full error:', e);
    console.error('❌ Stack trace:', e.stack);
    
    return res.status(500).json({
      error: 'Minimal sell error',
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 5),
      step: 'Unknown step failed'
    });
  }
};