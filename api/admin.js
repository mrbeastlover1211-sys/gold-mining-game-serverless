// Admin API for managing gold mining game
import { getUserOptimized, getDatabase } from '../database.js';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';

const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
const TREASURY_SECRET_KEY = process.env.TREASURY_SECRET_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');

// Admin authentication middleware
function requireAuth(req) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
    throw new Error('Unauthorized access');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, password, ...params } = req.body;

    // Simple password auth
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    console.log(`🔧 Admin API action: ${action}`);

    switch (action) {
      case 'dashboard':
        return await getDashboardStats(req, res);
      
      case 'pending_payouts':
        return await getPendingPayouts(req, res);
      
      case 'process_payout':
        return await processPayout(req, res, params);
      
      case 'cancel_payout':
        return await cancelPayout(req, res, params);
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (e) {
    console.error('❌ Admin API error:', e.message);
    res.status(500).json({
      error: 'Admin API error',
      details: e.message
    });
  }
}

// Get dashboard statistics
async function getDashboardStats(req, res) {
  try {
    const db = await getDatabase();

    // Get land purchases count and total SOL received
    const landStats = await db.query(`
      SELECT 
        COUNT(*) as land_purchases,
        SUM(CASE WHEN transaction_type = 'land_purchase' THEN amount_sol ELSE 0 END) as total_land_sol
      FROM transactions 
      WHERE transaction_type = 'land_purchase'
    `);

    // Get pickaxe purchases with SOL count and total
    const pickaxeStats = await db.query(`
      SELECT 
        COUNT(*) as pickaxe_purchases,
        SUM(amount_sol) as total_pickaxe_sol
      FROM transactions 
      WHERE transaction_type = 'pickaxe_purchase' AND payment_method = 'sol'
    `);

    // Get unique active users (users with land)
    const activeUsers = await db.query(`
      SELECT COUNT(*) as active_users
      FROM users 
      WHERE has_land = true
    `);

    // Get current online users (active in last 10 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const onlineUsers = await db.query(`
      SELECT COUNT(*) as online_users
      FROM users 
      WHERE last_activity > $1
    `, [currentTime - 600]); // 10 minutes

    // Get total SOL received (land + pickaxes)
    const totalSOL = (landStats.rows[0]?.total_land_sol || 0) + (pickaxeStats.rows[0]?.total_pickaxe_sol || 0);

    // Get pending payouts count and total
    const pendingStats = await db.query(`
      SELECT 
        COUNT(*) as pending_count,
        SUM(payout_sol) as total_pending_sol
      FROM gold_sales 
      WHERE status = 'pending'
    `);

    res.json({
      success: true,
      stats: {
        land_purchases: parseInt(landStats.rows[0]?.land_purchases || 0),
        pickaxe_purchases: parseInt(pickaxeStats.rows[0]?.pickaxe_purchases || 0),
        total_sol_received: parseFloat(totalSOL || 0).toFixed(6),
        active_users: parseInt(activeUsers.rows[0]?.active_users || 0),
        online_users: parseInt(onlineUsers.rows[0]?.online_users || 0),
        pending_payouts: parseInt(pendingStats.rows[0]?.pending_count || 0),
        pending_sol: parseFloat(pendingStats.rows[0]?.total_pending_sol || 0).toFixed(6)
      }
    });

  } catch (e) {
    console.error('❌ Dashboard stats error:', e);
    throw e;
  }
}

// Get pending payouts
async function getPendingPayouts(req, res) {
  try {
    const db = await getDatabase();

    const pendingPayouts = await db.query(`
      SELECT 
        id,
        wallet_address,
        gold_amount,
        payout_sol,
        created_at,
        EXTRACT(EPOCH FROM created_at) as timestamp
      FROM gold_sales 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      payouts: pendingPayouts.rows.map(row => ({
        id: row.id,
        wallet: row.wallet_address,
        goldAmount: parseInt(row.gold_amount),
        solAmount: parseFloat(row.payout_sol),
        createdAt: new Date(row.timestamp * 1000).toISOString(),
        timestamp: row.timestamp
      }))
    });

  } catch (e) {
    console.error('❌ Pending payouts error:', e);
    throw e;
  }
}

// Process payout (send SOL to user)
async function processPayout(req, res, params) {
  const { payoutId, editedSolAmount } = params;

  if (!payoutId || typeof editedSolAmount !== 'number') {
    return res.status(400).json({ error: 'payoutId and editedSolAmount required' });
  }

  if (!TREASURY_SECRET_KEY) {
    return res.status(400).json({ error: 'Treasury not configured for automatic payouts' });
  }

  try {
    const db = await getDatabase();

    // Get payout details
    const payout = await db.query(`
      SELECT * FROM gold_sales WHERE id = $1 AND status = 'pending'
    `, [payoutId]);

    if (payout.rows.length === 0) {
      return res.status(404).json({ error: 'Payout not found or already processed' });
    }

    const payoutData = payout.rows[0];
    const userWallet = payoutData.wallet_address;

    console.log(`💰 Processing payout: ${editedSolAmount} SOL to ${userWallet.slice(0, 8)}...`);

    // Send SOL transaction
    const secret = Uint8Array.from(JSON.parse(TREASURY_SECRET_KEY));
    const kp = Keypair.fromSecretKey(secret);
    const toPubkey = new PublicKey(userWallet);
    const lamports = Math.round(editedSolAmount * LAMPORTS_PER_SOL);

    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ 
      fromPubkey: kp.publicKey, 
      toPubkey, 
      lamports 
    }));

    const signature = await connection.sendTransaction(tx, [kp]);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    // Update payout status in database
    await db.query(`
      UPDATE gold_sales 
      SET 
        status = 'completed',
        final_payout_sol = $1,
        transaction_signature = $2,
        processed_at = NOW(),
        admin_notes = 'Processed with edited amount'
      WHERE id = $3
    `, [editedSolAmount, signature, payoutId]);

    console.log(`✅ Payout processed! Signature: ${signature}`);

    res.json({
      success: true,
      message: `Successfully sent ${editedSolAmount} SOL to user`,
      signature: signature,
      confirmation: confirmation.value
    });

  } catch (e) {
    console.error('❌ Process payout error:', e);
    throw e;
  }
}

// Cancel payout (user loses gold and gets nothing)
async function cancelPayout(req, res, params) {
  const { payoutId, reason } = params;

  if (!payoutId) {
    return res.status(400).json({ error: 'payoutId required' });
  }

  try {
    const db = await getDatabase();

    // Update payout status to cancelled
    const result = await db.query(`
      UPDATE gold_sales 
      SET 
        status = 'cancelled',
        admin_notes = $1,
        processed_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `, [reason || 'Cancelled by admin', payoutId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payout not found or already processed' });
    }

    const cancelledPayout = result.rows[0];
    console.log(`❌ Cancelled payout for ${cancelledPayout.wallet_address.slice(0, 8)}... - ${cancelledPayout.gold_amount} gold lost`);

    res.json({
      success: true,
      message: `Payout cancelled. User lost ${cancelledPayout.gold_amount} gold and receives nothing.`,
      cancelledAmount: parseFloat(cancelledPayout.payout_sol)
    });

  } catch (e) {
    console.error('❌ Cancel payout error:', e);
    throw e;
  }
}