// Secure Admin Dashboard API - requires authentication
import pkg from 'pg';
const { Pool } = pkg;

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
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1,
      idleTimeoutMillis: 3000,
      connectionTimeoutMillis: 3000,
    });

    const { action } = req.method === 'POST' ? req.body : { action: 'dashboard' };

    // Get dashboard stats
    if (action === 'dashboard' || req.method === 'GET') {
      const stats = {
        users: { total: 0, active: 0, online: 0 },
        land: { total: 0, revenue: 0 },
        pickaxes: { total: 0, revenue: 0 },
        gold: { mined: 0, sold: 0 },
        payouts: { pending: 0, pendingSol: 0, completed: 0, completedSol: 0 }
      };

      try {
        // Get user stats
        const userStats = await pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE has_land = true) as active,
            COUNT(*) FILTER (WHERE last_activity > $1) as online
          FROM users
        `, [Math.floor(Date.now() / 1000) - 600]);
        
        stats.users = {
          total: parseInt(userStats.rows[0].total) || 0,
          active: parseInt(userStats.rows[0].active) || 0,
          online: parseInt(userStats.rows[0].online) || 0
        };

        // Get land purchase stats
        const landStats = await pool.query(`
          SELECT COUNT(*) as total
          FROM users WHERE has_land = true
        `);
        stats.land.total = parseInt(landStats.rows[0].total) || 0;
        stats.land.revenue = stats.land.total * 0.01; // 0.01 SOL per land

        // Get pickaxe stats (estimate from upgrades)
        stats.pickaxes.total = Math.floor(stats.users.active * 2.5);
        stats.pickaxes.revenue = stats.pickaxes.total * 0.001;

        // Get gold stats
        const goldStats = await pool.query(`
          SELECT 
            SUM(CAST(gold_amount AS NUMERIC)) as sold,
            COUNT(*) as transactions
          FROM gold_sales
        `);
        stats.gold.sold = parseFloat(goldStats.rows[0].sold) || 0;

        // Get payout stats
        const payoutStats = await pool.query(`
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

      } catch (dbError) {
        console.error('⚠️ Database query error:', dbError);
      }

      return res.status(200).json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    }

    // Get pending payouts
    if (action === 'pending_payouts') {
      const payouts = await pool.query(`
        SELECT 
          id,
          wallet_address,
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
          wallet: row.wallet_address,
          goldAmount: parseInt(row.gold_amount),
          solAmount: parseFloat(row.payout_sol),
          createdAt: row.created_at,
          status: row.status
        }))
      });
    }

    // Get user list
    if (action === 'users') {
      const { limit = 50, offset = 0 } = req.body || {};
      
      const users = await pool.query(`
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
