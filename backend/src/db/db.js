const mysql = require("mysql2/promise");
const logger = require("../utils/logger");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Admin123root",
  database: process.env.DB_DATABASE || "task_manager",
  waitForConnections: true,
  connectionLimit: 10,
});

pool
  .query("SELECT 1")
  .then(() => {
    logger.info({ module: "mysql" }, "MySQL pool ready");
  })
  .catch((err) => {
    logger.error({ err, module: "mysql" }, "MySQL pool connection failed");
  });

module.exports = pool;
