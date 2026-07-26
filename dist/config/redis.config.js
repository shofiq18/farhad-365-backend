"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
exports.redisClient = (0, redis_1.createClient)({
    url: redisUrl,
    socket: {
        reconnectStrategy: (retries) => {
            // Allow up to 3 retries before failing permanently and falling back
            if (retries >= 3) {
                return new Error("Redis connection failed permanently. Falling back to direct database flow.");
            }
            // Retry after a 1-second delay
            return 1000;
        }
    }
});
exports.redisClient.on("error", (err) => {
    // Log error warning instead of hard crashing
    console.warn("Redis Client Connection Warning:", err.message);
});
exports.redisClient.on("connect", () => {
    console.log("Redis client connected successfully.");
});
// Handle initial connection asynchronously
(async () => {
    try {
        await exports.redisClient.connect();
    }
    catch (error) {
        console.warn("Could not establish initial connection with Redis, falling back to database query direct flow:", error.message);
    }
})();
exports.default = exports.redisClient;
