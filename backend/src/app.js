const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const pool = require("./db/db");
const redis = require("./redis/redis");
const logger = require("./utils/logger");
const AppError = require("./utils/AppError");
const taskRoutes = require("./routes/task.routes");

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage(req, res, err) {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
  }),
);

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();

    return res.json({
      status: "ok",
      mysql: "up",
      redis: "up",
    });
  } catch (err) {
    req.log.error({ err }, "Health check failed");

    return res.status(503).json({
      status: "error",
      message: err.message,
    });
  }
});

app.use("/api/tasks", taskRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message =
    err.isOperational ? err.message : "Internal server error";

  if (statusCode >= 500) {
    req.log.error({ err }, "Unhandled request error");
  } else {
    req.log.warn({ err, statusCode }, message);
  }

  res.status(statusCode).json({
    status: "error",
    message,
  });
});

async function start() {
  await redis.connect();

  app.listen(PORT, () => {
    logger.info({ port: PORT }, "Server started");
  });
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start application");
  process.exit(1);
});
