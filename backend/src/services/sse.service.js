const { randomUUID } = require("crypto");
const redis = require("../redis/redis");
const logger = require("../utils/logger");
const { TASK_EVENTS_CHANNEL } = require("../constants/redis.keys");
const { TASK_STATUS } = require("../constants/enum");

const HEARTBEAT_MS = 30_000;

const STATUS_EVENT_MAP = {
  [TASK_STATUS.QUEUED]: "task.queued",
  [TASK_STATUS.RUNNING]: "task.running",
  [TASK_STATUS.COMPLETED]: "task.completed",
  [TASK_STATUS.FAILED]: "task.failed",
  [TASK_STATUS.CANCELLED]: "task.cancelled",
  [TASK_STATUS.DEAD_LETTER]: "task.dead_letter",
};

class SseService {
  constructor() {
    this.clients = new Map();
    this.subscriber = null;
    this.heartbeatTimer = null;
    this.started = false;
  }

  async start() {
    if (this.started) {
      return;
    }

    this.subscriber = redis.duplicate();
    await this.subscriber.connect();

    await this.subscriber.subscribe(TASK_EVENTS_CHANNEL, (message) => {
      try {
        const event = JSON.parse(message);
        this.broadcast(event);
      } catch (err) {
        logger.error({ err, module: "sse" }, "Failed to parse task event");
      }
    });

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_MS);

    this.started = true;
    logger.info({ module: "sse" }, "SSE service started");
  }

  addClient(res, filters = {}) {
    const clientId = randomUUID();

    this.clients.set(clientId, { res, filters });

    res.on("close", () => {
      this.clients.delete(clientId);
      logger.debug({ clientId, module: "sse" }, "SSE client disconnected");
    });

    this.writeEvent(res, "connected", {
      message: "SSE stream established",
      filters,
    });

    logger.debug({ clientId, filters, module: "sse" }, "SSE client connected");

    return clientId;
  }

  matchesFilters(event, filters) {
    if (filters.taskId && event.taskId !== filters.taskId) {
      return false;
    }

    if (filters.clientId && event.clientId !== filters.clientId) {
      return false;
    }

    if (filters.status) {
      const allowed = filters.status
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);

      if (allowed.length > 0 && !allowed.includes(event.status)) {
        return false;
      }
    }

    return true;
  }

  resolveEventName(event) {
    if (event.progress != null && event.status === TASK_STATUS.RUNNING) {
      return "task.progress";
    }

    return STATUS_EVENT_MAP[event.status] || "task.updated";
  }

  writeEvent(res, eventName, data) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  broadcast(event) {
    for (const client of this.clients.values()) {
      if (!this.matchesFilters(event, client.filters)) {
        continue;
      }

      try {
        this.writeEvent(client.res, this.resolveEventName(event), event);
      } catch (err) {
        logger.warn({ err, module: "sse" }, "Failed to write SSE event");
      }
    }
  }

  sendHeartbeat() {
    for (const [clientId, client] of this.clients.entries()) {
      try {
        this.writeEvent(client.res, "ping", {
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        this.clients.delete(clientId);
      }
    }
  }
}

module.exports = new SseService();
