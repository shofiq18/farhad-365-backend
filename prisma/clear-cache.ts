import { redisClient } from "../src/config/redis.config";

async function main() {
  console.log("Clearing redis cache for categories...");
  try {
    // Wait for connection
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.del("categories:tree");
    console.log("Success: deleted key 'categories:tree'");
  } catch (error) {
    console.error("Failed to delete key:", error);
  } finally {
    await redisClient.quit();
  }
}

main();
