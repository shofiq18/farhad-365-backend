import { redisClient } from "../config/redis.config";

export const cacheService = {
  /**
   * Get values from cache by key
   */
  async get(key: string): Promise<string | null> {
    try {
      if (redisClient.isOpen) {
        return await redisClient.get(key);
      }
    } catch (err: any) {
      console.warn(`Redis GET failed for key "${key}":`, err.message);
    }
    return null;
  },

  /**
   * Set value in cache with optional TTL in seconds
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (redisClient.isOpen) {
        if (ttlSeconds) {
          await redisClient.set(key, value, { EX: ttlSeconds });
        } else {
          await redisClient.set(key, value);
        }
      }
    } catch (err: any) {
      console.warn(`Redis SET failed for key "${key}":`, err.message);
    }
  },

  /**
   * Delete specific key from cache
   */
  async del(key: string): Promise<void> {
    try {
      if (redisClient.isOpen) {
        await redisClient.del(key);
      }
    } catch (err: any) {
      console.warn(`Redis DEL failed for key "${key}":`, err.message);
    }
  },

  /**
   * Delete keys matching specific pattern (e.g. products:*)
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      if (redisClient.isOpen) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    } catch (err: any) {
      console.warn(`Redis delPattern failed for pattern "${pattern}":`, err.message);
    }
  },
};

export default cacheService;
