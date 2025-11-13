# 🔄 User Data Migration Guide

## ⚠️ Issue: Lost User Data After Serverless Migration

When we migrated from the old server to serverless architecture, existing user data (land purchases, pickaxes, gold) was not transferred.

## 🛠️ Solution: Data Migration Endpoints

### **Option 1: Bulk Migration (If you have backup data)**

**Endpoint:** `/api/admin/migrate-users`

**Usage:**
```javascript
fetch('/api/admin/migrate-users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'change-me', // Your admin token
    users: {
      "WALLET_ADDRESS_1": {
        hasLand: true,
        landPurchaseDate: 1699123456,
        inventory: { silver: 2, gold: 1, diamond: 0, netherite: 0 },
        total_mining_power: 720,
        checkpoint_timestamp: 1699123456,
        last_checkpoint_gold: 50000,
        lastActivity: 1699123456
      },
      "WALLET_ADDRESS_2": {
        hasLand: true,
        landPurchaseDate: 1699223456,
        inventory: { silver: 5, gold: 3, diamond: 1, netherite: 0 },
        total_mining_power: 1860,
        checkpoint_timestamp: 1699223456,
        last_checkpoint_gold: 120000,
        lastActivity: 1699223456
      }
    }
  })
});
```

### **Option 2: Individual User Restoration**

**Endpoint:** `/api/admin/restore-user`

**Usage:**
```javascript
fetch('/api/admin/restore-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'change-me',
    wallet: 'USER_WALLET_ADDRESS',
    userData: {
      hasLand: true,
      landPurchaseDate: 1699123456,
      inventory: { silver: 2, gold: 1, diamond: 0, netherite: 0 },
      total_mining_power: 720,
      checkpoint_timestamp: 1699123456,
      last_checkpoint_gold: 50000,
      gold: 50000, // Current gold amount
      lastActivity: 1699123456
    }
  })
});
```

## 📝 **Quick Fix for Individual Users**

If users report lost data, you can manually restore them:

1. **Get their wallet address**
2. **Ask what they had:**
   - Did they buy land? ✅
   - How many pickaxes of each type?
   - Approximate gold amount?

3. **Restore using admin endpoint**

## 🚀 **Prevent Future Data Loss**

✅ Database is now properly configured  
✅ All new purchases save to Neon  
✅ Data persists across deployments  
✅ No more data loss issues  

## 💡 **For Users Experiencing Issues**

**Temporary Workaround:**
- Users can repurchase land (0.01 SOL)
- You can manually restore their inventory using admin endpoints
- Future purchases will persist properly

**Communication to Users:**
"We've upgraded to a more reliable database system. If you lost your previous progress, please contact support with your wallet address and we'll restore your data."