export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    
    // Simple in-memory storage
    global.users = global.users || {};
    
    if (!global.users[address]) {
      global.users[address] = {
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        lastActivity: Math.floor(Date.now() / 1000)
      };
    }
    
    global.users[address].lastActivity = Math.floor(Date.now() / 1000);
    
    res.json({ ok: true, lastActivity: global.users[address].lastActivity });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'heartbeat failed' });
  }
}