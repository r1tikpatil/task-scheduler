const taskService = require("../services/task.service");
const seedService = require("../services/seed.service");
const sseService = require("../services/sse.service");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const {
  validateSubmitTaskInput,
  validateListTasksQuery,
  validateTaskId,
  validateStreamTasksQuery,
} = require("../validators/task.schema");
const { validateSeedTasksInput } = require("../validators/analytics.schema");

const submitTask = asyncHandler(async (req, res) => {
  const validatedTask = validateSubmitTaskInput(req.body);

  const task = await taskService.createTask({
    clientId: req.client.apiKey,
    ...validatedTask,
  });

  req.log.info(
    {
      taskId: task.id,
      clientId: task.clientId,
      type: task.type,
      priority: task.priority,
    },
    "Task submitted",
  );

  res.status(201).json(task);
});

const listTasks = asyncHandler(async (req, res) => {
  const filters = validateListTasksQuery(req.query);

  const result = await taskService.listTasks(filters);

  res.json(result);
});

const getTaskStats = asyncHandler(async (req, res) => {
  const stats = await taskService.getTaskStats();

  res.json(stats);
});

const seedTasks = asyncHandler(async (req, res) => {
  if (process.env.SEED_ENABLED !== "true") {
    throw new AppError("Seed endpoint is disabled", 403);
  }

  const { count } = validateSeedTasksInput(req.body);
  const result = await seedService.seedTasks(count);

  req.log.info({ created: result.created }, "Seed tasks created");

  res.status(201).json({
    message: `Created ${result.created} demo tasks`,
    created: result.created,
  });
});

const getTaskById = asyncHandler(async (req, res) => {
  const taskId = validateTaskId(req.params.id);

  const task = await taskService.getTaskById(taskId);

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  res.json(task);
});

const cancelTask = asyncHandler(async (req, res) => {
  const taskId = validateTaskId(req.params.id);

  const task = await taskService.cancelTask(taskId);

  req.log.info({ taskId: task.id, status: task.status }, "Task cancelled");

  res.json(task);
});

const retryTask = asyncHandler(async (req, res) => {
  const taskId = validateTaskId(req.params.id);

  const task = await taskService.retryTask(taskId);

  req.log.info({ taskId: task.id, status: task.status }, "Task retried from DLQ");

  res.json(task);
});

const streamTasks = asyncHandler(async (req, res) => {
  const filters = validateStreamTasksQuery(req.query);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders();

  sseService.addClient(res, filters);

  req.log.debug({ filters }, "SSE stream opened");
});

module.exports = {
  submitTask,
  listTasks,
  getTaskStats,
  seedTasks,
  getTaskById,
  cancelTask,
  retryTask,
  streamTasks,
};
