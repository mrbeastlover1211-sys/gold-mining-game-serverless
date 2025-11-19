// Use same working pattern as status.js and buy-with-gold.js
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getUserOptimized, saveUserOptimized } from '../database.js';

// Constants (same as in config.js)
const GOLD_PRICE_SOL = parseFloat(process.env.GOLD_PRICE_SOL || '0.000001');
const MIN_SELL_GOLD = parseInt(process.env.MIN_SELL_GOLD || '10000', 10);
const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
const TREASURY_SECRET_KEY = process.env.TREASURY_SECRET_KEY;

const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');

function calculateCurrentGold(user) {
  if (!user.checkpoint_timestamp || !user.total_mining_power) {
    return user.last_checkpoint_gold || 0;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
  const goldPerSecond = user.total_mining_power / 60;
  const goldMined = goldPerSecond * timeSinceCheckpoint;
  const baseGold = parseFloat(user.last_checkpoint_gold || 0);
  
  return baseGold + goldMined;
}

function validateSellAmount(currentGold, requestedAmount, address) {
  const maxSellable = currentGold * 0.99; // Allow 1% buffer for timing
  
  if (requestedAmount > maxSellable) {
    console.warn(`🚨 CHEAT DETECTED: Trying to sell more gold than owned by ${address.slice(0, 8)}... Has: ${currentGold.toFixed(2)}, Trying to sell: ${requestedAmount}`);
    return Math.max(0, maxSellable);
  }
  
  return requestedAmount;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, amountGold } = req.body || {};
    
    console.log(`💰 Sell request: ${amountGold} gold from ${address?.slice(0, 8)}...`);
    
    if (!address || typeof amountGold !== 'number') {
      return res.status(400).json({ error: 'address and amountGold required' });
    }
    
    // Get user data using same method as other working APIs
    let user;
    try {
      user = await getUserOptimized(address);
      console.log(`🔍 Sell API getUserOptimized result:`, {
        found: !!user,
        has_land: user?.has_land,
        address: user?.address?.slice(0, 8)
      });
    } catch (dbError) {
      console.error(`❌ Sell API database error:`, dbError.message);
      return res.status(500).json({
        error: 'Database error in sell API',
        details: dbError.message
      });
    }
    
    if (!user) {
      return res.status(400).json({ error: 'User not found. Please connect wallet and refresh.' });
    }

    if (!user.has_land) {
      return res.status(400).json({ error: 'You need to purchase land first!' });
    }
    
    // Validate minimum sell amount
    if (amountGold < MIN_SELL_GOLD) {
      return res.status(400).json({ error: `Minimum sell amount is ${MIN_SELL_GOLD.toLocaleString()} gold` });
    }
    
    // Calculate current gold using same method as other APIs
    const currentTime = Math.floor(Date.now() / 1000);
    const currentGold = calculateCurrentGold(user);
    
    console.log(`💰 Gold calculation for sell:`, {
      currentGold: currentGold.toFixed(2),
      requestedSell: amountGold,
      goldPrice: GOLD_PRICE_SOL,
      estimatedSOL: (amountGold * GOLD_PRICE_SOL).toFixed(6)
    });
    
    // Anti-cheat: Validate sell amount
    const validatedAmount = validateSellAmount(currentGold, amountGold, address);
    
    if (validatedAmount !== amountGold) {
      console.warn(`🚨 Sell amount adjusted for ${address.slice(0, 8)}... Requested: ${amountGold}, Allowed: ${validatedAmount}`);
      return res.status(400).json({ 
        error: `Can only sell ${Math.floor(validatedAmount)} gold. You have ${Math.floor(currentGold)} gold available.`,
        maxSellable: Math.floor(validatedAmount)
      });
    }
    
    // Check if user has enough gold
    if (currentGold < validatedAmount) {
      return res.status(400).json({ 
        error: `Insufficient gold. You have ${Math.floor(currentGold)} gold but need ${validatedAmount} gold.`,
        currentGold: Math.floor(currentGold)
      });
    }

    const payoutSol = validatedAmount * GOLD_PRICE_SOL;
    const newGold = currentGold - validatedAmount;

    // Update user data using same method as other APIs
    user.last_checkpoint_gold = newGold;
    user.checkpoint_timestamp = currentTime;
    user.last_activity = currentTime;
    
    console.log(`🔄 Updating user after sell:`, {
      oldGold: currentGold.toFixed(2),
      newGold: newGold.toFixed(2),
      soldAmount: validatedAmount,
      payoutSOL: payoutSol.toFixed(6)
    });
    
    // Save user data using same method as other working APIs
    await saveUserOptimized(address, user);

    console.log(`💰 ${address.slice(0, 8)}... sold ${validatedAmount} gold for ${payoutSol.toFixed(6)} SOL`);

    if (!TREASURY_SECRET_KEY) {
      // No auto payout, return success with pending status
      return res.json({ 
        success: true, 
        payoutSol: payoutSol.toFixed(6), 
        mode: 'pending', 
        newGold: newGold.toFixed(2),
        message: 'Gold sold successfully! Payout pending manual processing.',
        note: 'Server not configured for automatic payouts. Your sale has been recorded.' 
      });
    }

    try {
      const secret = Uint8Array.from(JSON.parse(TREASURY_SECRET_KEY));
      const { Keypair } = await import('@solana/web3.js');
      const kp = Keypair.fromSecretKey(secret);
      const toPubkey = new PublicKey(address);
      const lamports = Math.round(payoutSol * LAMPORTS_PER_SOL);
      
      console.log(`💸 Sending ${payoutSol.toFixed(6)} SOL (${lamports} lamports) to ${address.slice(0, 8)}...`);
      
      const tx = new Transaction();
      tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey, lamports }));
      const sig = await connection.sendTransaction(tx, [kp]);
      const conf = await connection.confirmTransaction(sig, 'confirmed');
      
      console.log(`✅ Payout successful! Signature: ${sig}`);
      
      return res.json({ 
        success: true, 
        payoutSol: payoutSol.toFixed(6), 
        newGold: newGold.toFixed(2),
        signature: sig, 
        status: conf.value,
        message: `Successfully sold ${validatedAmount} gold for ${payoutSol.toFixed(6)} SOL!`
      });
    } catch (payoutError) {
      console.error('❌ Payout failed:', payoutError.message);
      return res.json({ 
        success: true, 
        payoutSol: payoutSol.toFixed(6), 
        newGold: newGold.toFixed(2),
        mode: 'pending', 
        error: 'Automatic payout failed. Your sale has been recorded and will be processed manually.',
        details: payoutError.message
      });
    }
    
  } catch (e) {
    console.error('❌ Sell API main catch block error:', e.message);
    console.error('❌ Full error:', e);
    console.error('❌ Stack trace:', e.stack);
    
    res.status(500).json({
      error: 'Sell API error',
      details: e.message,
      stack: e.stack?.split('\n').slice(0, 5)
    });
  }
}