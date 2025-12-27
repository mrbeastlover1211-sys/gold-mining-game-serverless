// 🎯 Generate Dynamic Referral Links with Latest Deployment URL

export default async function handler(req, res) {
  try {
    const { method } = req;
    
    if (method === 'POST') {
      const { referrerAddress } = req.body;
      
      if (!referrerAddress) {
        return res.status(400).json({
          error: 'Referrer address is required',
          usage: 'POST with { "referrerAddress": "wallet_address" }'
        });
      }
      
      console.log(`🎯 Generating dynamic referral link for ${referrerAddress.slice(0, 8)}...`);
      
      // Use custom domain for referral links
      const baseUrl = 'https://www.thegoldmining.com';
      
      // Create the dynamic referral link
      const referralLink = `${baseUrl}/?ref=${referrerAddress}`;
      
      console.log('🚀 Dynamic referral link generated:', referralLink);
      
      return res.json({
        success: true,
        referralLink,
        baseUrl,
        referrerAddress,
        deploymentInfo: {
          url: deploymentUrl,
          isLatest: deploymentUrl !== 'gold-mining-game-serverless.vercel.app',
          timestamp: new Date().toISOString()
        },
        message: 'Dynamic referral link generated with latest deployment URL'
      });
      
    } else if (method === 'GET') {
      // Return current deployment info
      const baseUrl = 'https://www.thegoldmining.com';
      
      return res.json({
        success: true,
        currentDeployment: {
          url: 'www.thegoldmining.com',
          baseUrl,
          isPreview: deploymentUrl !== 'gold-mining-game-serverless.vercel.app',
          timestamp: new Date().toISOString()
        },
        message: 'Current deployment info',
        usage: 'POST with referrerAddress to generate dynamic link'
      });
      
    } else {
      return res.status(405).json({
        error: 'Method not allowed',
        supportedMethods: ['GET', 'POST']
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating dynamic referral:', error);
    
    return res.status(500).json({
      error: error.message,
      message: 'Failed to generate dynamic referral link'
    });
  }
}