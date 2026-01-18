// Most basic possible Vercel serverless function
// Using old-school function syntax for maximum compatibility

exports.default = function(req, res) {
  res.status(200).json({ 
    message: 'Hello World',
    method: req.method,
    timestamp: Date.now()
  });
};