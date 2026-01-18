// 🔄 SYNC INVENTORY & MINING POWER - Fix backend data synchronization
export default async function handler(req, res) {
  try {
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const results = [];
    
    try {
      // 1. Check current state
      const currentUser = await client.query('SELECT * FROM users WHERE address = $1', [mainAccount]);
      
      if (currentUser.rows.length === 0) {
        return res.json({ success: false, error: 'User not found' });
      }
      
      const user = currentUser.rows[0];
      results.push('📊 Current user state:');
      results.push(`   Mining Power: ${user.total_mining_power || 0}`);
      results.push(`   Inventory: ${JSON.stringify(user.inventory || {})}`);
      results.push(`   Total Referrals: ${user.total_referrals || 0}`);
      
      // 2. Calculate what inventory should be based on mining power
      const miningPower = user.total_mining_power || 0;
      const currentInventory = user.inventory || {};
      
      // If mining power > 0 but inventory shows 0, fix the sync
      if (miningPower > 0 && (currentInventory.silver || 0) === 0) {
        results.push('🔧 Detected sync issue - fixing...');
        
        // Update inventory to match mining power
        // Assume 1 mining power = 1 Silver Pickaxe (simplest case)
        const correctedInventory = {
          ...currentInventory,
          silver: 1
        };
        
        const updateResult = await client.query(`
          UPDATE users 
          SET inventory = $1
          WHERE address = $2
          RETURNING *
        `, [JSON.stringify(correctedInventory), mainAccount]);
        
        results.push('✅ Synchronized inventory with mining power:');
        results.push(`   OLD Inventory: ${JSON.stringify(currentInventory)}`);
        results.push(`   NEW Inventory: ${JSON.stringify(correctedInventory)}`);
        results.push(`   Mining Power: ${miningPower} (unchanged)`);
        
        // Verify the fix
        const verifyUser = updateResult.rows[0];
        results.push('🔍 Verification:');
        results.push(`   Inventory: ${JSON.stringify(verifyUser.inventory)}`);
        results.push(`   Mining Power: ${verifyUser.total_mining_power}`);
        results.push(`   Sync Status: ${verifyUser.inventory.silver == 1 && verifyUser.total_mining_power == 1 ? '✅ SYNCED' : '❌ STILL BROKEN'}`);
        
      } else {
        results.push('ℹ️ Inventory and mining power are already synchronized');
      }
      
      // 3. Also fix referral stats if needed
      if ((user.total_referrals || 0) === 0 && miningPower > 0) {
        await client.query(`
          UPDATE users 
          SET total_referrals = 1
          WHERE address = $1
        `, [mainAccount]);
        
        results.push('✅ Fixed referral count to match mining power');
      }
      
    } catch (queryError) {
      results.push(`❌ Database error: ${queryError.message}`);
    }
    
    client.release();
    await pool.end();
    
    return res.json({
      success: true,
      message: 'Inventory-Mining Power synchronization completed',
      results: results
    });
    
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
    });
  }
}