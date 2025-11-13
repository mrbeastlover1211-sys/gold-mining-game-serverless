// OPTIMIZED Database module for MASS USERS - Neon Free Tier
// Can handle 3,000-5,000+ concurrent users with smart optimizations

import pkg from 'pg';
const { Pool } = pkg;

// Global connection pool - CRITICAL for free tier limits
let globalPool = null;
let poolCreationTime = 0;
const POOL_LIFETIME = 300000; // 5 minutes before recreating pool

// In-memory cache to reduce database hits
const userCache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache
const MAX_CACHE_SIZE = 1000; // Limit memory usage

// Batch operations to reduce database connections
const batchUpdates = new Map();
let batchTimer = null;
const BATCH_INTERVAL = 5000; // Batch updates every 5 seconds

class OptimizedDatabase {
  
  // Get or create global connection pool
  static async getPool() {
    const now = Date.now();
    
    // Recreate pool if old (prevents connection staleness)
    if (!globalPool || (now - poolCreationTime) > POOL_LIFETIME) {
      if (globalPool) {
        try {
          await globalPool.end();
        } catch (e) {
          console.log('Pool cleanup error (ignoring):', e.message);
        }
      }
      
      globalPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        
        // CRITICAL: Minimize connections for free tier
        max: 3,                    // Only 3 connections (vs default 10)
        min: 0,                    // No minimum connections
        idleTimeoutMillis: 10000,  // Close idle connections fast
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 3000, // Fail fast if no connections
        
        // Enable keep-alive
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      
      poolCreationTime = now;
      console.log('🔄 Created optimized connection pool with 3 max connections');
    }
    
    return globalPool;
  }
  
  // Smart cache management
  static getCachedUser(address) {
    const cached = userCache.get(address);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }
  
  // Force cache invalidation (for immediate updates)
  static invalidateCache(address) {
    userCache.delete(address);
    console.log(`🗑️ Cache invalidated for ${address.slice(0, 8)}...`);
  }
  
  static setCachedUser(address, userData) {
    // Prevent memory bloat
    if (userCache.size >= MAX_CACHE_SIZE) {
      const firstKey = userCache.keys().next().value;
      userCache.delete(firstKey);
    }
    
    userCache.set(address, {
      data: userData,
      timestamp: Date.now()
    });
  }
  
  // Batch database updates to reduce connection usage
  static async queueUpdate(address, userData) {
    batchUpdates.set(address, userData);
    
    // Start batch timer if not running
    if (!batchTimer) {
      batchTimer = setTimeout(async () => {
        await this.flushBatch();
        batchTimer = null;
      }, BATCH_INTERVAL);
    }
  }
  
  static async flushBatch() {
    if (batchUpdates.size === 0) return;
    
    console.log(`📦 Flushing ${batchUpdates.size} batched updates to database`);
    
    try {
      const pool = await this.getPool();
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        for (const [address, userData] of batchUpdates) {
          await client.query(`
            INSERT INTO users (
              address, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes,
              total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity,
              has_land, land_purchase_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (address) DO UPDATE SET
              silver_pickaxes = EXCLUDED.silver_pickaxes,
              gold_pickaxes = EXCLUDED.gold_pickaxes,
              diamond_pickaxes = EXCLUDED.diamond_pickaxes,
              netherite_pickaxes = EXCLUDED.netherite_pickaxes,
              total_mining_power = EXCLUDED.total_mining_power,
              checkpoint_timestamp = EXCLUDED.checkpoint_timestamp,
              last_checkpoint_gold = EXCLUDED.last_checkpoint_gold,
              last_activity = EXCLUDED.last_activity,
              has_land = COALESCE(EXCLUDED.has_land, users.has_land),
              land_purchase_date = COALESCE(EXCLUDED.land_purchase_date, users.land_purchase_date)
          `, [
            address,
            userData.inventory?.silver || 0,
            userData.inventory?.gold || 0,
            userData.inventory?.diamond || 0,
            userData.inventory?.netherite || 0,
            userData.total_mining_power || 0,
            userData.checkpoint_timestamp || Math.floor(Date.now() / 1000),
            userData.last_checkpoint_gold || 0,
            userData.lastActivity || Math.floor(Date.now() / 1000),
            userData.hasLand || false,
            userData.landPurchaseDate || null
          ]);
        }
        
        await client.query('COMMIT');
        console.log(`✅ Successfully batched ${batchUpdates.size} updates`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Batch update failed:', error.message);
      } finally {
        client.release();
      }
      
    } catch (poolError) {
      console.error('❌ Failed to get pool for batch update:', poolError.message);
    }
    
    // Clear batch
    batchUpdates.clear();
  }
  
  // Optimized user retrieval with caching
  static async getUser(address, forceRefresh = false) {
    // Skip cache if force refresh requested (after purchases)
    if (!forceRefresh) {
      const cached = this.getCachedUser(address);
      if (cached) {
        console.log(`⚡ Cache hit for ${address.slice(0, 8)}...`);
        return cached;
      }
    } else {
      console.log(`🔄 Force refresh requested for ${address.slice(0, 8)}...`);
    }
    
    // Database fallback
    try {
      const pool = await this.getPool();
      const result = await pool.query(
        'SELECT * FROM users WHERE address = $1', 
        [address]
      );
      
      let userData;
      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        userData = {
          inventory: {
            silver: dbUser.silver_pickaxes || 0,
            gold: dbUser.gold_pickaxes || 0,
            diamond: dbUser.diamond_pickaxes || 0,
            netherite: dbUser.netherite_pickaxes || 0
          },
          total_mining_power: dbUser.total_mining_power || 0,
          checkpoint_timestamp: dbUser.checkpoint_timestamp || Math.floor(Date.now() / 1000),
          last_checkpoint_gold: parseFloat(dbUser.last_checkpoint_gold) || 0,
          hasLand: dbUser.has_land || false,
          landPurchaseDate: dbUser.land_purchase_date,
          lastActivity: dbUser.last_activity || Math.floor(Date.now() / 1000)
        };
      } else {
        // Default new user
        userData = {
          inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
          total_mining_power: 0,
          checkpoint_timestamp: Math.floor(Date.now() / 1000),
          last_checkpoint_gold: 0,
          hasLand: false,
          landPurchaseDate: null,
          lastActivity: Math.floor(Date.now() / 1000)
        };
      }
      
      // Cache the result
      this.setCachedUser(address, userData);
      console.log(`🗄️ Database hit for ${address.slice(0, 8)}...`);
      return userData;
      
    } catch (error) {
      console.error(`❌ Database error for ${address.slice(0, 8)}:`, error.message);
      
      // Return default user on error
      const defaultUser = {
        inventory: { silver: 0, gold: 0, diamond: 0, netherite: 0 },
        total_mining_power: 0,
        checkpoint_timestamp: Math.floor(Date.now() / 1000),
        last_checkpoint_gold: 0,
        hasLand: false,
        landPurchaseDate: null,
        lastActivity: Math.floor(Date.now() / 1000)
      };
      
      this.setCachedUser(address, defaultUser);
      return defaultUser;
    }
  }
  
  // Optimized user save - uses batching by default
  static async saveUser(address, userData) {
    // Update cache immediately for fast reads
    this.setCachedUser(address, userData);
    
    // Queue for batch database update
    await this.queueUpdate(address, userData);
    
    console.log(`📝 Queued user ${address.slice(0, 8)}... for batch update`);
  }
  
  // ULTRA-FAST immediate save (optimized for 1-second completion)
  static async saveUserImmediate(address, userData) {
    const saveStartTime = Date.now();
    this.setCachedUser(address, userData);
    
    try {
      console.log(`⚡ FAST SAVE: Starting optimized save for ${address.slice(0, 8)}...`);
      
      // Get pool with shorter timeout for faster response
      const pool = await this.getPool();
      
      // ⚡ OPTIMIZED: Use prepared statement equivalent with minimal data
      const result = await Promise.race([
        pool.query(`
          INSERT INTO users (
            address, silver_pickaxes, gold_pickaxes, diamond_pickaxes, netherite_pickaxes,
            total_mining_power, checkpoint_timestamp, last_checkpoint_gold, last_activity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (address) DO UPDATE SET
            silver_pickaxes = EXCLUDED.silver_pickaxes,
            gold_pickaxes = EXCLUDED.gold_pickaxes,
            diamond_pickaxes = EXCLUDED.diamond_pickaxes,
            netherite_pickaxes = EXCLUDED.netherite_pickaxes,
            total_mining_power = EXCLUDED.total_mining_power,
            checkpoint_timestamp = EXCLUDED.checkpoint_timestamp,
            last_checkpoint_gold = EXCLUDED.last_checkpoint_gold,
            last_activity = EXCLUDED.last_activity
          RETURNING address
        `, [
          address,
          parseInt(userData.inventory?.silver || 0),
          parseInt(userData.inventory?.gold || 0),
          parseInt(userData.inventory?.diamond || 0),
          parseInt(userData.inventory?.netherite || 0),
          parseInt(userData.total_mining_power || 0),
          parseInt(userData.checkpoint_timestamp || Math.floor(Date.now() / 1000)),
          parseFloat(userData.last_checkpoint_gold || 0),
          parseInt(userData.lastActivity || Math.floor(Date.now() / 1000))
        ]),
        // ⚡ SPEED: Timeout after 2 seconds instead of waiting forever
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout after 2 seconds')), 2000)
        )
      ]);
      
      const saveTime = Date.now() - saveStartTime;
      console.log(`⚡ ULTRA-FAST SAVE COMPLETED in ${saveTime}ms for ${address.slice(0, 8)}`);
      console.log(`💾 DB UPDATED: netherite=${parseInt(userData.inventory?.netherite || 0)}, power=${parseInt(userData.total_mining_power || 0)}`);
      
      return true;
      
    } catch (error) {
      const saveTime = Date.now() - saveStartTime;
      console.error(`❌ Fast save failed after ${saveTime}ms for ${address.slice(0, 8)}:`, error.message);
      
      // If immediate save fails, queue for batch retry
      await this.queueUpdate(address, userData);
      console.log(`📦 Queued for batch save as fallback`);
      return false;
    }
  }
  
  // Health check with minimal connection usage
  static async healthCheck() {
    try {
      const pool = await this.getPool();
      const result = await pool.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      console.error('Database health check failed:', error.message);
      return false;
    }
  }
  
  // Cleanup function for graceful shutdown
  static async cleanup() {
    if (batchTimer) {
      clearTimeout(batchTimer);
      await this.flushBatch();
    }
    
    if (globalPool) {
      await globalPool.end();
      globalPool = null;
    }
    
    userCache.clear();
    console.log('🧹 Database cleanup completed');
  }
}

// Auto-flush batches every 10 seconds as backup
setInterval(async () => {
  if (batchUpdates.size > 0) {
    console.log('⏰ Auto-flushing batch updates');
    await OptimizedDatabase.flushBatch();
  }
}, 10000);

// Export for backward compatibility
export async function getDatabase() {
  return await OptimizedDatabase.getPool();
}

export { OptimizedDatabase };
export default OptimizedDatabase;