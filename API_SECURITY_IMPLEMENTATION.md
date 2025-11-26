# 🛡️ API Security Implementation Guide - Practical Steps

## 🚨 **Current Security Risks**

### **Your APIs Are Currently:**
❌ **Publicly accessible** - Anyone can call them  
❌ **No authentication** - No user verification  
❌ **No rate limiting** - Can be spammed/attacked  
❌ **No input validation** - Vulnerable to injection attacks  
❌ **Admin endpoints exposed** - Anyone can access admin functions  

## 🔒 **Step-by-Step Security Implementation**

### **PHASE 1: Immediate Protection (2-3 hours)**

#### **1. Add Basic API Key Authentication**
```javascript
// Create: middleware/auth.js
const API_KEYS = {
  'game-client': process.env.CLIENT_API_KEY,
  'admin': process.env.ADMIN_API_KEY
};

export function validateAPIKey(req) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !Object.values(API_KEYS).includes(apiKey)) {
    throw new Error('Invalid API key');
  }
  return true;
}

// Add to every API endpoint:
import { validateAPIKey } from '../middleware/auth.js';

export default async function handler(req, res) {
  try {
    validateAPIKey(req); // Add this line to every API
    // Your existing code here...
  } catch (error) {
    if (error.message === 'Invalid API key') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Handle other errors...
  }
}
```

#### **2. Update Frontend to Use API Key**
```javascript
// public/main.js - Add to all fetch calls
async function secureApiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_CLIENT_API_KEY', // Add this to .env
    ...options.headers
  };
  
  return fetch(endpoint, { ...options, headers });
}

// Replace all fetch calls with secureApiCall
// OLD: fetch('/api/status', {...})
// NEW: secureApiCall('/api/status', {...})
```

#### **3. Basic Rate Limiting**
```javascript
// Create: middleware/rateLimit.js
const rateLimits = new Map();

export function checkRateLimit(identifier, maxRequests = 60, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimits.has(identifier)) {
    rateLimits.set(identifier, []);
  }
  
  const requests = rateLimits.get(identifier);
  
  // Remove old requests outside the window
  while (requests.length > 0 && requests[0] < windowStart) {
    requests.shift();
  }
  
  if (requests.length >= maxRequests) {
    throw new Error('Rate limit exceeded');
  }
  
  requests.push(now);
  return true;
}

// Add to APIs:
import { checkRateLimit } from '../middleware/rateLimit.js';

export default async function handler(req, res) {
  try {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    checkRateLimit(clientIP, 30, 60000); // 30 requests per minute
    
    // Your existing code...
  } catch (error) {
    if (error.message === 'Rate limit exceeded') {
      return res.status(429).json({ error: 'Too many requests' });
    }
  }
}
```

### **PHASE 2: Wallet-Based Authentication (4-5 hours)**

#### **4. Solana Wallet Signature Verification**
```javascript
// Create: utils/walletAuth.js
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export function generateAuthMessage(address, timestamp) {
  return `Authenticate wallet ${address} at ${timestamp}`;
}

export function verifyWalletSignature(message, signature, publicKey) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    return false;
  }
}

// Updated auth middleware
export function validateWalletAuth(req) {
  const { address, signature, timestamp } = req.body;
  
  if (!address || !signature || !timestamp) {
    throw new Error('Missing authentication data');
  }
  
  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (now - requestTime > 300000) { // 5 minutes
    throw new Error('Authentication expired');
  }
  
  const message = generateAuthMessage(address, timestamp);
  if (!verifyWalletSignature(message, signature, address)) {
    throw new Error('Invalid wallet signature');
  }
  
  return address;
}
```

#### **5. Frontend Wallet Authentication**
```javascript
// public/main.js - Add signature generation
async function signAuthMessage(wallet, address) {
  const timestamp = Date.now();
  const message = `Authenticate wallet ${address} at ${timestamp}`;
  const encodedMessage = new TextEncoder().encode(message);
  
  const signature = await wallet.signMessage(encodedMessage, 'utf8');
  return {
    address,
    signature: bs58.encode(signature.signature),
    timestamp
  };
}

// Use in API calls for sensitive operations
async function authenticatedApiCall(endpoint, options = {}) {
  if (!state.wallet || !state.address) {
    throw new Error('Wallet not connected');
  }
  
  const authData = await signAuthMessage(state.wallet, state.address);
  
  return secureApiCall(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      ...options.body ? JSON.parse(options.body) : {},
      ...authData
    })
  });
}
```

### **PHASE 3: Advanced Security (6-8 hours)**

#### **6. Input Validation & Sanitization**
```javascript
// Create: middleware/validation.js
import Joi from 'joi';

export const schemas = {
  walletAddress: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  pickaxeType: Joi.string().valid('silver', 'gold', 'diamond', 'netherite'),
  quantity: Joi.number().integer().min(1).max(100),
  solanaSignature: Joi.string().length(88) // Base58 signature length
};

export function validateInput(data, schema) {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const details = error.details.map(d => d.message).join(', ');
    throw new Error(`Validation failed: ${details}`);
  }
  
  return value;
}

// Usage in APIs:
const purchaseSchema = Joi.object({
  address: schemas.walletAddress.required(),
  pickaxeType: schemas.pickaxeType.required(),
  quantity: schemas.quantity.required(),
  signature: schemas.solanaSignature.required(),
  timestamp: Joi.number().required()
});

export default async function handler(req, res) {
  try {
    const validatedData = validateInput(req.body, purchaseSchema);
    // Use validatedData instead of req.body
  } catch (error) {
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({ error: error.message });
    }
  }
}
```

#### **7. Admin Panel Security**
```javascript
// Secure admin endpoints
export default async function handler(req, res) {
  try {
    // 1. Check admin API key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ error: 'Admin access denied' });
    }
    
    // 2. Validate admin wallet signature
    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;
    const authAddress = validateWalletAuth(req);
    if (authAddress !== adminAddress) {
      return res.status(403).json({ error: 'Not authorized admin wallet' });
    }
    
    // 3. IP whitelist (optional)
    const clientIP = req.headers['x-forwarded-for'];
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      return res.status(403).json({ error: 'IP not whitelisted' });
    }
    
    // 4. Log admin actions
    console.log(`ADMIN_ACTION: ${req.url} by ${authAddress} from ${clientIP}`);
    
    // Admin action here...
  } catch (error) {
    return res.status(403).json({ error: 'Admin authentication failed' });
  }
}
```

### **PHASE 4: Monitoring & Logging (2-3 hours)**

#### **8. Security Event Logging**
```javascript
// Create: utils/securityLogger.js
export function logSecurityEvent(event, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: details.ip,
    userAgent: details.userAgent?.substring(0, 200),
    userId: details.userId,
    endpoint: details.endpoint,
    success: details.success,
    error: details.error
  };
  
  // Console log for development
  console.log('SECURITY_LOG:', JSON.stringify(logEntry));
  
  // TODO: Send to external logging service in production
  // await sendToLoggingService(logEntry);
}

// Add to all APIs:
import { logSecurityEvent } from '../utils/securityLogger.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    logSecurityEvent('API_REQUEST', {
      ip: req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      endpoint: req.url,
      method: req.method
    });
    
    // Your API logic...
    
    logSecurityEvent('API_SUCCESS', {
      endpoint: req.url,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    logSecurityEvent('API_ERROR', {
      endpoint: req.url,
      error: error.message,
      duration: Date.now() - startTime,
      success: false
    });
    
    throw error;
  }
}
```

## 🛡️ **Environment Variables Setup**

### **Add to .env:**
```env
# API Security Keys
CLIENT_API_KEY=your-secure-random-key-here
ADMIN_API_KEY=your-admin-key-here

# Admin Security
ADMIN_WALLET_ADDRESS=your-admin-wallet-address
ADMIN_ALLOWED_IPS=your.ip.address.here,another.ip.here

# Rate Limiting
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_WINDOW_MS=60000
```

## ⚡ **Quick Implementation Priority**

### **Week 1 (High Priority):**
1. ✅ Add API key authentication
2. ✅ Implement basic rate limiting  
3. ✅ Secure admin endpoints

### **Week 2 (Medium Priority):**
4. ✅ Add wallet signature verification
5. ✅ Input validation on all endpoints
6. ✅ Security event logging

### **Week 3 (Enhancement):**
7. ✅ Advanced rate limiting by user
8. ✅ Monitoring dashboard
9. ✅ Automated alerting

## 🚨 **Security Checklist**

### **Before Going Live:**
- [ ] All APIs require authentication
- [ ] Rate limiting implemented on all endpoints  
- [ ] Input validation on all user inputs
- [ ] Admin endpoints properly secured
- [ ] Security logging enabled
- [ ] Test all security measures
- [ ] Monitor for first week closely

## 💰 **Security Cost**

### **Implementation Time:**
- **Basic Security:** 2-3 hours
- **Full Security:** 10-15 hours total
- **Ongoing Monitoring:** 1 hour/week

### **No Additional Hosting Costs:**
All security measures run within your existing Vercel/Supabase limits.

## 🎯 **Bottom Line**

**Your APIs can be secured in 2-3 hours with basic protection, or 10-15 hours for enterprise-level security.**

**Start with Phase 1 (API keys + rate limiting) immediately - it's the biggest security improvement for the least effort!**

**Want me to implement any of these security measures for you right now?** 🔒⚡