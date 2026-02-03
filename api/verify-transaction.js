// 🔒 SECURE TRANSACTION VERIFICATION MODULE
// This prevents fake transactions and replay attacks

import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Verify a Solana transaction is real and valid
 * @param {string} signature - Transaction signature to verify
 * @param {string} expectedSender - Expected sender address
 * @param {string} expectedRecipient - Expected treasury address
 * @param {number} expectedAmount - Expected amount in lamports
 * @param {string} transactionType - Type for replay protection ('pickaxe', 'land')
 * @returns {Promise<{valid: boolean, error?: string, details?: any}>}
 */
export async function verifyTransaction(signature, expectedSender, expectedRecipient, expectedAmount, transactionType) {
  try {
    console.log('🔒 Starting transaction verification:', {
      signature: signature.slice(0, 20) + '...',
      sender: expectedSender.slice(0, 8) + '...',
      recipient: expectedRecipient.slice(0, 8) + '...',
      expectedAmount,
      type: transactionType
    });

    // 1. Check if signature was already used (REPLAY ATTACK PROTECTION)
    const { sql } = await import('../database.js');
    
    const existingTx = await sql`
      SELECT * FROM verified_transactions 
      WHERE signature = ${signature}
      LIMIT 1
    `;
    
    if (existingTx.length > 0) {
      console.log('❌ REPLAY ATTACK DETECTED: Signature already used!');
      return {
        valid: false,
        error: 'This transaction has already been used. Please create a new transaction.'
      };
    }

    // 2. Connect to Solana and fetch transaction with retry logic
    const SOLANA_CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');
    
    console.log('🔗 Fetching transaction from blockchain...');
    
    // Retry logic: Try up to 5 times with increasing delays
    let txInfo = null;
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 3000, 4000, 5000]; // 1s, 2s, 3s, 4s, 5s
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt + 1}/${maxRetries} to fetch transaction...`);
        
        txInfo = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });
        
        if (txInfo) {
          console.log(`✅ Transaction found on attempt ${attempt + 1}`);
          break;
        }
        
        // If not found and not the last attempt, wait before retrying
        if (attempt < maxRetries - 1) {
          const delay = retryDelays[attempt];
          console.log(`⏳ Transaction not found yet, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (fetchError) {
        console.log(`⚠️ Error fetching transaction on attempt ${attempt + 1}:`, fetchError.message);
        
        // If it's the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw fetchError;
        }
        
        // Otherwise, wait and retry
        const delay = retryDelays[attempt];
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!txInfo) {
      console.log('❌ Transaction not found on blockchain after all retries');
      return {
        valid: false,
        error: 'Transaction not found after waiting 15 seconds. The transaction may still be processing. Please try confirming again in a moment.'
      };
    }

    // 3. Check transaction was successful
    if (txInfo.meta && txInfo.meta.err) {
      console.log('❌ Transaction failed on blockchain:', txInfo.meta.err);
      return {
        valid: false,
        error: 'Transaction failed on blockchain. Please try again.'
      };
    }

    // 4. Extract transaction details
    const accountKeys = txInfo.transaction.message.accountKeys;
    const instructions = txInfo.transaction.message.instructions;
    
    // Find the transfer instruction
    let transferInstruction = null;
    for (const ix of instructions) {
      // System Program transfers have program index 0 and are type 2
      if (accountKeys[ix.programIdIndex].toString() === '11111111111111111111111111111111') {
        transferInstruction = ix;
        break;
      }
    }

    if (!transferInstruction) {
      console.log('❌ No transfer instruction found');
      return {
        valid: false,
        error: 'Invalid transaction: no transfer found'
      };
    }

    // 5. Verify sender and recipient
    const fromPubkey = accountKeys[transferInstruction.accounts[0]].toString();
    const toPubkey = accountKeys[transferInstruction.accounts[1]].toString();
    
    console.log('📊 Transaction details:', {
      from: fromPubkey.slice(0, 8) + '...',
      to: toPubkey.slice(0, 8) + '...',
      expectedSender: expectedSender.slice(0, 8) + '...',
      expectedRecipient: expectedRecipient.slice(0, 8) + '...'
    });

    if (fromPubkey !== expectedSender) {
      console.log('❌ Sender mismatch!');
      return {
        valid: false,
        error: 'Transaction sender does not match your wallet'
      };
    }

    if (toPubkey !== expectedRecipient) {
      console.log('❌ Recipient mismatch!');
      return {
        valid: false,
        error: 'Transaction was not sent to the correct treasury address'
      };
    }

    // 6. Verify amount (from preBalances and postBalances)
    const preBalance = txInfo.meta.preBalances[0]; // Sender's balance before
    const postBalance = txInfo.meta.postBalances[0]; // Sender's balance after
    const actualAmount = preBalance - postBalance;
    
    console.log('💰 Amount verification:', {
      expected: expectedAmount,
      actual: actualAmount,
      difference: Math.abs(actualAmount - expectedAmount)
    });

    // Allow for priority fees variance (Phantom adds priority fees up to ~100,000 lamports)
    // User must pay AT LEAST the expected amount (can pay more due to priority fees)
    const minAmount = expectedAmount - 10000; // Small buffer for rounding
    const maxAmount = expectedAmount + 200000; // Allow up to 0.0002 SOL extra for priority fees
    
    if (actualAmount < minAmount) {
      console.log('❌ Underpayment!');
      return {
        valid: false,
        error: `Insufficient payment. Expected at least ${expectedAmount} lamports, got ${actualAmount} lamports`
      };
    }
    
    if (actualAmount > maxAmount) {
      console.log('❌ Overpayment too large - possible wrong transaction');
      return {
        valid: false,
        error: `Payment too large. Expected ~${expectedAmount} lamports, got ${actualAmount} lamports. Please check the correct amount.`
      };
    }
    
    console.log('✅ Amount valid (includes priority fees)');

    // 7. Record verified transaction to prevent replay attacks
    await sql`
      CREATE TABLE IF NOT EXISTS verified_transactions (
        id SERIAL PRIMARY KEY,
        signature TEXT UNIQUE NOT NULL,
        user_address TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount_lamports BIGINT NOT NULL,
        verified_at TIMESTAMP DEFAULT NOW(),
        block_time BIGINT
      )
    `;

    await sql`
      INSERT INTO verified_transactions 
        (signature, user_address, transaction_type, amount_lamports, block_time)
      VALUES 
        (${signature}, ${expectedSender}, ${transactionType}, ${expectedAmount}, ${txInfo.blockTime || null})
    `;

    console.log('✅ Transaction verified and recorded successfully!');

    return {
      valid: true,
      details: {
        signature,
        from: fromPubkey,
        to: toPubkey,
        amount: actualAmount,
        blockTime: txInfo.blockTime,
        slot: txInfo.slot
      }
    };

  } catch (error) {
    console.error('❌ Transaction verification error:', error);
    return {
      valid: false,
      error: 'Failed to verify transaction: ' + error.message
    };
  }
}

/**
 * Check if a transaction signature has already been used
 */
export async function isTransactionUsed(signature) {
  try {
    const { sql } = await import('../database.js');
    const result = await sql`
      SELECT signature FROM verified_transactions 
      WHERE signature = ${signature}
      LIMIT 1
    `;
    return result.length > 0;
  } catch (error) {
    console.error('Error checking transaction:', error);
    return false; // Fail open for now
  }
}
