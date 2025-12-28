// Test endpoint to give gold for testing
import { pool } from '../database.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, goldAmount = 500000 } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }

  let client;
  
  try {
    client = await pool.connect();
    
    // Give gold by updating checkpoint
    await client.query(`
      UPDATE users 
      SET last_checkpoint_gold = last_checkpoint_gold + $1,
          checkpoint_timestamp = EXTRACT(EPOCH FROM NOW())
      WHERE address = $2
    `, [goldAmount, address]);
    
    const result = await client.query(`
      SELECT address, last_checkpoint_gold, total_mining_power
      FROM users
      WHERE address = $1
    `, [address]);
    
    return res.status(200).json({
      success: true,
      message: `Gave ${goldAmount} gold to ${address.substring(0, 8)}...`,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
}
