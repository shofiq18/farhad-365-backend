import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = createClient({
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

redisClient.on("error", (err) => {
  // Log error warning instead of hard crashing
  console.warn("Redis Client Connection Warning:", err.message);
});

redisClient.on("connect", () => {
  console.log("Redis client connected successfully.");
});

// Handle initial connection asynchronously
(async () => {
  try {
    await redisClient.connect();
  } catch (error: any) {
    console.warn("Could not establish initial connection with Redis, falling back to database query direct flow:", error.message);
  }
})();

export default redisClient;
