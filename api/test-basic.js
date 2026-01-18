// Ultra-basic test API to identify what's breaking serverless functions
// No database, no external dependencies, just basic functionality

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🧪 Basic test API called');
    console.log('Method:', req.method);
    console.log('Body:', req.body);
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'Present' : 'Missing'
    });

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'Basic GET test working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      });
    }

    if (req.method === 'POST') {
      const { test, amount } = req.body || {};
      
      return res.status(200).json({
        success: true,
        message: 'Basic POST test working',
        received: { test, amount },
        timestamp: new Date().toISOString(),
        calculation: amount ? amount * 0.000001 : 0
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('❌ Basic test error:', e.message);
    console.error('❌ Stack:', e.stack);
    
    return res.status(500).json({
      error: 'Test API error',
      message: e.message,
      stack: e.stack
    });
  }
};