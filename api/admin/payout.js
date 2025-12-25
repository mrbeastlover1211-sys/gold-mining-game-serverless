// Secure Admin Payout Management API
import pkg from 'pg';
const { Pool } = pkg;
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

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
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No authentication token'
    });
  }

  const sessionCheck = validateSessionToken(token);
  if (!sessionCheck.valid) {
    return res.status(401).json({
      success: false,
      error: sessionCheck.error || 'Invalid session',
      requireLogin: true
    });
  }

  let pool;
  
  try {
    const { action, payoutId, txSignature, rejectReason } = req.body || {};

    if (!action || !payoutId) {
      return res.status(400).json({
        success: false,
        error: 'Action and payoutId required'
      });
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    // Approve payout (mark as ready to process)
    if (action === 'approve') {
      const result = await pool.query(`
        UPDATE gold_sales 
        SET status = 'approved',
            admin_approved_by = $1,
            admin_approved_at = NOW()
        WHERE id = $2 AND status = 'pending'
        RETURNING *
      `, [sessionCheck.username, payoutId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Payout not found or already processed'
        });
      }

      console.log(`✅ Payout ${payoutId} approved by ${sessionCheck.username}`);

      return res.status(200).json({
        success: true,
        message: 'Payout approved',
        payout: result.rows[0]
      });
    }

    // Complete payout (after manual SOL transfer)
    if (action === 'complete') {
      if (!txSignature) {
        return res.status(400).json({
          success: false,
          error: 'Transaction signature required'
        });
      }

      const result = await pool.query(`
        UPDATE gold_sales 
        SET status = 'completed',
            tx_signature = $1,
            completed_at = NOW(),
            completed_by = $2
        WHERE id = $3 AND status IN ('pending', 'approved')
        RETURNING *
      `, [txSignature, sessionCheck.username, payoutId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Payout not found or already completed'
        });
      }

      console.log(`✅ Payout ${payoutId} completed by ${sessionCheck.username}`);

      return res.status(200).json({
        success: true,
        message: 'Payout completed',
        payout: result.rows[0]
      });
    }

    // Reject payout
    if (action === 'reject') {
      const result = await pool.query(`
        UPDATE gold_sales 
        SET status = 'rejected',
            reject_reason = $1,
            rejected_by = $2,
            rejected_at = NOW()
        WHERE id = $3 AND status = 'pending'
        RETURNING *
      `, [rejectReason || 'No reason provided', sessionCheck.username, payoutId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Payout not found or already processed'
        });
      }

      // Refund gold to user
      await pool.query(`
        UPDATE users 
        SET gold_balance = gold_balance + $1
        WHERE wallet_address = $2
      `, [result.rows[0].gold_amount, result.rows[0].wallet_address]);

      console.log(`⚠️ Payout ${payoutId} rejected by ${sessionCheck.username}`);

      return res.status(200).json({
        success: true,
        message: 'Payout rejected and gold refunded',
        payout: result.rows[0]
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('❌ Admin payout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Payout management error: ' + error.message
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
