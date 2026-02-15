// Admin Utilities API - Secured Admin-Only Tools
// Dangerous operations that require authentication

import { sql, cache } from '../../database.js';
import crypto from 'crypto';
import { redisDel, redisScan, redisDelMany, isRedisEnabled } from '../../utils/redis.js';

// Token validation (same as give-rewards)
function validateSessionToken(token) {
  try {
    const [payloadBase64, signature] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
    const expectedSignature = crypto.createHmac('sha256', process.env.ADMIN_SALT || 'default-secret')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: 'Session expired' };
    }
    
    return { valid: true, username: payload.username, expiresAt: payload.expiresAt };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🔐 Verify admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', requireLogin: true });
    }

    const token = authHeader.substring(7);
    const validation = validateSessionToken(token);
    
    if (!validation.valid) {
      return res.status(401).json({ error: validation.error || 'Invalid session', requireLogin: true });
    }

    const adminUsername = validation.username;

    // Get the requested action
    const { action, confirmationCode } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    // 🔒 SECURITY: Require confirmation code for dangerous operations
    const expectedCode = `${action.toUpperCase()}_${new Date().toISOString().slice(0, 10)}`;
    
    if (confirmationCode !== expectedCode) {
      return res.status(400).json({ 
        error: 'Invalid confirmation code',
        hint: `Expected format: ${action.toUpperCase()}_YYYY-MM-DD`,
        example: expectedCode
      });
    }

    console.log(`⚠️  Admin ${adminUsername} executing: ${action}`);

    let result;

    switch (action) {
      // 1. Clear All Users
      case 'clear_all_users': {
        const users = await sql`SELECT COUNT(*) as count FROM users`;
        const userCount = users[0].count;
        
        // Delete related records first (foreign key constraints)
        console.log('Deleting related records...');
        await sql`DELETE FROM admin_logs WHERE target_user IS NOT NULL`;
        await sql`DELETE FROM admin_gifts`;
        await sql`DELETE FROM transactions`;
        await sql`DELETE FROM gold_sales`;
        await sql`DELETE FROM referral_visits`; // Must delete before netherite_challenges
        await sql`DELETE FROM referrals`;
        await sql`DELETE FROM netherite_challenges`;
        
        // Now delete users
        await sql`DELETE FROM users`;
        
        result = {
          action: 'Clear All Users',
          usersDeleted: userCount,
          relatedRecordsDeleted: true,
          message: `${userCount} users deleted from database (along with related records)`
        };
        break;
      }

      // 2. Clear Database (All Tables)
      case 'clear_database': {
        const tables = ['users', 'transactions', 'referrals', 'gold_sales', 'admin_gifts', 'netherite_challenges'];
        const results = {};
        
        for (const table of tables) {
          try {
            const count = await sql`SELECT COUNT(*) as count FROM ${sql(table)}`;
            await sql`DELETE FROM ${sql(table)}`;
            results[table] = count[0].count;
          } catch (err) {
            results[table] = `Error: ${err.message}`;
          }
        }
        
        result = {
          action: 'Clear Database',
          tablesCleared: results,
          message: 'Database cleared'
        };
        break;
      }

      // 3. Nuclear Clear (Complete Wipe + Reset Sequences)
      case 'nuclear_clear': {
        const tables = ['users', 'transactions', 'referrals', 'gold_sales', 'admin_gifts', 'netherite_challenges', 'admin_logs'];
        
        for (const table of tables) {
          try {
            await sql`TRUNCATE TABLE ${sql(table)} RESTART IDENTITY CASCADE`;
          } catch (err) {
            console.log(`Warning: Could not truncate ${table}: ${err.message}`);
          }
        }
        
        result = {
          action: 'Nuclear Clear',
          message: 'All tables truncated and sequences reset',
          warning: 'Complete data wipe performed'
        };
        break;
      }

      // 4. Force Clear (Specific Data)
      case 'force_clear': {
        const { targetTable, targetAddress } = req.body;
        
        if (!targetTable) {
          return res.status(400).json({ error: 'Target table required' });
        }
        
        if (targetAddress) {
          // Clear specific user
          await sql`DELETE FROM ${sql(targetTable)} WHERE address = ${targetAddress}`;
          result = {
            action: 'Force Clear',
            table: targetTable,
            target: targetAddress,
            message: `Cleared ${targetAddress} from ${targetTable}`
          };
        } else {
          // Clear entire table
          const count = await sql`SELECT COUNT(*) as count FROM ${sql(targetTable)}`;
          await sql`DELETE FROM ${sql(targetTable)}`;
          result = {
            action: 'Force Clear',
            table: targetTable,
            rowsDeleted: count[0].count,
            message: `Cleared all rows from ${targetTable}`
          };
        }
        break;
      }

      // 5. Clear Redis cache for a specific wallet
      case 'clear_redis_cache': {
        const { targetAddress } = req.body;
        if (!targetAddress) {
          return res.status(400).json({ error: 'targetAddress required' });
        }

        const cacheKey = `user_${targetAddress}`;

        // Clear memory cache
        cache.delete(cacheKey);

        // Clear Redis cache if enabled
        let redisCleared = false;
        if (isRedisEnabled()) {
          redisCleared = await redisDel(cacheKey);
        }

        result = {
          action: 'Clear Redis Cache',
          target: targetAddress,
          cacheKey,
          memoryCleared: true,
          redisEnabled: isRedisEnabled(),
          redisCleared,
          message: `Cleared cache key ${cacheKey}`
        };
        break;
      }

      // 6. Clear ALL Redis cache keys (user_*)
      case 'clear_redis_all_cache': {
        // Clear memory cache entirely
        cache.clear();

        let redisEnabled = isRedisEnabled();
        let totalKeysFound = 0;
        let totalKeysDeleted = 0;

        if (redisEnabled) {
          let cursor = 0;
          const MAX_KEYS = 10000; // safety cap

          do {
            const scanRes = await redisScan('user_*', cursor, 500);
            cursor = scanRes.cursor;
            const keys = scanRes.keys || [];

            totalKeysFound += keys.length;
            if (keys.length > 0) {
              totalKeysDeleted += await redisDelMany(keys);
            }

            if (totalKeysFound >= MAX_KEYS) {
              break;
            }
          } while (cursor !== 0);
        }

        result = {
          action: 'Clear ALL Redis Cache (user_*)',
          memoryCleared: true,
          redisEnabled,
          totalKeysFound,
          totalKeysDeleted,
          message: redisEnabled
            ? `Cleared ${totalKeysDeleted} Redis keys (pattern user_*) and memory cache`
            : 'Redis not enabled; cleared memory cache only'
        };
        break;
      }

      // 7. Retention cleanup (expired referral visits + old logs/transactions)
      case 'cleanup_retention': {
        const referralVisits = await sql`
          SELECT COUNT(*)::int as count FROM referral_visits
          WHERE expires_at IS NOT NULL AND expires_at < NOW()
        `.catch(() => [{ count: 0 }]);

        const adminLogs = await sql`
          SELECT COUNT(*)::int as count FROM admin_logs
          WHERE created_at < NOW() - INTERVAL '90 days'
        `.catch(() => [{ count: 0 }]);

        const transactions = await sql`
          SELECT COUNT(*)::int as count FROM transactions
          WHERE created_at < NOW() - INTERVAL '180 days'
        `.catch(() => [{ count: 0 }]);

        const goldSales = await sql`
          SELECT COUNT(*)::int as count FROM gold_sales
          WHERE status = 'completed'
            AND created_at < NOW() - INTERVAL '180 days'
        `.catch(() => [{ count: 0 }]);

        // Perform deletes (best-effort)
        const deletedReferralVisits = await sql`
          DELETE FROM referral_visits
          WHERE expires_at IS NOT NULL AND expires_at < NOW()
        `.catch(() => null);

        const deletedAdminLogs = await sql`
          DELETE FROM admin_logs
          WHERE created_at < NOW() - INTERVAL '90 days'
        `.catch(() => null);

        const deletedTransactions = await sql`
          DELETE FROM transactions
          WHERE created_at < NOW() - INTERVAL '180 days'
        `.catch(() => null);

        const deletedGoldSales = await sql`
          DELETE FROM gold_sales
          WHERE status = 'completed'
            AND created_at < NOW() - INTERVAL '180 days'
        `.catch(() => null);

        result = {
          action: 'Retention Cleanup',
          referralVisitsExpired: referralVisits[0].count,
          adminLogsOld: adminLogs[0].count,
          transactionsOld: transactions[0].count,
          goldSalesOldCompleted: goldSales[0].count,
          message: 'Retention cleanup executed (best effort)'
        };
        break;
      }

      // 8. Force Clear Land Ownership
      case 'force_clear_land': {
        await sql`
          UPDATE users 
          SET 
            has_land = false,
            land_plot_id = NULL,
            land_purchase_date = NULL
        `;
        
        result = {
          action: 'Force Clear Land',
          message: 'All land ownership cleared',
          note: 'Users keep their gold and pickaxes'
        };
        break;
      }

      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          validActions: ['clear_all_users', 'clear_database', 'nuclear_clear', 'force_clear', 'force_clear_land', 'clear_redis_cache', 'clear_redis_all_cache', 'cleanup_retention']
        });
    }

    // 📝 Log the admin action
    await sql`
      INSERT INTO admin_logs (
        admin_address,
        action,
        new_values,
        reason,
        ip_address
      ) VALUES (
        ${adminUsername},
        ${action},
        ${JSON.stringify(result)},
        'Admin utility operation',
        ${req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null}
      )
    `;

    console.log(`✅ Admin utility completed: ${action}`);

    return res.status(200).json({
      success: true,
      result: result,
      performedBy: adminUsername,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Admin utility error:', error);
    return res.status(500).json({
      error: 'Failed to execute admin utility',
      details: error.message
    });
  }
}
// Force redeploy Sun Jan  4 17:01:32 IST 2026
