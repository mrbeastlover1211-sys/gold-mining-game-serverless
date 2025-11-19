// API endpoint to clear all user data from database
import database from '../database.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Optional: Add authentication/admin check
    const { adminToken } = req.body;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';
    
    if (!adminToken || adminToken !== ADMIN_TOKEN) {
      return res.status(401).json({ 
        error: 'Unauthorized. Admin token required.',
        hint: 'Send POST request with { "adminToken": "your_admin_token" }'
      });
    }

    console.log('🧹 Admin requested database clear...');

    // Get current user count
    let userCount = 0;
    try {
      const users = await database.getAllUsers();
      userCount = users ? users.length : 0;
      console.log(`📊 Found ${userCount} users to clear`);
    } catch (error) {
      console.log('ℹ️ Could not count users, proceeding with clear...');
    }

    // Clear all users from database
    let clearedCount = 0;
    try {
      // Method 1: Try bulk delete if available
      if (database.clearAllUsers) {
        await database.clearAllUsers();
        clearedCount = userCount;
        console.log('✅ Bulk clear successful');
      } 
      // Method 2: Try individual deletion
      else if (database.getAllUsers && database.deleteUser) {
        const users = await database.getAllUsers();
        for (const user of users) {
          await database.deleteUser(user.wallet_address || user.address);
          clearedCount++;
        }
        console.log(`✅ Individual deletion completed: ${clearedCount} users`);
      }
      // Method 3: Try direct SQL if available
      else if (database.query) {
        const result = await database.query('DELETE FROM users');
        clearedCount = result.rowCount || 0;
        console.log(`✅ SQL delete completed: ${clearedCount} users`);
      }
      else {
        throw new Error('No suitable delete method available in database module');
      }
    } catch (error) {
      console.error('❌ Database clear failed:', error.message);
      return res.status(500).json({ 
        error: 'Failed to clear database',
        details: error.message,
        userCount: userCount
      });
    }

    // Verify database is empty
    let remainingUsers = 0;
    try {
      const users = await database.getAllUsers();
      remainingUsers = users ? users.length : 0;
    } catch (error) {
      console.log('ℹ️ Could not verify clear, assuming successful');
    }

    // Also clear local file as backup
    try {
      const fs = await import('fs');
      await fs.promises.writeFile('data/users.json', '{}');
      console.log('✅ Local file cleared as backup');
    } catch (error) {
      console.log('ℹ️ Local file not accessible (normal for serverless)');
    }

    const success = remainingUsers === 0;
    
    console.log(`🎉 Database clear ${success ? 'SUCCESSFUL' : 'PARTIAL'}`);
    
    res.json({
      success: success,
      message: success ? 'Database cleared successfully!' : 'Database partially cleared',
      usersClearedCount: clearedCount,
      remainingUsers: remainingUsers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Clear database API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Export for testing
export { handler };