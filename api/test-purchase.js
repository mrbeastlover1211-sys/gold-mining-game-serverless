// Minimal test version of purchase-confirm to isolate the issue
export default async function handler(req, res) {
  try {
    console.log('🧪 Test purchase API called');
    console.log('📝 Method:', req.method);
    console.log('📝 Body:', req.body);
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { address, pickaxeType, quantity, signature } = req.body || {};
    
    if (!address || !pickaxeType || !signature) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { address: !!address, pickaxeType: !!pickaxeType, signature: !!signature }
      });
    }
    
    console.log(`🧪 Test purchase request for ${address.slice(0, 8)}... - ${pickaxeType}`);
    
    // Test basic response
    return res.status(200).json({
      success: true,
      message: 'Test purchase API working',
      data: {
        address: address.slice(0, 8) + '...',
        pickaxeType,
        quantity: quantity || 1,
        signature: signature.slice(0, 8) + '...',
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('❌ Test purchase API error:', error);
    return res.status(500).json({
      error: 'Test API error',
      message: error.message,
      stack: error.stack
    });
  }
}