const { randomUUID } = require("crypto");
const pool = require("../db/db");
const { TASK_TYPE, TASK_STATUS } = require("../constants/enum");
const { mapTask } = require("../utils/task.mapper");
const workerEngine = require("./workerEngine.service");
const { publishFromTask } = require("./taskEvent.service");
const AppError = require("../utils/AppError");

const DEFAULT_SEED_COUNT = 55;
const MIN_SEED_COUNT = 50;
const MAX_SEED_COUNT = 200;

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const randomPriority = () => Math.floor(Math.random() * 5) + 1;

const buildSeedPayload = (index, type) => ({
  seed: true,
  index,
  source: "seed-script",
  detail: `Demo ${type} job #${index}`,
});

const seedTasks = async (count = DEFAULT_SEED_COUNT) => {
  if (count < MIN_SEED_COUNT || count > MAX_SEED_COUNT) {
    throw new AppError(
      `Seed count must be between ${MIN_SEED_COUNT} and ${MAX_SEED_COUNT}`,
      400,
    );
  }

  const [clients] = await pool.query(
    "SELECT api_key FROM api_clients WHERE is_active = TRUE",
  );

  if (clients.length === 0) {
    throw new AppError("No active API clients available for seeding", 500);
  }

  const types = Object.values(TASK_TYPE);
  const createdTasks = [];

  for (let index = 0; index < count; index += 1) {
    const id = randomUUID();
    const clientId = randomItem(clients).api_key;
    const type = randomItem(types);
    const priority = randomPriority();
    const payload = buildSeedPayload(index + 1, type);

    await pool.query(
      `INSERT INTO tasks (id, client_id, type, priority, payload, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, clientId, type, priority, JSON.stringify(payload), TASK_STATUS.QUEUED],
    );

    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.client_id,
         t.type,
         t.priority,
         t.payload,
         t.status,
         t.retries,
         t.error_message,
         t.worker_id,
         t.created_at,
         t.started_at,
         t.completed_at,
         t.updated_at
       FROM tasks t
       WHERE t.id = ?`,
      [id],
    );

    const task = mapTask(rows[0]);

    workerEngine.enqueue(task);
    await publishFromTask(task);
    createdTasks.push(task);
  }

  return {
    created: createdTasks.length,
    tasks: createdTasks,
  };
};

module.exports = {
  seedTasks,
  DEFAULT_SEED_COUNT,
  MIN_SEED_COUNT,
  MAX_SEED_COUNT,
};
