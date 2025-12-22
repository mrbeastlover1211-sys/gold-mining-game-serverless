// 🧪 TEST COMPLETE REFERRAL - See exactly why it's failing
import { pool, getUserOptimized, saveUserOptimized } from '../database.js';

export default async function handler(req, res) {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'address parameter required (the NEW user who completed requirements)' });
    }
    
    const client = await pool.connect();
    const debugInfo = {};
    
    try {
      // Step 1: Check for pending referral
      debugInfo.step1 = 'Checking for pending referral...';
      const pendingReferral = await client.query(`
        SELECT * FROM referral_visits 
        WHERE converted_address = $1 
        AND converted = true
        AND expires_at > CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM referrals 
          WHERE referrals.referred_address = $1 
          AND referrals.status = 'completed_referral'
        )
      `, [address]);
      
      debugInfo.pendingReferralCount = pendingReferral.rows.length;
      debugInfo.pendingReferralData = pendingReferral.rows[0] || null;
      
      if (pendingReferral.rows.length === 0) {
        // Check if already completed
        const alreadyCompleted = await client.query(`
          SELECT * FROM referrals 
          WHERE referred_address = $1 
          AND status = 'completed_referral'
        `, [address]);
        
        debugInfo.alreadyCompletedCount = alreadyCompleted.rows.length;
        debugInfo.alreadyCompletedData = alreadyCompleted.rows[0] || null;
        
        client.release();
        return res.json({
          success: false,
          reason: alreadyCompleted.rows.length > 0 ? 'Already rewarded' : 'No pending referral found',
          debug: debugInfo
        });
      }
      
      const referralVisit = pendingReferral.rows[0];
      const referrerAddress = referralVisit.referrer_address;
      
      debugInfo.step2 = 'Found referral visit';
      debugInfo.referrer = referrerAddress;
      
      // Step 2: Check user requirements
      debugInfo.step3 = 'Checking user requirements...';
      const userCheck = await client.query(`
        SELECT 
          address, has_land, 
          silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes
        FROM users 
        WHERE address = $1
      `, [address]);
      
      debugInfo.userFound = userCheck.rows.length > 0;
      debugInfo.userData = userCheck.rows[0] || null;
      
      if (userCheck.rows.length === 0) {
        client.release();
        return res.json({
          success: false,
          reason: 'User not found in database',
          debug: debugInfo
        });
      }
      
      const userData = userCheck.rows[0];
      const hasLand = userData.has_land;
      const totalPickaxes = (userData.silver_pickaxes || 0) +
                            (userData.gold_pickaxes || 0) +
                            (userData.diamond_pickaxes || 0) +
                            (userData.netherite_pickaxes || 0);
      
      debugInfo.hasLand = hasLand;
      debugInfo.totalPickaxes = totalPickaxes;
      debugInfo.requirementsMet = hasLand && totalPickaxes > 0;
      
      if (!hasLand || totalPickaxes === 0) {
        client.release();
        return res.json({
          success: false,
          reason: 'Requirements not met',
          debug: debugInfo
        });
      }
      
      // Step 3: Get referrer
      debugInfo.step4 = 'Getting referrer data...';
      const referrerData = await getUserOptimized(referrerAddress, false);
      
      debugInfo.referrerFound = !!referrerData;
      debugInfo.referrerHasLand = referrerData?.has_land;
      
      if (!referrerData) {
        client.release();
        return res.json({
          success: false,
          reason: 'Referrer not found in database',
          debug: debugInfo
        });
      }
      
      debugInfo.step5 = 'All checks passed! Ready to reward';
      
      client.release();
      
      return res.json({
        success: true,
        message: 'All requirements met - referral SHOULD complete successfully',
        debug: debugInfo,
        nextStep: 'Call /api/manual-trigger-referral to force completion OR wait for automatic trigger'
      });
      
    } catch (queryError) {
      client.release();
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ Test complete referral error:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
