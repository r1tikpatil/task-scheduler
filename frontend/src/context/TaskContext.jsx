import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  cancelTask as cancelTaskApi,
  fetchTaskStats,
  fetchTasks,
  fetchWorkerStats,
  retryTask as retryTaskApi,
  seedTasks as seedTasksApi,
  submitTask as submitTaskApi,
} from "../api/tasks";
import { useTaskStream } from "../hooks/useTaskStream";
import { mergeTask } from "../utils/mergeTask";

const TaskContext = createContext(null);

export function TaskProvider({ children }) {
  const [tasksById, setTasksById] = useState({});
  const [stats, setStats] = useState(null);
  const [workerStats, setWorkerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const upsertTask = useCallback((task) => {
    const id = task?.taskId || task?.id;

    if (!id) {
      return;
    }

    setTasksById((current) => ({
      ...current,
      [id]: mergeTask(current[id], { ...task, id: task.id || task.taskId || id }),
    }));
  }, []);

  const refreshStats = useCallback(async () => {
    const [taskStats, workers] = await Promise.all([
      fetchTaskStats(),
      fetchWorkerStats(),
    ]);

    setStats(taskStats);
    setWorkerStats(workers);
  }, []);

  const refreshTasks = useCallback(async (query = { limit: 100, sort: "updated_at", order: "desc" }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchTasks(query);
      const next = {};

      result.data.forEach((task) => {
        next[task.id] = task;
      });

      setTasksById(next);
      await refreshStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refreshStats]);

  useTaskStream(
    useCallback(
      (event) => {
        upsertTask(event);
        refreshStats();
      },
      [upsertTask, refreshStats],
    ),
  );

  useEffect(() => {
    refreshTasks();
    const interval = setInterval(refreshStats, 5000);
    return () => clearInterval(interval);
  }, [refreshTasks, refreshStats]);

  const submitTask = useCallback(
    async (apiKey, payload) => {
      const task = await submitTaskApi(apiKey, payload);
      upsertTask(task);
      await refreshStats();
      return task;
    },
    [upsertTask, refreshStats],
  );

  const cancelTask = useCallback(
    async (taskId) => {
      const task = await cancelTaskApi(taskId);
      upsertTask(task);
      await refreshStats();
      return task;
    },
    [upsertTask, refreshStats],
  );

  const retryTask = useCallback(
    async (taskId) => {
      const task = await retryTaskApi(taskId);
      upsertTask(task);
      await refreshStats();
      return task;
    },
    [upsertTask, refreshStats],
  );

  const seedDemoTasks = useCallback(
    async (count = 55) => {
      const result = await seedTasksApi(count);
      await refreshTasks();
      return result;
    },
    [refreshTasks],
  );

  const tasks = useMemo(() => Object.values(tasksById), [tasksById]);

  const value = useMemo(
    () => ({
      tasks,
      tasksById,
      stats,
      workerStats,
      loading,
      error,
      refreshTasks,
      refreshStats,
      submitTask,
      cancelTask,
      retryTask,
      seedDemoTasks,
    }),
    [
      tasks,
      tasksById,
      stats,
      workerStats,
      loading,
      error,
      refreshTasks,
      refreshStats,
      submitTask,
      cancelTask,
      retryTask,
      seedDemoTasks,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);

  if (!context) {
    throw new Error("useTasks must be used within TaskProvider");
  }

  return context;
}
