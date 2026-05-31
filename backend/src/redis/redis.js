const { createClient } = require("redis");
const logger = require("../utils/logger");

const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = process.env.REDIS_PORT || 6379;

const redis = createClient({
  url: `redis://${redisHost}:${redisPort}`,
});

redis.on("connect", () => {
  logger.info({ module: "redis", host: redisHost, port: redisPort }, "Redis connected");
});

redis.on("error", (err) => {
  logger.error({ err, module: "redis" }, "Redis client error");
});

module.exports = redis;
