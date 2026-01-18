// Ultra-basic sell using exact same pattern as working /api/simple
export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, amountGold } = req.body || {};
    
    if (!address || !amountGold) {
      return res.status(400).json({ error: 'Missing address or amountGold' });
    }

    const payoutSol = amountGold * 0.000001;

    res.status(200).json({
      success: true,
      message: `ULTRA-BASIC: Would sell ${amountGold} gold for ${payoutSol.toFixed(6)} SOL`,
      payoutSol: payoutSol.toFixed(6),
      address: address.slice(0, 8) + '...',
      test: 'ultra-basic-working'
    });
    
  } catch (e) {
    res.status(500).json({
      error: 'Ultra-basic sell error',
      message: e.message
    });
  }
}