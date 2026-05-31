const redis = require("../redis/redis");
const { TASK_EVENTS_CHANNEL, taskProgressKey } = require("../constants/redis.keys");
const { TASK_STATUS } = require("../constants/enum");

const buildTaskEvent = (task, progress = undefined) => {
  const event = {
    taskId: task.id,
    clientId: task.clientId,
    type: task.type,
    status: task.status,
    priority: task.priority,
    progress: progress ?? task.progress ?? null,
  };

  if (task.errorMessage) {
    event.errorMessage = task.errorMessage;
  }

  return event;
};

const publishTaskEvent = async (event) => {
  const payload = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  await redis.publish(TASK_EVENTS_CHANNEL, JSON.stringify(payload));

  return payload;
};

const publishFromTask = async (task, progress = undefined) => {
  return publishTaskEvent(buildTaskEvent(task, progress));
};

const publishProgress = async (task, progress) => {
  await redis.set(taskProgressKey(task.id), String(progress), { EX: 3600 });

  return publishTaskEvent(
    buildTaskEvent({ ...task, status: TASK_STATUS.RUNNING }, progress),
  );
};

module.exports = {
  buildTaskEvent,
  publishTaskEvent,
  publishFromTask,
  publishProgress,
};
