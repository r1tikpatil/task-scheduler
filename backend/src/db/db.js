const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Admin123root",
  database: process.env.DB_DATABASE || "task_manager",
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
