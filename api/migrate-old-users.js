// Migrate users from old schema to new schema
export default async function handler(req, res) {
  try {
    const { getDatabase } = await import('../database.js');
    const db = await getDatabase();
    
    console.log('🔄 Starting user data migration...');
    
    // Check if old users table structure exists
    const oldUsers = await db.query('SELECT * FROM users LIMIT 5');
    console.log('📊 Sample existing users:', oldUsers.rows);
    
    // Get all users from old structure
    const allUsers = await db.query('SELECT * FROM users');
    
    let migrated = 0;
    let errors = [];
    
    for (const user of allUsers.rows) {
      try {
        // Migrate each user to new schema format
        await db.query(`
          UPDATE users SET
            total_gold_mined = COALESCE(last_checkpoint_gold, 0),
            total_pickaxes_bought = COALESCE(silver_pickaxes + gold_pickaxes + diamond_pickaxes + netherite_pickaxes, 0),
            player_level = 1,
            experience_points = 0,
            total_logins = 1,
            login_streak = 1,
            last_login_date = CURRENT_DATE,
            referral_code = CASE 
              WHEN referral_code IS NULL THEN 'GM' || UPPER(SUBSTRING(MD5(address || EXTRACT(epoch FROM NOW())), 1, 6))
              ELSE referral_code 
            END
          WHERE address = $1
        `, [user.address]);
        
        migrated++;
      } catch (userError) {
        errors.push({
          address: user.address.slice(0, 8) + '...',
          error: userError.message
        });
      }
    }
    
    console.log(`✅ Migration complete: ${migrated} users migrated`);
    
    res.json({
      success: true,
      migrated_users: migrated,
      total_users: allUsers.rows.length,
      errors: errors.length > 0 ? errors : null,
      message: 'User data migration completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
}