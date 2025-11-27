import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body || {};
    if (!address) {
      return res.status(400).json({ error: 'address required' });
    }
    
    const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY;
    if (!TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'treasury not configured; set TREASURY_PUBLIC_KEY in environment' });
    }

    // 🔄 FORCE CLEAR MEMORY CACHE FIRST
    if (typeof global !== 'undefined') {
      global.users = {};
      console.log('🔄 Cleared global.users memory cache');
    }
    
    // 🔧 FIX: Check if user already has land using DATABASE instead of memory cache
    console.log(`🔍 Checking land ownership for ${address.slice(0, 8)}... via database`);
    
    try {
      const { getUserOptimized } = await import('../database.js');
      const userData = await getUserOptimized(address);
      
      console.log(`📊 Database land check result:`, {
        user_exists: !!userData,
        has_land: userData?.has_land || false,
        memory_cache_cleared: true
      });
      
      if (userData && userData.has_land) {
        console.log(`❌ User already owns land according to database`);
        return res.status(400).json({ error: 'User already owns land' });
      }
      
      console.log(`✅ User can purchase land - no existing land ownership found`);
    } catch (dbError) {
      console.error('❌ Database error during land check:', dbError.message);
      console.log('⚠️ Falling back to allow purchase due to database error');
      // If database check fails, allow the purchase (better than blocking legitimate purchases)
    }

    let payer, treasury;
    try {
      payer = new PublicKey(address);
    } catch {
      return res.status(400).json({ error: 'invalid payer address' });
    }
    try {
      treasury = new PublicKey(TREASURY_PUBLIC_KEY);
    } catch {
      return res.status(400).json({ error: 'invalid TREASURY_PUBLIC_KEY in server config' });
    }

    const landCostSOL = 0.001; // 0.001 SOL for land (TESTING PRICE)
    const costLamports = Math.round(landCostSOL * LAMPORTS_PER_SOL);

    const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: costLamports }));

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
    res.json({
      transaction: serialized,
      lastValidBlockHeight,
      costLamports,
      landCostSOL
    });
  } catch (e) {
    console.error('purchase-land error', e);
    res.status(500).json({ error: 'failed to create land purchase transaction: ' + (e?.message || 'unknown') });
  }
}