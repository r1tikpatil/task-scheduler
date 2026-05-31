const taskProgressKey = (taskId) => `task:progress:${taskId}`;
const taskCancelKey = (taskId) => `task:cancel:${taskId}`;
const rateLimitKey = (apiKey, minute) => `ratelimit:${apiKey}:${minute}`;

module.exports = {
  taskProgressKey,
  taskCancelKey,
  rateLimitKey,
};
