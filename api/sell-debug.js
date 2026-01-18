// Debug sell API - step by step to find what breaks
const MIN_SELL_GOLD = 10000;
const GOLD_PRICE_SOL = 0.000001;

module.exports = async function handler(req, res) {
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
    console.log('🔍 Debug sell - Step 1: Basic setup');
    
    const { address, amountGold } = req.body || {};
    console.log('🔍 Step 2: Request parsing OK');

    // Basic validation
    if (!address || !amountGold) {
      return res.status(400).json({ error: 'Address and amountGold required' });
    }

    if (typeof amountGold !== 'number' || amountGold <= 0) {
      return res.status(400).json({ error: 'Invalid gold amount' });
    }

    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ 
        error: `Minimum sell amount is ${MIN_SELL_GOLD.toLocaleString()} gold` 
      });
    }

    console.log('🔍 Step 3: Validation OK');

    const payoutSol = amountGold * GOLD_PRICE_SOL;
    console.log('🔍 Step 4: Calculation OK');

    // Test environment variables
    const hasDbUrl = !!process.env.DATABASE_URL;
    console.log('🔍 Step 5: Environment check:', { hasDbUrl });

    // DON'T connect to database yet - just test everything else
    console.log('🔍 Step 6: Skipping database - returning success');

    return res.status(200).json({
      success: true,
      debug: true,
      step: 'All steps passed without database',
      payoutSol: payoutSol.toFixed(6),
      message: `DEBUG: Would sell ${amountGold.toLocaleString()} gold for ${payoutSol.toFixed(6)} SOL`,
      environment: {
        hasDatabase: hasDbUrl,
        nodeEnv: process.env.NODE_ENV || 'unknown'
      },
      request: {
        address: address.slice(0, 8) + '...',
        amountGold
      }
    });

  } catch (e) {
    console.error('❌ Debug sell error:', e.message);
    console.error('❌ Stack:', e.stack);
    
    return res.status(500).json({
      error: 'Debug sell error',
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 5)
    });
  }
};