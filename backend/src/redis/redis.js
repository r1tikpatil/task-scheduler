const { createClient } = require("redis");

const redisHost = process.env.REDIS_HOST || "redis";
const redisPort = process.env.REDIS_PORT || 6379;

const redis = createClient({
  url: `redis://${redisHost}:${redisPort}`,
});

redis.on("error", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      service: "redis",
      message: err.message,
    })
  );
});

module.exports = redis;
