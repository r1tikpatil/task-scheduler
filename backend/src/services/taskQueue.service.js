class TaskQueue {
  constructor({ maxRunningPerClient = 1 } = {}) {
    this.taskIds = new Set();
    this.taskLocation = new Map();
    this.clientQueues = new Map();
    this.activeClients = [];
    this.rrIndex = 0;

    this.totalSize = 0;
    this.runningByClient = null;

    this.maxRunningPerClient = maxRunningPerClient;
  }

  setRunningByClient(runningByClientMap) {
    this.runningByClient = runningByClientMap;
  }

  insertSortedByCreatedAt(queue, entry) {
    let lo = 0;
    let hi = queue.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (queue[mid].createdAt <= entry.createdAt) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    queue.splice(lo, 0, entry);
  }

  ensureClient(clientId) {
    let client = this.clientQueues.get(clientId);
    if (!client) {
      client = { queuesByPriority: new Map(), totalSize: 0 };
      this.clientQueues.set(clientId, client);
    }
    return client;
  }

  addClientToRingIfNeeded(clientId) {
    if (this.activeClients.includes(clientId)) return;
    this.activeClients.push(clientId);
  }

  dequeue() {
    if (this.totalSize === 0 || this.activeClients.length === 0) {
      return null;
    }

    const ringSize = this.activeClients.length;

    for (let step = 0; step < ringSize; step += 1) {
      const idx = (this.rrIndex + step) % ringSize;
      const clientId = this.activeClients[idx];
      const client = this.clientQueues.get(clientId);

      if (!client || client.totalSize === 0) {
        this.activeClients.splice(idx, 1);
        if (this.activeClients.length === 0) {
          this.rrIndex = 0;
          return null;
        }
        this.rrIndex = idx % this.activeClients.length;
        return this.dequeue();
      }

      const enforceCap = this.activeClients.length > 1 && this.maxRunningPerClient != null;
      const runningForClient = this.runningByClient?.get(clientId) ?? 0;
      if (enforceCap && runningForClient >= this.maxRunningPerClient) {
        continue;
      }

      let selectedPriority = null;
      let taskList = null;
      for (let p = 5; p >= 1; p -= 1) {
        const list = client.queuesByPriority.get(p);
        if (list && list.length > 0) {
          selectedPriority = p;
          taskList = list;
          break;
        }
      }

      if (!taskList || selectedPriority == null) {
        continue;
      }

      const entry = taskList.shift();
      if (!entry) continue;

      this.taskIds.delete(entry.id);
      this.taskLocation.delete(entry.id);
      client.totalSize -= 1;
      this.totalSize -= 1;

      if (client.totalSize === 0) {
        this.clientQueues.delete(clientId);
        this.activeClients.splice(idx, 1);
        if (this.activeClients.length === 0) {
          this.rrIndex = 0;
        } else {
          this.rrIndex = idx % this.activeClients.length;
        }
      } else {
        this.rrIndex = (idx + 1) % this.activeClients.length;
      }

      return entry.task;
    }

    return null;
  }

  enqueue(task) {
    if (this.taskIds.has(task.id)) {
      return false;
    }

    const clientId = task.clientId;
    const priority = Number(task.priority);
    const createdAt = new Date(task.createdAt).getTime();

    const client = this.ensureClient(clientId);
    const queuesByPriority = client.queuesByPriority;

    if (!queuesByPriority.has(priority)) {
      queuesByPriority.set(priority, []);
    }

    const beforeWasEmpty = client.totalSize === 0;
    const taskList = queuesByPriority.get(priority);
    const entry = { id: task.id, clientId, priority, createdAt, task };
    this.insertSortedByCreatedAt(taskList, entry);

    this.taskIds.add(task.id);
    this.taskLocation.set(task.id, { clientId, priority });

    client.totalSize += 1;
    this.totalSize += 1;

    if (beforeWasEmpty) {
      this.addClientToRingIfNeeded(clientId);
      if (this.activeClients.length === 1) {
        this.rrIndex = 0;
      }
    }

    return true;
  }

  remove(taskId) {
    if (!this.taskIds.has(taskId)) {
      return false;
    }

    const meta = this.taskLocation.get(taskId);
    if (!meta) {
      return false;
    }

    const { clientId, priority } = meta;
    const client = this.clientQueues.get(clientId);
    if (!client) {
      return false;
    }

    const taskList = client.queuesByPriority.get(priority);
    if (!taskList || taskList.length === 0) {
      return false;
    }

    const idx = taskList.findIndex((e) => e.id === taskId);
    if (idx === -1) {
      return false;
    }

    taskList.splice(idx, 1);
    client.totalSize -= 1;
    this.totalSize -= 1;

    this.taskIds.delete(taskId);
    this.taskLocation.delete(taskId);

    if (client.totalSize === 0) {
      this.clientQueues.delete(clientId);

      const clientIdx = this.activeClients.indexOf(clientId);
      if (clientIdx !== -1) {
        this.activeClients.splice(clientIdx, 1);
        if (this.activeClients.length === 0) {
          this.rrIndex = 0;
        } else if (clientIdx < this.rrIndex) {
          this.rrIndex -= 1;
        }

        if (this.rrIndex >= this.activeClients.length) {
          this.rrIndex = 0;
        }
      }
    }

    return true;
  }

  size() {
    return this.totalSize;
  }

  has(taskId) {
    return this.taskIds.has(taskId);
  }
}

module.exports = TaskQueue;
