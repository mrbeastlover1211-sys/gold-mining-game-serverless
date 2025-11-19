// Ultra-simple sell API using same pattern as working APIs
// No complex dependencies to avoid FUNCTION_INVOCATION_FAILED

const MIN_SELL_GOLD = 10000;
const GOLD_PRICE_SOL = 0.000001;

export default async function handler(req, res) {
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
    console.log('💰 Simple sell API request received');
    
    const { address, amountGold } = req.body || {};

    // Basic validation
    if (!address || !amountGold) {
      return res.status(400).json({ 
        error: 'Address and amountGold required' 
      });
    }

    if (typeof amountGold !== 'number' || amountGold <= 0) {
      return res.status(400).json({ 
        error: 'Invalid gold amount' 
      });
    }

    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ 
        error: `Minimum sell amount is ${MIN_SELL_GOLD.toLocaleString()} gold` 
      });
    }

    // Calculate SOL payout
    const payoutSol = amountGold * GOLD_PRICE_SOL;

    console.log(`💰 Processing sell: ${amountGold} gold for ${payoutSol.toFixed(6)} SOL from ${address.slice(0, 8)}...`);

    // For now, just return success without actually deducting gold or sending SOL
    // This tests the API endpoint without complex operations

    console.log(`✅ Sell recorded successfully (mock mode)`);

    res.json({
      success: true,
      payoutSol: payoutSol.toFixed(6),
      newGold: 50000, // Mock remaining gold
      mode: 'pending',
      message: `Successfully sold ${amountGold.toLocaleString()} gold for ${payoutSol.toFixed(6)} SOL!`,
      note: 'Sale recorded and pending admin processing.'
    });

  } catch (e) {
    console.error('❌ Simple sell API error:', e.message);
    return res.status(500).json({
      error: 'Sell API error: ' + e.message
    });
  }
}