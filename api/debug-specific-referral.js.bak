// 🔍 DEBUG SPECIFIC REFERRAL ISSUE
export default async function handler(req, res) {
  try {
    console.log('🔍 Debugging specific referral issue...');
    
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ssl: { rejectUnauthorized: false },
      max: 2
    });
    
    const client = await pool.connect();
    
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const referredAccount = '2i9jcf5UGYQ7ZNoYjhJ1XFyrSmaAdJpQiwZh9xMsQEY8';
    
    console.log('🔍 Checking specific referral situation...');
    
    // 1. Check if referrals table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'referrals'
      )
    `);
    console.log('📊 Referrals table exists:', tableExists.rows[0].exists);
    
    // 2. Check all referrals in table
    try {
      const allReferrals = await client.query('SELECT * FROM referrals ORDER BY created_at DESC LIMIT 10');
      console.log('📋 All referrals in table:', allReferrals.rows);
    } catch (e) {
      console.log('❌ Error reading referrals table:', e.message);
    }
    
    // 3. Check specific referral
    try {
      const specificReferral = await client.query(`
        SELECT * FROM referrals 
        WHERE referrer_address = $1 AND referred_address = $2
      `, [mainAccount, referredAccount]);
      console.log('🎯 Specific referral exists:', specificReferral.rows);
    } catch (e) {
      console.log('❌ Error checking specific referral:', e.message);
    }
    
    // 4. Check users table for both accounts
    const mainUser = await client.query('SELECT address, total_referrals, referral_rewards_earned FROM users WHERE address = $1', [mainAccount]);
    const refUser = await client.query('SELECT address, referrer_address FROM users WHERE address = $1', [referredAccount]);
    
    console.log('👤 Main user data:', mainUser.rows[0]);
    console.log('👤 Referred user data:', refUser.rows[0]);
    
    // 5. Try to manually create the referral
    try {
      console.log('🧪 Attempting manual referral creation...');
      
      // First try to delete any existing referral
      await client.query('DELETE FROM referrals WHERE referrer_address = $1 AND referred_address = $2', [mainAccount, referredAccount]);
      
      // Create fresh referral
      const createResult = await client.query(`
        INSERT INTO referrals (referrer_address, referred_address, reward_amount, reward_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [mainAccount, referredAccount, 0.01, 'sol']);
      
      console.log('✅ Manual referral created:', createResult.rows[0]);
      
      // Update main user stats
      const updateResult = await client.query(`
        UPDATE users 
        SET total_referrals = total_referrals + 1,
            referral_rewards_earned = referral_rewards_earned + $1
        WHERE address = $2
        RETURNING total_referrals, referral_rewards_earned
      `, [0.01, mainAccount]);
      
      console.log('✅ Main user updated:', updateResult.rows[0]);
      
    } catch (createError) {
      console.error('❌ Manual creation failed:', createError.message);
    }
    
    client.release();
    
    
    return res.json({
      success: true,
      debug_complete: true,
      accounts: {
        main: mainAccount.slice(0, 8) + '...',
        referred: referredAccount.slice(0, 8) + '...'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
}