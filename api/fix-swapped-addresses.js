// DISABLED - Dangerous API
// This API has been disabled for security reasons
// Access only through admin utilities panel

export default async function handler(req, res) {
  return res.status(403).json({
    error: 'API Disabled',
    message: 'This API endpoint has been disabled for security reasons.',
    reason: 'Dangerous operation - requires admin authentication',
    alternative: 'Use /api/admin/utilities with proper authentication'
  });
}
