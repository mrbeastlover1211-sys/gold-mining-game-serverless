// EMERGENCY: This API is permanently disabled
// Created to override Vercel's cached version

export default async function handler(req, res) {
  console.error('🚨 BLOCKED: Attempt to access disabled delete-referral-data API');
  console.error('IP:', req.headers['x-forwarded-for'] || 'unknown');
  console.error('Time:', new Date().toISOString());
  
  return res.status(403).json({
    error: 'FORBIDDEN',
    message: 'This API has been permanently disabled for security reasons',
    status: 403,
    blocked: true,
    timestamp: new Date().toISOString()
  });
}