export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Simple in-memory storage
    global.users = global.users || {};
    
    if (!global.users[address]) {
      global.users[address] = {
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        hasLand: false,
        landPurchaseDate: null
      };
    }
    
    const user = global.users[address];
    
    res.json({
      hasLand: user.hasLand || false,
      landPurchaseDate: user.landPurchaseDate
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to check land status' });
  }
}