export function mergeTask(existing, incoming) {
  if (!incoming) {
    return existing;
  }

  if (!existing) {
    return { ...incoming, id: incoming.id || incoming.taskId };
  }

  const id = incoming.id || incoming.taskId || existing.id;

  return {
    ...existing,
    ...incoming,
    id,
    progress:
      incoming.progress !== undefined && incoming.progress !== null
        ? incoming.progress
        : existing.progress,
  };
}
