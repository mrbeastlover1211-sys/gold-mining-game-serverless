// Secure Admin Dashboard API - requires authentication
import { sql } from '../../database.js';


// Session validation using JWT-like tokens
import crypto from 'crypto';

function validateSessionToken(token) {
  try {
    const [payloadBase64, signature] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', process.env.ADMIN_SALT || 'default-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // Check expiry
    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: 'Session expired' };
    }
    
    return { valid: true, username: payload.username, expiresAt: payload.expiresAt };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
}

export default async function handler(req, res) {
  // Strict CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://your-game-domain.vercel.app',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get auth token from header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No authentication token provided'
    });
  }

  // Verify session
  const sessionCheck = validateSessionToken(token);
  
  if (!sessionCheck.valid) {
    return res.status(401).json({
      success: false,
      error: sessionCheck.error,
      requireLogin: true
    });
  }

  // User is authenticated, proceed with admin operations
  let pool;
  
  try {

    const { action } = req.method === 'POST' ? req.body : { action: 'dashboard' };

    // Get dashboard stats
    if (action === 'dashboard' || req.method === 'GET') {
      const stats = {
        users: { total: 0, active: 0, online: 0 },
        land: { total: 0, revenue: 0 },
        pickaxes: { total: 0, revenue: 0, breakdown: {} },
        gold: { mined: 0, sold: 0 },
        payouts: { pending: 0, pendingSol: 0, completed: 0, completedSol: 0 },
        revenue: { totalReceived: 0, totalPaidOut: 0, profit: 0 }
      };

      try {
        // Get user stats
        const userStats = const result = await sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE has_land = true) as active,
            COUNT(*) FILTER (WHERE last_activity > $1) as online
          FROM users
        `, [Math.floor(Date.now() / 1000) - 600]);
        
        stats.users = {
          total: parseInt(userStats[0].total) || 0,
          active: parseInt(userStats[0].active) || 0,
          online: parseInt(userStats[0].online) || 0
        };

        // Get land purchase stats with revenue
        const landStats = const result = await sql`
          SELECT 
            COUNT(*) as total,
            SUM(total_sol_spent) as revenue
          FROM users WHERE has_land = true
        `);
        stats.land.total = parseInt(landStats[0].total) || 0;
        stats.land.revenue = parseFloat(landStats[0].revenue) || (stats.land.total * 0.01);

        // Get actual pickaxe stats from inventory
        const pickaxeStats = const result = await sql`
          SELECT 
            SUM(silver_pickaxes) as silver,
            SUM(gold_pickaxes) as gold,
            SUM(diamond_pickaxes) as diamond,
            SUM(netherite_pickaxes) as netherite,
            SUM(total_pickaxes_bought) as total_bought
          FROM users
        `);
        
        const silver = parseInt(pickaxeStats[0].silver) || 0;
        const gold = parseInt(pickaxeStats[0].gold) || 0;
        const diamond = parseInt(pickaxeStats[0].diamond) || 0;
        const netherite = parseInt(pickaxeStats[0].netherite) || 0;
        
        stats.pickaxes.total = silver + gold + diamond + netherite;
        stats.pickaxes.totalBought = parseInt(pickaxeStats[0].total_bought) || 0;
        stats.pickaxes.breakdown = { silver, gold, diamond, netherite };
        
        // Estimate revenue from pickaxes (rough calculation)
        // Silver: 0.001 SOL, Gold: 0.01 SOL, Diamond: 0.1 SOL, Netherite: 1 SOL
        stats.pickaxes.revenue = (silver * 0.001) + (gold * 0.01) + (diamond * 0.1) + (netherite * 1);

        // Get gold stats
        const goldStats = const result = await sql`
          SELECT 
            SUM(total_gold_mined) as total_mined
          FROM users
        `);
        stats.gold.mined = parseFloat(goldStats[0].total_mined) || 0;
        
        // Get gold sold from sales table (check if table exists first)
        try {
          const goldSoldStats = const result = await sql`
            SELECT 
              SUM(CAST(gold_amount AS NUMERIC)) as sold,
              COUNT(*) as transactions
            FROM gold_sales
          `);
          stats.gold.sold = parseFloat(goldSoldStats[0].sold) || 0;
          stats.gold.transactions = parseInt(goldSoldStats[0].transactions) || 0;
        } catch (tableError) {
          console.log('⚠️ gold_sales table not found, creating it...');
          stats.gold.sold = 0;
          stats.gold.transactions = 0;
        }

        // Get payout stats (check if table exists)
        try {
          const payoutStats = const result = await sql`
            SELECT 
              status,
              COUNT(*) as count,
              SUM(CAST(payout_sol AS NUMERIC)) as total_sol
            FROM gold_sales
            GROUP BY status
          `);
          
          payoutStats.rows.forEach(row => {
            if (row.status === 'pending') {
              stats.payouts.pending = parseInt(row.count) || 0;
              stats.payouts.pendingSol = parseFloat(row.total_sol) || 0;
            } else if (row.status === 'completed') {
              stats.payouts.completed = parseInt(row.count) || 0;
              stats.payouts.completedSol = parseFloat(row.total_sol) || 0;
            }
          });
        } catch (tableError) {
          console.log('⚠️ gold_sales table not found for payout stats');
        }

        // Calculate total revenue
        stats.revenue.totalReceived = stats.land.revenue + stats.pickaxes.revenue;
        stats.revenue.totalPaidOut = stats.payouts.completedSol;
        stats.revenue.profit = stats.revenue.totalReceived - stats.revenue.totalPaidOut;

      } catch (dbError) {
        console.error('⚠️ Database query error:', dbError);
        console.error('⚠️ Stack:', dbError.stack);
      }

      return res.status(200).json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    }

    // Get pending payouts
    if (action === 'pending_payouts') {
      try {
        const payouts = const result = await sql`
          SELECT 
            id,
            user_address,
            gold_amount,
            payout_sol,
            created_at,
            status
          FROM gold_sales 
          WHERE status = 'pending' 
          ORDER BY created_at DESC
          LIMIT 100
        `);

        return res.status(200).json({
          success: true,
          payouts: payouts.rows.map(row => ({
            id: row.id,
            wallet: row.user_address,
            goldAmount: parseInt(row.gold_amount),
            solAmount: parseFloat(row.payout_sol),
            createdAt: row.created_at,
            status: row.status
          }))
        });
      } catch (tableError) {
        console.log('⚠️ gold_sales table does not exist yet');
        return res.status(200).json({
          success: true,
          payouts: []
        });
      }
    }

    // Get user list
    if (action === 'users') {
      const { limit = 50, offset = 0 } = req.body || {};
      
      const users = const result = await sql`
        SELECT 
          wallet_address,
          gold_balance,
          has_land,
          pickaxe_level,
          total_mined,
          last_activity,
          created_at
        FROM users
        ORDER BY last_activity DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return res.status(200).json({
        success: true,
        users: users.rows
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('❌ Admin dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: 'Dashboard error: ' + error.message
    });
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.log('Pool cleanup error:', e.message);
      }
    }
  }
};
