const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const WORKER_POOL_SIZE = Number(process.env.WORKER_POOL_SIZE) || 4;
const MAX_TASK_RETRIES = 3;
const TASK_MIN_DURATION_MS = 5_000;
const TASK_MAX_DURATION_MS = 30_000;
const TASK_PROGRESS_STEPS = 10;

const SORTABLE_FIELDS = {
  created_at: "created_at",
  priority: "priority",
  updated_at: "updated_at",
  started_at: "started_at",
  completed_at: "completed_at",
};

module.exports = {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  WORKER_POOL_SIZE,
  MAX_TASK_RETRIES,
  TASK_MIN_DURATION_MS,
  TASK_MAX_DURATION_MS,
  TASK_PROGRESS_STEPS,
  SORTABLE_FIELDS,
};
