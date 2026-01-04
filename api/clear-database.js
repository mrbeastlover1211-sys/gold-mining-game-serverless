// This API has been permanently removed for security reasons
// Use /api/admin/utilities with proper authentication instead

export default async function handler(req, res) {
  return res.status(410).json({
    error: 'API Permanently Removed',
    message: 'This dangerous API endpoint has been permanently deleted for security reasons.',
    status: 410,
    reason: 'Security risk - this operation wipes the entire database',
    alternative: 'Login to admin panel and use /api/admin/utilities with proper authentication',
    documentation: 'This endpoint was removed on January 4, 2026 for security compliance'
  });
}
