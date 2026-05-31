const redis = require("../redis/redis");
const { rateLimitKey } = require("../constants/redis.keys");
const {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
} = require("../constants/config");
const AppError = require("../utils/AppError");

const currentMinuteBucket = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`
  );
};

const rateLimitMiddleware = async (req, res, next) => {
  const apiKey = req.client.apiKey;
  const key = rateLimitKey(apiKey, currentMinuteBucket());

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }

  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
  res.setHeader(
    "X-RateLimit-Remaining",
    Math.max(RATE_LIMIT_MAX_REQUESTS - count, 0),
  );

  if (count > RATE_LIMIT_MAX_REQUESTS) {
    return next(
      new AppError("Rate limit exceeded. Max 10 tasks per minute.", 429),
    );
  }

  return next();
};

module.exports = rateLimitMiddleware;
