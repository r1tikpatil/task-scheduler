export const TASK_STATUS = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  DEAD_LETTER: "DEAD_LETTER",
};

export const TASK_TYPES = [
  "IMAGE_PROCESSING",
  "REPORT_GENERATION",
  "DATA_IMPORT",
  "EMAIL_NOTIFICATION",
  "FILE_CONVERSION",
];

export const API_CLIENTS = [
  { key: "ak_client_alpha_001", name: "Alpha Corp" },
  { key: "ak_client_beta_002", name: "Beta Analytics" },
  { key: "ak_client_gamma_003", name: "Gamma Labs" },
  { key: "ak_client_delta_004", name: "Delta Systems" },
  { key: "ak_client_epsilon_005", name: "Epsilon Media" },
];

export const DASHBOARD_PROGRESS_STATUSES = ["RUNNING", "QUEUED"];

export const DASHBOARD_STATUSES = [
  "RUNNING",
  "QUEUED",
  "COMPLETED",
  "FAILED",
  "DEAD_LETTER",
];

export const STATUS_LABELS = {
  QUEUED: "Queued",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  DEAD_LETTER: "Dead Letter",
};

export const SSE_EVENTS = [
  "task.queued",
  "task.running",
  "task.progress",
  "task.completed",
  "task.failed",
  "task.cancelled",
  "task.dead_letter",
  "task.updated",
];
