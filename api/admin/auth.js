// Secure Admin Authentication API
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';

// Store sessions in memory (for serverless, use Redis in production)
// Note: In serverless, each function has its own memory, so we use JWT-like approach
const activeSessions = new Map();
const loginAttempts = new Map();

// Simple session store using timestamp validation
function createSessionToken(username) {
  const payload = {
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
  };
  // Encode session data in token
  return Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + 
         crypto.createHmac('sha256', process.env.ADMIN_SALT || 'default-secret')
           .update(JSON.stringify(payload))
           .digest('hex');
}

function validateSessionToken(token) {
  try {
    const [payloadBase64, signature] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', process.env.ADMIN_SALT || 'default-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // Check expiry
    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: 'Session expired' };
    }
    
    return { valid: true, username: payload.username, expiresAt: payload.expiresAt };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
}

// Configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
}, SESSION_CLEANUP_INTERVAL);

// Generate secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash password with salt (use bcrypt in production)
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

// Check if IP is locked out
function isLockedOut(ip) {
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const lockoutEnd = attempts.lastAttempt + LOCKOUT_DURATION;
    if (Date.now() < lockoutEnd) {
      return true;
    } else {
      // Lockout expired, reset
      loginAttempts.delete(ip);
      return false;
    }
  }
  return false;
}

// Record failed login attempt
function recordFailedAttempt(ip) {
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(ip, attempts);
}

// Reset login attempts on successful login
function resetAttempts(ip) {
  loginAttempts.delete(ip);
}

export default async function handler(req, res) {
  // Strict CORS - only allow your domain
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://your-game-domain.vercel.app',
    'http://localhost:3000' // For development
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP (works with Vercel)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.headers['x-real-ip'] || 
                   req.socket.remoteAddress;

  try {
    const { action, username, password, token } = req.body || {};

    // Handle login
    if (action === 'login') {
      // Check if locked out
      if (isLockedOut(clientIp)) {
        const attempts = loginAttempts.get(clientIp);
        const remainingTime = Math.ceil((attempts.lastAttempt + LOCKOUT_DURATION - Date.now()) / 60000);
        
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts. Try again in ${remainingTime} minutes.`,
          lockedOut: true
        });
      }

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password required'
        });
      }

      // Get admin credentials from environment
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
      const adminSalt = process.env.ADMIN_SALT;

      if (!adminUsername || !adminPasswordHash || !adminSalt) {
        console.error('❌ Admin credentials not configured in environment');
        return res.status(500).json({
          success: false,
          error: 'Admin system not configured'
        });
      }

      // Verify credentials
      const passwordHash = hashPassword(password, adminSalt);
      
      if (username !== adminUsername || passwordHash !== adminPasswordHash) {
        recordFailedAttempt(clientIp);
        
        const attempts = loginAttempts.get(clientIp);
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts.count;
        
        console.log(`❌ Failed login attempt from ${clientIp}, ${remainingAttempts} attempts remaining`);
        
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          remainingAttempts: Math.max(0, remainingAttempts)
        });
      }

      // Successful login - create session
      resetAttempts(clientIp);
      
      const sessionToken = createSessionToken(username);
      const expiresAt = Date.now() + SESSION_DURATION;

      console.log(`✅ Admin login successful from ${clientIp}`);

      return res.status(200).json({
        success: true,
        token: sessionToken,
        expiresAt,
        username
      });
    }

    // Handle logout
    if (action === 'logout') {
      console.log(`✅ Admin logout`);
      
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    }

    // Handle session verification
    if (action === 'verify') {
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided'
        });
      }

      const validation = validateSessionToken(token);
      
      if (!validation.valid) {
        return res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
      }

      return res.status(200).json({
        success: true,
        username: validation.username,
        expiresAt: validation.expiresAt
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('❌ Admin auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};
