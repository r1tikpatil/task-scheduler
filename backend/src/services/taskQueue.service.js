class TaskQueue {
  constructor() {
    this.items = [];
    this.taskIds = new Set();
    this.clientLastServed = new Map();
  }

  enqueue(task) {
    if (this.taskIds.has(task.id)) {
      return false;
    }

    this.taskIds.add(task.id);
    this.items.push({
      id: task.id,
      clientId: task.clientId,
      priority: task.priority,
      createdAt: new Date(task.createdAt).getTime(),
      task,
    });

    return true;
  }

  remove(taskId) {
    if (!this.taskIds.has(taskId)) {
      return false;
    }

    this.taskIds.delete(taskId);
    this.items = this.items.filter((item) => item.id !== taskId);

    return true;
  }

  dequeue() {
    if (this.items.length === 0) {
      return null;
    }

    this.items.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      const aServed = this.clientLastServed.get(a.clientId) ?? 0;
      const bServed = this.clientLastServed.get(b.clientId) ?? 0;

      if (aServed !== bServed) {
        return aServed - bServed;
      }

      return a.createdAt - b.createdAt;
    });

    const [next] = this.items.splice(0, 1);

    if (!next) {
      return null;
    }

    this.taskIds.delete(next.id);
    this.clientLastServed.set(next.clientId, Date.now());

    return next.task;
  }

  size() {
    return this.items.length;
  }

  has(taskId) {
    return this.taskIds.has(taskId);
  }
}

module.exports = TaskQueue;
