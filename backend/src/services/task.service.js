const { randomUUID } = require("crypto");
const pool = require("../db/db");
const redis = require("../redis/redis");
const { TASK_STATUS } = require("../constants/enum");
const { taskProgressKey, taskCancelKey } = require("../constants/redis.keys");
const {
  SORTABLE_FIELDS,
} = require("../constants/config");
const AppError = require("../utils/AppError");
const { mapTask } = require("../utils/task.mapper");
const { publishFromTask } = require("./taskEvent.service");
const workerEngine = require("./workerEngine.service");

const TASK_SELECT = `
  SELECT
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
    t.updated_at,
    dl.reason AS dlq_reason,
    dl.retry_count AS dlq_retry_count,
    dl.failed_at AS dlq_failed_at
  FROM tasks t
  LEFT JOIN dead_letter_tasks dl ON dl.task_id = t.id
`;

const CANCELLABLE_STATUSES = new Set([TASK_STATUS.QUEUED, TASK_STATUS.RUNNING]);

const attachProgressToTasks = async (rows) => {
  const runningIds = rows
    .filter((row) => row.status === TASK_STATUS.RUNNING)
    .map((row) => row.id);

  if (runningIds.length === 0) {
    return rows.map((row) => mapTask(row));
  }

  const keys = runningIds.map(taskProgressKey);
  const progressValues = await redis.mGet(keys);

  const progressById = new Map(
    runningIds.map((id, index) => [
      id,
      progressValues[index] != null ? Number(progressValues[index]) : 0,
    ]),
  );

  return rows.map((row) => {
    const progress =
      row.status === TASK_STATUS.RUNNING
        ? (progressById.get(row.id) ?? 0)
        : undefined;

    return mapTask(row, progress);
  });
};

const createTask = async ({ clientId, type, priority, payload }) => {
  const id = randomUUID();

  await pool.query(
    `INSERT INTO tasks (id, client_id, type, priority, payload, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, clientId, type, priority, JSON.stringify(payload), TASK_STATUS.QUEUED],
  );

  const task = await getTaskById(id);

  if (!task) {
    throw new AppError("Failed to create task", 500);
  }

  await publishFromTask(task);

  workerEngine.enqueue(task);

  return task;
};

const getTaskById = async (taskId) => {
  const [rows] = await pool.query(`${TASK_SELECT} WHERE t.id = ?`, [taskId]);

  if (rows.length === 0) {
    return null;
  }

  const [task] = await attachProgressToTasks(rows);
  return task;
};

const listTasks = async (filters) => {
  const {
    status,
    type,
    priority,
    minPriority,
    maxPriority,
    clientId,
    from,
    to,
    page,
    limit,
    sort,
    order,
  } = filters;

  const offset = (page - 1) * limit;
  const sortColumn = SORTABLE_FIELDS[sort];
  const sortOrder = order === "asc" ? "ASC" : "DESC";

  const conditions = [];
  const params = [];

  const statuses = status
    ? status
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    : [];

  if (statuses.length > 0) {
    conditions.push(`t.status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
  }

  if (type) {
    conditions.push("t.type = ?");
    params.push(type);
  }

  if (priority != null) {
    conditions.push("t.priority = ?");
    params.push(priority);
  } else {
    if (minPriority != null) {
      conditions.push("t.priority >= ?");
      params.push(minPriority);
    }

    if (maxPriority != null) {
      conditions.push("t.priority <= ?");
      params.push(maxPriority);
    }
  }

  if (clientId) {
    conditions.push("t.client_id = ?");
    params.push(clientId);
  }

  if (from) {
    conditions.push("t.created_at >= ?");
    params.push(from);
  }

  if (to) {
    conditions.push("t.created_at <= ?");
    params.push(to);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countQuery = `SELECT COUNT(*) AS total FROM tasks t ${whereClause}`;
  const [countRows] = await pool.query(countQuery, params);
  const total = Number(countRows[0].total);

  const dataQuery = `
    ${TASK_SELECT}
    ${whereClause}
    ORDER BY t.${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(dataQuery, [...params, limit, offset]);
  const data = await attachProgressToTasks(rows);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

const cancelTask = async (taskId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, status FROM tasks WHERE id = ? FOR UPDATE",
      [taskId],
    );

    if (rows.length === 0) {
      throw new AppError("Task not found", 404);
    }

    const { status } = rows[0];

    if (status === TASK_STATUS.CANCELLED) {
      await connection.commit();
      const task = await getTaskById(taskId);
      await publishFromTask(task);
      return task;
    }

    if (!CANCELLABLE_STATUSES.has(status)) {
      throw new AppError(`Cannot cancel task with status ${status}`, 409);
    }

    if (status === TASK_STATUS.QUEUED) {
      workerEngine.removeFromQueue(taskId);
    }

    await connection.query(
      `UPDATE tasks
       SET status = ?, completed_at = CURRENT_TIMESTAMP, worker_id = NULL
       WHERE id = ?`,
      [TASK_STATUS.CANCELLED, taskId],
    );

    await connection.commit();

    await Promise.all([
      redis.del(taskProgressKey(taskId)),
      status === TASK_STATUS.RUNNING
        ? redis.set(taskCancelKey(taskId), "1", { EX: 3600 })
        : Promise.resolve(),
    ]);

    if (status === TASK_STATUS.RUNNING) {
      workerEngine.requestCancel(taskId);
    }

    const task = await getTaskById(taskId);
    await publishFromTask(task);

    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const retryTask = async (taskId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, status FROM tasks WHERE id = ? FOR UPDATE",
      [taskId],
    );

    if (rows.length === 0) {
      throw new AppError("Task not found", 404);
    }

    if (rows[0].status !== TASK_STATUS.DEAD_LETTER) {
      throw new AppError("Task is not in dead letter queue", 409);
    }

    await connection.query(
      `UPDATE tasks
       SET status = ?, retries = 0, error_message = NULL, worker_id = NULL,
           started_at = NULL, completed_at = NULL
       WHERE id = ?`,
      [TASK_STATUS.QUEUED, taskId],
    );

    await connection.query("DELETE FROM dead_letter_tasks WHERE task_id = ?", [
      taskId,
    ]);

    await connection.commit();

    await redis.del(taskProgressKey(taskId));

    const task = await getTaskById(taskId);

    workerEngine.enqueue(task);
    await publishFromTask(task);

    return task;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getTaskStats = async () => {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM tasks GROUP BY status`,
  );

  const stats = Object.values(TASK_STATUS).reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  stats.total = 0;

  for (const row of rows) {
    stats[row.status] = Number(row.count);
    stats.total += Number(row.count);
  }

  return stats;
};

module.exports = {
  createTask,
  getTaskById,
  listTasks,
  cancelTask,
  retryTask,
  getTaskStats,
};
