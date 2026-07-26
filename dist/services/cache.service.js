"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const redis_config_1 = require("../config/redis.config");
exports.cacheService = {
    /**
     * Get values from cache by key
     */
    async get(key) {
        try {
            if (redis_config_1.redisClient.isOpen) {
                return await redis_config_1.redisClient.get(key);
            }
        }
        catch (err) {
            console.warn(`Redis GET failed for key "${key}":`, err.message);
        }
        return null;
    },
    /**
     * Set value in cache with optional TTL in seconds
     */
    async set(key, value, ttlSeconds) {
        try {
            if (redis_config_1.redisClient.isOpen) {
                if (ttlSeconds) {
                    await redis_config_1.redisClient.set(key, value, { EX: ttlSeconds });
                }
                else {
                    await redis_config_1.redisClient.set(key, value);
                }
            }
        }
        catch (err) {
            console.warn(`Redis SET failed for key "${key}":`, err.message);
        }
    },
    /**
     * Delete specific key from cache
     */
    async del(key) {
        try {
            if (redis_config_1.redisClient.isOpen) {
                await redis_config_1.redisClient.del(key);
            }
        }
        catch (err) {
            console.warn(`Redis DEL failed for key "${key}":`, err.message);
        }
    },
    /**
     * Delete keys matching specific pattern (e.g. products:*)
     */
    async delPattern(pattern) {
        try {
            if (redis_config_1.redisClient.isOpen) {
                const keys = await redis_config_1.redisClient.keys(pattern);
                if (keys.length > 0) {
                    await redis_config_1.redisClient.del(keys);
                }
            }
        }
        catch (err) {
            console.warn(`Redis delPattern failed for pattern "${pattern}":`, err.message);
        }
    },
};
exports.default = exports.cacheService;
