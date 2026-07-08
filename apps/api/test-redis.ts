import { Redis } from "ioredis";
import * as dotenv from "dotenv";
dotenv.config();

async function testConnection() {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL not set");

    // Test 4: Default connection with NO explicit tls
    console.log("\\n--- Test 4: NO TLS ---");

    const redis4 = new Redis(redisUrl, {
      // No TLS configuration
      connectTimeout: 5000,
    });

    redis4.on("error", (err) => console.error("Redis 4 error:", err.message));
    redis4.on("ready", () => {
      console.log("Redis 4 ready! Successfully authenticated!");
      redis4.quit();
    });
  } catch (err) {
    console.error("Test failed", err);
  }
}

testConnection();
