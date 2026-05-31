const TASK_EVENTS_CHANNEL = "task-events";

const taskProgressKey = (taskId) => `task:progress:${taskId}`;
const taskCancelKey = (taskId) => `task:cancel:${taskId}`;
const rateLimitKey = (apiKey, minute) => `ratelimit:${apiKey}:${minute}`;

module.exports = {
  TASK_EVENTS_CHANNEL,
  taskProgressKey,
  taskCancelKey,
  rateLimitKey,
};
