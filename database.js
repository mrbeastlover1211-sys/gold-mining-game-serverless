// Database module for Gold Mining Game
// Supports 100,000+ users with PostgreSQL/Supabase

import pkg from 'pg';
const { Pool } = pkg;

class UserDatabase {
  constructor() {
    // Initialize connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum 20 connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Connection timeout 10s
    });

    this.pool.on('connect', () => {
      console.log('✅ Connected to database');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });
  }

  // Get user data or create if doesn't exist
  async getUser(address) {
    try {
      console.log(`📊 Getting user: ${address.slice(0, 8)}...`);
      
      const result = await this.pool.query(
        'SELECT * FROM users WHERE address = $1',
        [address]
      );

      if (result.rows.length === 0) {
        // Create new user
        console.log(`🆕 Creating new user: ${address.slice(0, 8)}...`);
        return await this.createUser(address);
      }

      const user = result.rows[0];
      
      // Convert database format to application format
      return {
        address: user.address,
        total_mining_power: user.total_mining_power || 0,
        checkpoint_timestamp: user.checkpoint_timestamp || Math.floor(Date.now() / 1000),
        last_checkpoint_gold: parseFloat(user.last_checkpoint_gold) || 0,
        inventory: {
          silver: user.silver_pickaxes || 0,
          gold: user.gold_pickaxes || 0,
          diamond: user.diamond_pickaxes || 0,
          netherite: user.netherite_pickaxes || 0
        },
        hasLand: user.has_land || false,
        landPurchaseDate: user.land_purchase_date,
        lastActivity: user.last_activity || Math.floor(Date.now() / 1000),
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };

    } catch (error) {
      console.error('❌ Error getting user:', error);
      throw error;
    }
  }

  // Create new user
  async createUser(address, referredBy = null) {
    try {
      console.log(`🎮 Creating new user: ${address.slice(0, 8)}...`);
      
      const now = Math.floor(Date.now() / 1000);
      
      const result = await this.pool.query(`
        INSERT INTO users (
          address, 
          total_mining_power, 
          checkpoint_timestamp, 
          last_checkpoint_gold,
          silver_pickaxes,
          gold_pickaxes, 
          diamond_pickaxes, 
          netherite_pickaxes,
          has_land, 
          last_activity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (address) DO NOTHING
        RETURNING *
      `, [address, 0, now, 0, 0, 0, 0, 0, false, now]);

      // Handle referral if provided
      if (referredBy && result.rows.length > 0) {
        await this.createReferral(referredBy, address);
      }

      return await this.getUser(address);

    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }

  // Update user data
  async updateUser(address, data) {
    try {
      console.log(`💾 Updating user: ${address.slice(0, 8)}...`);

      const updates = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query
      if (data.total_mining_power !== undefined) {
        updates.push(`total_mining_power = $${paramCount++}`);
        values.push(data.total_mining_power);
      }
      if (data.checkpoint_timestamp !== undefined) {
        updates.push(`checkpoint_timestamp = $${paramCount++}`);
        values.push(data.checkpoint_timestamp);
      }
      if (data.last_checkpoint_gold !== undefined) {
        updates.push(`last_checkpoint_gold = $${paramCount++}`);
        values.push(data.last_checkpoint_gold);
      }
      if (data.inventory) {
        updates.push(`silver_pickaxes = $${paramCount++}`);
        values.push(data.inventory.silver || 0);
        updates.push(`gold_pickaxes = $${paramCount++}`);
        values.push(data.inventory.gold || 0);
        updates.push(`diamond_pickaxes = $${paramCount++}`);
        values.push(data.inventory.diamond || 0);
        updates.push(`netherite_pickaxes = $${paramCount++}`);
        values.push(data.inventory.netherite || 0);
      }
      if (data.hasLand !== undefined) {
        updates.push(`has_land = $${paramCount++}`);
        values.push(data.hasLand);
      }
      if (data.landPurchaseDate !== undefined) {
        updates.push(`land_purchase_date = $${paramCount++}`);
        values.push(data.landPurchaseDate);
      }
      
      // Always update last activity
      updates.push(`last_activity = $${paramCount++}`);
      values.push(Math.floor(Date.now() / 1000));

      values.push(address);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE address = $${paramCount}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('User not found for update');
      }

      console.log(`✅ User updated successfully: ${address.slice(0, 8)}...`);
      return result.rows[0];

    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  }

  // Calculate current gold from checkpoint
  calculateCurrentGold(user) {
    if (!user.checkpoint_timestamp || !user.total_mining_power) {
      return user.last_checkpoint_gold || 0;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCheckpoint = currentTime - user.checkpoint_timestamp;
    const goldPerSecond = user.total_mining_power / 60; // Convert per minute to per second
    const goldMined = goldPerSecond * timeSinceCheckpoint;

    return user.last_checkpoint_gold + goldMined;
  }

  // Create checkpoint when mining power changes
  async createCheckpoint(address, newMiningPower) {
    try {
      console.log(`📊 Creating checkpoint for: ${address.slice(0, 8)}...`);

      // Get current user data
      const user = await this.getUser(address);
      
      // Calculate current gold
      const currentGold = this.calculateCurrentGold(user);
      const now = Math.floor(Date.now() / 1000);

      // Update with new checkpoint
      await this.updateUser(address, {
        total_mining_power: newMiningPower,
        checkpoint_timestamp: now,
        last_checkpoint_gold: currentGold
      });

      console.log(`✅ Checkpoint created - Gold: ${currentGold.toFixed(2)}, Power: ${newMiningPower}/min`);
      
      return currentGold;

    } catch (error) {
      console.error('❌ Error creating checkpoint:', error);
      throw error;
    }
  }

  // Record transaction
  async recordTransaction(data) {
    try {
      const result = await this.pool.query(`
        INSERT INTO transactions (
          user_address, 
          transaction_type, 
          item_type, 
          quantity, 
          sol_amount, 
          gold_amount, 
          signature, 
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        data.userAddress,
        data.transactionType,
        data.itemType || null,
        data.quantity || 1,
        data.solAmount || null,
        data.goldAmount || null,
        data.signature || null,
        data.status || 'confirmed'
      ]);

      console.log(`📋 Transaction recorded: ${data.transactionType} for ${data.userAddress.slice(0, 8)}...`);
      return result.rows[0];

    } catch (error) {
      console.error('❌ Error recording transaction:', error);
      throw error;
    }
  }

  // Create referral relationship
  async createReferral(referrerAddress, referredAddress) {
    try {
      const result = await this.pool.query(`
        INSERT INTO referrals (referrer_address, referred_address)
        VALUES ($1, $2)
        ON CONFLICT (referred_address) DO NOTHING
        RETURNING *
      `, [referrerAddress, referredAddress]);

      if (result.rows.length > 0) {
        console.log(`👥 Referral created: ${referrerAddress.slice(0, 8)} → ${referredAddress.slice(0, 8)}`);
        
        // TODO: Award referral rewards to referrer
        // await this.awardReferralRewards(referrerAddress);
      }

      return result.rows[0];

    } catch (error) {
      console.error('❌ Error creating referral:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats() {
    try {
      const result = await this.pool.query('SELECT * FROM user_stats');
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      throw error;
    }
  }

  // Get active miners
  async getActiveMiners(limit = 50) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM active_miners ORDER BY total_mining_power DESC LIMIT $1',
        [limit]
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting active miners:', error);
      throw error;
    }
  }

  // Close database connection
  async close() {
    await this.pool.end();
    console.log('🔌 Database connection closed');
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return { healthy: true, timestamp: result.rows[0].now };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new UserDatabase();