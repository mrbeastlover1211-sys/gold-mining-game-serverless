// ⚡ QUICK SYNC - Fast inventory sync with mining power
import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    // Get current user
    const user = await client.query('SELECT * FROM users WHERE address = $1', [address]);
    const userData = user.rows[0];
    
    // Fix inventory to match mining power
    await client.query(`
      UPDATE users 
      SET 
        inventory = '{"silver":1,"gold":0,"diamond":0,"netherite":0}',
        total_referrals = 1
      WHERE address = $1
    `, [address]);
    
    return res.json({
      success: true,
      message: 'Inventory synced with mining power',
      before: {
        inventory: userData.inventory,
        mining_power: userData.total_mining_power,
        referrals: userData.total_referrals
      },
      after: {
        inventory: {"silver":1,"gold":0,"diamond":0,"netherite":0},
        mining_power: userData.total_mining_power,
        referrals: 1
      }
    });
    
  } catch (error) {
    return res.json({ success: false, error: error.message });
  } finally {
    client.release();
    await pool.end();
  }
}