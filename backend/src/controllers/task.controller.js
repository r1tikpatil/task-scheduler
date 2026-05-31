const taskService = require("../services/task.service");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const {
  validateSubmitTaskInput,
  validateListTasksQuery,
  validateTaskId,
} = require("../validators/task.schema");

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

module.exports = {
  submitTask,
  listTasks,
  getTaskById,
  cancelTask,
};
