// Ultra-simple admin API using exact same pattern as working APIs
const ADMIN_PASSWORD = 'admin123';

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
    console.log('🔧 Simple Admin API request received');
    
    const { action, password } = req.body || {};

    // Basic validation
    if (!action || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Action and password required' 
      });
    }

    // Password check
    if (password !== ADMIN_PASSWORD) {
      console.log('❌ Invalid password attempt');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid admin password' 
      });
    }

    console.log(`✅ Admin authenticated, action: ${action}`);

    // Handle actions
    if (action === 'dashboard') {
      // Return basic stats without database for now
      return res.json({
        success: true,
        stats: {
          land_purchases: 10,
          pickaxe_purchases: 25,
          total_sol_received: '0.035000',
          active_users: 10,
          online_users: 3,
          pending_payouts: 0,
          pending_sol: '0.000000'
        }
      });
    }

    if (action === 'pending_payouts') {
      // Return empty payouts for now
      return res.json({
        success: true,
        payouts: []
      });
    }

    // Unknown action
    return res.status(400).json({ 
      success: false, 
      error: 'Unknown action: ' + action 
    });

  } catch (e) {
    console.error('❌ Simple admin API error:', e.message);
    return res.status(500).json({
      success: false,
      error: 'Admin API error: ' + e.message
    });
  }
}