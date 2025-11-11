import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PICKAXES = {
  silver: { name: 'Silver', costSol: 0.001, ratePerSec: 1/60 },
  gold: { name: 'Gold', costSol: 0.001, ratePerSec: 10/60 },
  diamond: { name: 'Diamond', costSol: 0.001, ratePerSec: 100/60 },
  netherite: { name: 'Netherite', costSol: 0.001, ratePerSec: 10000/60 },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, pickaxeType, quantity } = req.body || {};
    if (!address || !pickaxeType || !PICKAXES[pickaxeType]) {
      return res.status(400).json({ error: 'address and valid pickaxeType required' });
    }
    const qty = Math.max(1, Math.min(1000, parseInt(quantity || '1', 10)));
    
    const TREASURY_PUBLIC_KEY = process.env.TREASURY_PUBLIC_KEY;
    if (!TREASURY_PUBLIC_KEY) {
      return res.status(400).json({ error: 'treasury not configured; set TREASURY_PUBLIC_KEY in environment' });
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

    const unitLamports = Math.round(PICKAXES[pickaxeType].costSol * LAMPORTS_PER_SOL);
    const costLamports = unitLamports * qty;

    const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: costLamports }));

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
    res.json({
      transaction: serialized,
      lastValidBlockHeight,
      pickaxeType,
      quantity: qty,
      costLamports,
    });
  } catch (e) {
    console.error('purchase-tx error', e);
    res.status(500).json({ error: 'failed to create transaction: ' + (e?.message || 'unknown') });
  }
}