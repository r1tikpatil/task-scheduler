const pool = require("../db/db");
const AppError = require("../utils/AppError");

const API_KEY_HEADER = "x-api-key";

const authMiddleware = async (req, res, next) => {
  const apiKey = req.headers[API_KEY_HEADER];

  if (!apiKey) {
    return next(new AppError("Missing X-API-Key header", 401));
  }

  const [rows] = await pool.query(
    "SELECT api_key, client_name, is_active FROM api_clients WHERE api_key = ?",
    [apiKey],
  );

  if (rows.length === 0) {
    return next(new AppError("Invalid API key", 401));
  }

  if (!rows[0].is_active) {
    return next(new AppError("API key is inactive", 403));
  }

  req.client = {
    apiKey: rows[0].api_key,
    name: rows[0].client_name,
  };

  return next();
};

module.exports = authMiddleware;
