// Redis utility (Upstash Redis REST)
// Safe for Vercel serverless/edge-like environments.
// If env vars are not set, all helpers become no-ops.

import { Redis } from '@upstash/redis';

let redisClient = null;

function getRedisClient() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function isRedisEnabled() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function redisGetJson(key) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    return value ?? null;
  } catch (err) {
    console.warn('⚠️ Redis GET failed:', err?.message || err);
    return null;
  }
}

export async function redisSetJson(key, value, ttlSeconds = null) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    if (ttlSeconds && Number.isFinite(ttlSeconds)) {
      await client.set(key, value, { ex: ttlSeconds });
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn('⚠️ Redis SET failed:', err?.message || err);
    return false;
  }
}

export async function redisDel(key) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.warn('⚠️ Redis DEL failed:', err?.message || err);
    return false;
  }
}
