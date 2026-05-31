const parsePayload = (payload) => {
  if (payload == null) {
    return null;
  }

  if (typeof payload === "string") {
    return JSON.parse(payload);
  }

  return payload;
};

const mapTask = (row, progress = undefined) => {
  const task = {
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    priority: row.priority,
    payload: parsePayload(row.payload),
    status: row.status,
    retries: row.retries,
    errorMessage: row.error_message ?? null,
    workerId: row.worker_id ?? null,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at,
  };

  if (progress !== undefined) {
    task.progress = progress;
  }

  if (row.dlq_reason) {
    task.deadLetter = {
      reason: row.dlq_reason,
      retryCount: row.dlq_retry_count,
      failedAt: row.dlq_failed_at,
    };
  }

  return task;
};

module.exports = { mapTask, parsePayload };
