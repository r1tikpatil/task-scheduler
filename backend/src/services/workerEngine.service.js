const { Worker } = require("worker_threads");
const path = require("path");
const { randomUUID } = require("crypto");
const pool = require("../db/db");
const redis = require("../redis/redis");
const logger = require("../utils/logger");
const { TASK_STATUS } = require("../constants/enum");
const { taskProgressKey, taskCancelKey } = require("../constants/redis.keys");
const {
  WORKER_POOL_SIZE,
  MAX_RUNNING_PER_CLIENT,
  MAX_TASK_RETRIES,
  TASK_MIN_DURATION_MS,
  TASK_MAX_DURATION_MS,
  TASK_PROGRESS_STEPS,
} = require("../constants/config");
const { mapTask } = require("../utils/task.mapper");
const TaskQueue = require("./taskQueue.service");
const { publishFromTask, publishProgress } = require("./taskEvent.service");

const TASK_ROW_SELECT = `
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

const WORKER_SCRIPT = path.join(__dirname, "../workers/task.worker.js");

class WorkerEngine {
  constructor() {
    this.queue = new TaskQueue({ maxRunningPerClient: MAX_RUNNING_PER_CLIENT });
    this.runningTasks = new Map();
    this.runningByClient = new Map();
    this.pendingStarts = 0;
    this.poolSize = WORKER_POOL_SIZE;
    this.started = false;

    this.queue.setRunningByClient(this.runningByClient);
  }

  async start() {
    if (this.started) {
      return;
    }

    await this.recoverOrphanedTasks();
    await this.loadQueuedTasks();

    this.started = true;
    this.schedule();

    logger.info(
      { module: "worker-engine", poolSize: this.poolSize },
      "Worker engine started",
    );
  }

  enqueue(task) {
    if (task.status !== TASK_STATUS.QUEUED) {
      return;
    }

    this.queue.enqueue(task);
    this.schedule();
  }

  removeFromQueue(taskId) {
    return this.queue.remove(taskId);
  }

  requestCancel(taskId) {
    const entry = this.runningTasks.get(taskId);

    if (!entry) {
      return false;
    }

    entry.intentionalCancel = true;
    entry.worker.postMessage({ type: "CANCEL" });

    return true;
  }

  getStats() {
    const busyWorkers = this.runningTasks.size;

    return {
      poolSize: this.poolSize,
      busyWorkers,
      idleWorkers: Math.max(0, this.poolSize - busyWorkers),
      queuedTasks: this.queue.size(),
    };
  }

  activeWorkerSlots() {
    return this.runningTasks.size + this.pendingStarts;
  }

  schedule() {
    while (this.activeWorkerSlots() < this.poolSize) {
      const task = this.queue.dequeue();

      if (!task) {
        break;
      }

      this.runningByClient.set(
        task.clientId,
        (this.runningByClient.get(task.clientId) ?? 0) + 1,
      );

      this.pendingStarts += 1;

      this.startTask(task).catch((err) => {
        logger.error(
          { err, taskId: task.id, module: "worker-engine" },
          "Failed to start task",
        );
      });
    }
  }

  async loadQueuedTasks() {
    const [rows] = await pool.query(
      `${TASK_ROW_SELECT}
       WHERE t.status = ?
       ORDER BY t.priority DESC, t.created_at ASC`,
      [TASK_STATUS.QUEUED],
    );

    for (const row of rows) {
      this.queue.enqueue(mapTask(row));
    }

    logger.info(
      { module: "worker-engine", count: rows.length },
      "Loaded queued tasks",
    );
  }

  async recoverOrphanedTasks() {
    const [rows] = await pool.query(
      `${TASK_ROW_SELECT} WHERE t.status = ?`,
      [TASK_STATUS.RUNNING],
    );

    for (const row of rows) {
      const task = mapTask(row);

      await this.handleFailure(
        task,
        "Task was running when the worker engine restarted",
      );
    }

    if (rows.length > 0) {
      logger.warn(
        { module: "worker-engine", count: rows.length },
        "Recovered orphaned running tasks",
      );
    }
  }

  randomDurationMs() {
    return (
      TASK_MIN_DURATION_MS +
      Math.floor(Math.random() * (TASK_MAX_DURATION_MS - TASK_MIN_DURATION_MS + 1))
    );
  }

  async fetchTask(taskId) {
    const [rows] = await pool.query(`${TASK_ROW_SELECT} WHERE t.id = ?`, [
      taskId,
    ]);

    if (rows.length === 0) {
      return null;
    }

    return mapTask(rows[0]);
  }

  async startTask(task) {
    let released = false;
    try {
      const workerId = randomUUID();

      const [result] = await pool.query(
        `UPDATE tasks
         SET status = ?, started_at = CURRENT_TIMESTAMP, worker_id = ?, error_message = NULL
         WHERE id = ? AND status = ?`,
        [TASK_STATUS.RUNNING, workerId, task.id, TASK_STATUS.QUEUED],
      );

      if (result.affectedRows === 0) {
        const current = this.runningByClient.get(task.clientId) ?? 0;
        if (current <= 1) this.runningByClient.delete(task.clientId);
        else this.runningByClient.set(task.clientId, current - 1);
        released = true;
        return;
      }

      const runningTask = await this.fetchTask(task.id);

      if (!runningTask) {
        const current = this.runningByClient.get(task.clientId) ?? 0;
        if (current <= 1) this.runningByClient.delete(task.clientId);
        else this.runningByClient.set(task.clientId, current - 1);
        released = true;
        return;
      }

      await publishFromTask(runningTask, 0);
      await redis.set(taskProgressKey(task.id), "0", { EX: 3600 });

      const payload = runningTask.payload ?? {};
      const simulateFailure = Boolean(payload.simulateFailure);
      const failAfterStep = Number.isInteger(payload.failAfterStep)
        ? payload.failAfterStep
        : Math.ceil(TASK_PROGRESS_STEPS / 2);

      const worker = new Worker(WORKER_SCRIPT, {
        workerData: {
          taskId: task.id,
          durationMs: this.randomDurationMs(),
          progressSteps: TASK_PROGRESS_STEPS,
          simulateFailure,
          failAfterStep,
        },
      });

      const entry = {
        worker,
        workerId,
        task: runningTask,
        intentionalCancel: false,
      };

      this.runningTasks.set(task.id, entry);

      worker.on("message", (message) => {
        this.handleWorkerMessage(task.id, message).catch((err) => {
          logger.error(
            { err, taskId: task.id, module: "worker-engine" },
            "Worker message handler failed",
          );
        });
      });

      worker.on("error", (err) => {
        logger.error(
          { err, taskId: task.id, module: "worker-engine" },
          "Worker thread error",
        );
      });

      worker.on("exit", (code) => {
        this.handleWorkerExit(task.id, code).catch((err) => {
          logger.error(
            { err, taskId: task.id, module: "worker-engine" },
            "Worker exit handler failed",
          );
        });
      });
    } finally {
      this.pendingStarts = Math.max(0, this.pendingStarts - 1);
      if (!released && !this.runningTasks.has(task.id)) {
        const current = this.runningByClient.get(task.clientId) ?? 0;
        if (current <= 1) this.runningByClient.delete(task.clientId);
        else this.runningByClient.set(task.clientId, current - 1);
      }
      this.schedule();
    }
  }

  async handleWorkerMessage(taskId, message) {
    const entry = this.runningTasks.get(taskId);

    if (!entry) {
      return;
    }

    switch (message.type) {
      case "PROGRESS":
        await publishProgress(entry.task, message.progress);
        break;

      case "COMPLETED":
        await this.handleCompleted(taskId);
        break;

      case "CANCELLED":
        await this.handleCancelled(taskId);
        break;

      case "FAILED":
        await this.handleFailure(
          entry.task,
          message.error || "Worker reported task failure",
        );
        break;

      default:
        break;
    }
  }

  async handleCompleted(taskId) {
    if (!this.runningTasks.has(taskId)) {
      return;
    }

    const [result] = await pool.query(
      `UPDATE tasks
       SET status = ?, completed_at = CURRENT_TIMESTAMP, worker_id = NULL
       WHERE id = ? AND status = ?`,
      [TASK_STATUS.COMPLETED, taskId, TASK_STATUS.RUNNING],
    );

    if (result.affectedRows > 0) {
      await redis.del(taskProgressKey(taskId));

      const task = await this.fetchTask(taskId);

      if (task) {
        await publishFromTask(task, 100);
      }
    }

    await this.cleanupWorker(taskId);
    this.schedule();
  }

  async handleCancelled(taskId) {
    if (!this.runningTasks.has(taskId)) {
      return;
    }

    await redis.del(taskProgressKey(taskId));
    await redis.del(taskCancelKey(taskId));

    await this.cleanupWorker(taskId);
    this.schedule();
  }

  async handleWorkerExit(taskId, code) {
    const entry = this.runningTasks.get(taskId);

    if (!entry) {
      return;
    }

    if (entry.intentionalCancel) {
      await this.handleCancelled(taskId);
      return;
    }

    if (code === 0) {
      if (entry) {
        await this.cleanupWorker(taskId);
        this.schedule();
      }
      return;
    }

    const latestTask = await this.fetchTask(taskId);

    if (!latestTask || latestTask.status !== TASK_STATUS.RUNNING) {
      await this.cleanupWorker(taskId);
      this.schedule();
      return;
    }

    await this.handleFailure(
      latestTask,
      `Worker crashed with exit code ${code}`,
    );
  }

  async handleFailure(task, reason) {
    if (this.runningTasks.has(task.id)) {
      await this.cleanupWorker(task.id);
    }

    const latestTask = await this.fetchTask(task.id);

    if (!latestTask) {
      this.schedule();
      return;
    }

    const nextRetries = latestTask.retries + 1;

    if (nextRetries >= MAX_TASK_RETRIES) {
      await this.moveToDeadLetter(latestTask.id, reason, nextRetries);
    } else {
      await pool.query(
        `UPDATE tasks
         SET status = ?, retries = ?, error_message = ?, worker_id = NULL,
             started_at = NULL, completed_at = NULL
         WHERE id = ? AND status IN (?, ?)`,
        [
          TASK_STATUS.QUEUED,
          nextRetries,
          reason,
          latestTask.id,
          TASK_STATUS.RUNNING,
          TASK_STATUS.QUEUED,
        ],
      );

      await redis.del(taskProgressKey(latestTask.id));

      const requeuedTask = await this.fetchTask(latestTask.id);

      if (requeuedTask && requeuedTask.status === TASK_STATUS.QUEUED) {
        this.queue.enqueue(requeuedTask);
        await publishFromTask(requeuedTask);
      }
    }

    this.schedule();
  }

  async moveToDeadLetter(taskId, reason, retryCount) {
    await pool.query(
      `UPDATE tasks
       SET status = ?, error_message = ?, worker_id = NULL, completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN (?, ?)`,
      [
        TASK_STATUS.DEAD_LETTER,
        reason,
        taskId,
        TASK_STATUS.RUNNING,
        TASK_STATUS.QUEUED,
      ],
    );

    await pool.query(
      `INSERT INTO dead_letter_tasks (task_id, reason, retry_count)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), retry_count = VALUES(retry_count), failed_at = CURRENT_TIMESTAMP`,
      [taskId, reason, retryCount],
    );

    await redis.del(taskProgressKey(taskId));

    const task = await this.fetchTask(taskId);

    if (task) {
      await publishFromTask(task);
    }
  }

  async cleanupWorker(taskId) {
    const entry = this.runningTasks.get(taskId);
    if (entry?.task?.clientId) {
      const clientId = entry.task.clientId;
      const current = this.runningByClient.get(clientId) ?? 0;
      if (current <= 1) this.runningByClient.delete(clientId);
      else this.runningByClient.set(clientId, current - 1);
    }

    this.runningTasks.delete(taskId);
  }
}

module.exports = new WorkerEngine();
