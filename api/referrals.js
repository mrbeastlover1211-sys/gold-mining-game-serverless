// 🤝 Referral System API
import { createReferral, getReferralStats, getTopReferrers } from '../database.js';

export default async function handler(req, res) {
  const { method } = req;
  
  try {
    if (method === 'GET') {
      const { address, action } = req.query;
      
      if (action === 'leaderboard') {
        // Get top referrers leaderboard
        console.log('🏆 Fetching referral leaderboard...');
        const topReferrers = await getTopReferrers(20);
        
        return res.status(200).json({
          success: true,
          leaderboard: topReferrers,
          message: `Top ${topReferrers.length} referrers`
        });
        
      } else if (address) {
        // Get referral stats for specific user
        console.log(`📊 Getting referral stats for ${address.slice(0, 8)}...`);
        const stats = await getReferralStats(address);
        
        if (stats) {
          return res.status(200).json({
            success: true,
            stats: stats,
            message: 'Referral stats retrieved successfully'
          });
        } else {
          return res.status(404).json({
            error: 'User not found'
          });
        }
        
      } else {
        return res.status(400).json({
          error: 'Missing address parameter or action=leaderboard'
        });
      }
      
    } else if (method === 'POST') {
      const { referrerAddress, referredAddress, rewardAmount, rewardType } = req.body;
      
      if (!referrerAddress || !referredAddress) {
        return res.status(400).json({
          error: 'Missing required fields: referrerAddress, referredAddress'
        });
      }
      
      if (referrerAddress === referredAddress) {
        return res.status(400).json({
          error: 'Cannot refer yourself'
        });
      }
      
      console.log(`🤝 Creating referral: ${referrerAddress.slice(0, 8)}... → ${referredAddress.slice(0, 8)}...`);
      
      const result = await createReferral(
        referrerAddress, 
        referredAddress, 
        rewardAmount || 0.01, 
        rewardType || 'sol'
      );
      
      if (result) {
        return res.status(200).json({ 
          success: true,
          referralData: result,
          message: 'Referral created successfully! Referrer rewarded.'
        });
      } else {
        return res.status(400).json({
          error: 'Referral already exists or failed to create'
        });
      }
    }
    
    res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
    
  } catch (error) {
    console.error('❌ Referrals API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}