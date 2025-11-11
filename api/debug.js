// Debug endpoint to check if API functions are working
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'API functions are working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    availableEndpoints: [
      '/api/test',
      '/api/config', 
      '/api/status',
      '/api/heartbeat',
      '/api/purchase-tx',
      '/api/purchase-confirm',
      '/api/land-status',
      '/api/purchase-land',
      '/api/confirm-land-purchase'
    ]
  });
}