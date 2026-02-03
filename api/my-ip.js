// Simple endpoint to show your IP address
export default function handler(req, res) {
  const clientIp = (req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.headers['x-real-ip'] || 
                   req.socket?.remoteAddress || 'unknown').trim();
  
  res.json({
    yourIp: clientIp,
    allHeaders: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
    },
    message: 'Add this IP to ADMIN_ALLOWED_IPS in Vercel environment variables'
  });
}
