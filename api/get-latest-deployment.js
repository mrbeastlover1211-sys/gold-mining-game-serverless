// 🚀 Get Latest Vercel Deployment URL for Dynamic Referral Links

export default async function handler(req, res) {
  try {
    console.log('🚀 Getting latest Vercel deployment URL...');
    
    // Get the current deployment URL from Vercel environment variables
    const deploymentUrl = process.env.VERCEL_URL;
    const productionUrl = 'gold-mining-game-serverless.vercel.app';
    
    // If we're on a deployment URL (not production), use it
    if (deploymentUrl && deploymentUrl !== productionUrl) {
      const fullUrl = `https://${deploymentUrl}`;
      console.log('✅ Latest deployment URL:', fullUrl);
      
      return res.json({
        success: true,
        latestUrl: fullUrl,
        deploymentId: deploymentUrl.split('-')[2] || 'unknown',
        isPreview: true,
        message: 'Using latest deployment URL for referral links'
      });
    }
    
    // Fallback to production URL if no deployment URL
    const fallbackUrl = `https://${productionUrl}`;
    console.log('📍 Using production URL:', fallbackUrl);
    
    return res.json({
      success: true,
      latestUrl: fallbackUrl,
      deploymentId: 'production',
      isPreview: false,
      message: 'Using production URL (no deployment URL found)'
    });
    
  } catch (error) {
    console.error('❌ Error getting latest deployment:', error);
    
    return res.status(500).json({
      error: error.message,
      fallbackUrl: 'https://gold-mining-game-serverless.vercel.app',
      message: 'Error getting deployment URL, using fallback'
    });
  }
}