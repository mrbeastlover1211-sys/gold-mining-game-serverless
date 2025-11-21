// 🎁 GIVE REWARD NOW - Simple direct reward
import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    const address = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    
    // Add 1 Silver Pickaxe + 100 Gold + 1 Referral
    await client.query(`
      UPDATE users 
      SET 
        inventory = jsonb_set(inventory, '{silver}', ((inventory->>'silver')::int + 1)::text::jsonb),
        gold = gold + 100,
        total_referrals = total_referrals + 1,
        total_mining_power = total_mining_power + 1
      WHERE address = $1
    `, [address]);
    
    return res.json({ success: true, message: 'Reward given: +1 Silver Pickaxe, +100 Gold, +1 Referral' });
  } catch (error) {
    return res.json({ success: false, error: error.message });
  } finally {
    client.release();
    await pool.end();
  }
}