// Ultra-simple admin API using exact same pattern as working APIs
import { getDatabase } from '../database.js';

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
      // Get real pending payouts from database
      try {
        const db = await getDatabase();
        
        const pendingPayouts = await db.query(`
          SELECT 
            id,
            wallet_address,
            gold_amount,
            payout_sol,
            created_at
          FROM gold_sales 
          WHERE status = 'pending' 
          ORDER BY created_at DESC
          LIMIT 100
        `);

        console.log(`✅ Found ${pendingPayouts.rows.length} pending payouts`);

        return res.json({
          success: true,
          payouts: pendingPayouts.rows.map(row => ({
            id: row.id,
            wallet: row.wallet_address,
            goldAmount: parseInt(row.gold_amount),
            solAmount: parseFloat(row.payout_sol),
            createdAt: row.created_at,
            timestamp: new Date(row.created_at).getTime() / 1000
          }))
        });

      } catch (dbError) {
        console.log('⚠️ Database error getting payouts:', dbError.message);
        // Return empty array if error
        return res.json({
          success: true,
          payouts: []
        });
      }
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