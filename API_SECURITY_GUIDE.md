# 🔒 API Security Implementation Guide

## 🛡️ **Security Measures to Implement**

### **1. Authentication & Authorization**
```javascript
// Add JWT token validation
import jwt from 'jsonwebtoken';

function validateToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('No token provided');
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded;
}

// Example secure endpoint
export default async function handler(req, res) {
  try {
    const user = validateToken(req);
    // Only proceed if authenticated
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### **2. Rate Limiting**
```javascript
// Implement per-user rate limits
const rateLimits = new Map();

function checkRateLimit(userAddress, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userLimits = rateLimits.get(userAddress) || { count: 0, resetTime: now + windowMs };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 1;
    userLimits.resetTime = now + windowMs;
  } else {
    userLimits.count++;
  }
  
  rateLimits.set(userAddress, userLimits);
  
  if (userLimits.count > maxRequests) {
    throw new Error('Rate limit exceeded');
  }
}
```

### **3. Input Validation & Sanitization**
```javascript
import Joi from 'joi';

const purchaseSchema = Joi.object({
  address: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
  pickaxeType: Joi.string().valid('silver', 'gold', 'diamond', 'netherite').required(),
  quantity: Joi.number().integer().min(1).max(100).required()
});

function validateInput(data, schema) {
  const { error, value } = schema.validate(data);
  if (error) throw new Error(`Validation error: ${error.details[0].message}`);
  return value;
}
```

### **4. Wallet Signature Verification**
```javascript
import nacl from 'tweetnacl';
import bs58 from 'bs58';

function verifyWalletSignature(message, signature, publicKey) {
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = bs58.decode(signature);
  const publicKeyBytes = bs58.decode(publicKey);
  
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}

// Require wallet signature for sensitive operations
export default async function handler(req, res) {
  const { address, signature, message, action } = req.body;
  
  if (!verifyWalletSignature(message, signature, address)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  
  // Proceed with authenticated action
}
```

### **5. Environment Security**
```javascript
// Secure environment variable handling
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'TREASURY_PRIVATE_KEY',
  'ADMIN_TOKEN'
];

// Check all required environment variables exist
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

// Mask sensitive data in logs
function maskSensitiveData(obj) {
  const masked = { ...obj };
  ['password', 'privateKey', 'secret'].forEach(key => {
    if (masked[key]) masked[key] = '***REDACTED***';
  });
  return masked;
}
```

### **6. Admin Panel Security**
```javascript
// Secure admin endpoints with multiple validation layers
export default async function handler(req, res) {
  // 1. Check admin token
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }
  
  // 2. Check IP whitelist (optional)
  const allowedIPs = process.env.ADMIN_IP_WHITELIST?.split(',') || [];
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'IP not whitelisted' });
  }
  
  // 3. Require additional signature for destructive operations
  if (req.body.action === 'DELETE_ALL_USERS') {
    const { adminSignature } = req.body;
    if (!adminSignature) {
      return res.status(400).json({ error: 'Admin signature required for destructive operations' });
    }
  }
  
  // Proceed with admin action
}
```

### **7. Database Security**
```javascript
// Use prepared statements to prevent SQL injection
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10, // Connection pool limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Safe database query with parameterized inputs
async function safeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Database error:', maskSensitiveData(error));
    throw error;
  } finally {
    client.release();
  }
}

// Example secure user lookup
async function getUser(address) {
  return await safeQuery(
    'SELECT * FROM users WHERE wallet_address = $1',
    [address]
  );
}
```

### **8. Monitoring & Logging**
```javascript
// Comprehensive logging for security monitoring
function logSecurityEvent(event, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: details.ip,
    userAgent: details.userAgent,
    userId: details.userId,
    action: details.action,
    success: details.success
  };
  
  console.log('SECURITY_LOG:', JSON.stringify(logEntry));
  
  // In production, send to external logging service
  // await sendToSecurityLog(logEntry);
}

// Log all API access attempts
export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    logSecurityEvent('API_ACCESS', {
      ip: req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      endpoint: req.url,
      method: req.method
    });
    
    // Your API logic here
    
    logSecurityEvent('API_SUCCESS', {
      endpoint: req.url,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    logSecurityEvent('API_ERROR', {
      endpoint: req.url,
      error: error.message,
      duration: Date.now() - startTime
    });
    
    throw error;
  }
}
```

## 🚨 **Immediate Security Actions Needed**

### **High Priority:**
1. **Add admin token validation** to all admin endpoints
2. **Implement rate limiting** on purchase/transaction endpoints  
3. **Add wallet signature verification** for all user actions
4. **Secure database connection** with connection pooling
5. **Add input validation** to all endpoints

### **Medium Priority:**
6. **Implement JWT authentication** for session management
7. **Add IP whitelisting** for admin endpoints
8. **Set up security logging** and monitoring
9. **Add CORS restrictions** for production

### **Low Priority:**
10. **Add API versioning** for future updates
11. **Implement request/response encryption** 
12. **Add API documentation** with security guidelines

## 💡 **Quick Implementation**

Most critical security can be added with these files:
- `middleware/auth.js` - Authentication middleware
- `middleware/rateLimit.js` - Rate limiting  
- `utils/validation.js` - Input validation
- `utils/security.js` - Security helpers

Would you like me to implement any of these security measures?