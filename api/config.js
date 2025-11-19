// Game configuration endpoint
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PICKAXES = {
    silver: { name: 'Silver', costSol: 0.001, ratePerSec: 1/60 },
    gold: { name: 'Gold', costSol: 0.001, ratePerSec: 10/60 },
    diamond: { name: 'Diamond', costSol: 0.001, ratePerSec: 100/60 },
    netherite: { name: 'Netherite', costSol: 0.001, ratePerSec: 10000/60 },
  };

  res.json({
    pickaxes: PICKAXES,
    goldPriceSol: parseFloat(process.env.GOLD_PRICE_SOL || '0.000001'),
    minSellGold: parseInt(process.env.MIN_SELL_GOLD || '10000', 10),
    clusterUrl: process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com',
    treasury: process.env.TREASURY_PUBLIC_KEY || '',
  });
}