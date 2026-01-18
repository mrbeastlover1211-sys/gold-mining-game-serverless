// Simple test endpoint to check if serverless functions work
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Serverless function working!', 
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}