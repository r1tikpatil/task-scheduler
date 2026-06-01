import { useEffect, useMemo, useState } from "react";
import { fetchTasks } from "../api/tasks";
import ProgressBar from "../components/ProgressBar";
import StatusBadge from "../components/StatusBadge";
import { API_CLIENTS, STATUS_LABELS, TASK_TYPES } from "../constants/enums";
import { useTasks } from "../context/TaskContext";
import { mergeTask } from "../utils/mergeTask";

const fieldClass =
  "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200";

const labelClass = "grid gap-1.5 text-sm";

const cardClass =
  "mb-4 rounded-2xl border border-gray-800 bg-gray-900 p-4";

const btnSecondary =
  "cursor-pointer rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50";

const btnPrimary =
  "cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const clientNameByKey = Object.fromEntries(
  API_CLIENTS.map((client) => [client.key, client.name]),
);

export default function TasksPage() {
  const { cancelTask, retryTask, tasksById } = useTasks();

  const [filters, setFilters] = useState({
    status: "",
    type: "",
    priority: "",
    search: "",
    page: 1,
    limit: 20,
  });
  const [listResult, setListResult] = useState({ data: [], pagination: {} });
  const [loading, setLoading] = useState(false);

  const loadTasks = async (nextFilters = filters) => {
    setLoading(true);

    try {
      const query = {
        page: nextFilters.page,
        limit: nextFilters.limit,
        sort: "created_at",
        order: "desc",
      };

      if (nextFilters.status) query.status = nextFilters.status;
      if (nextFilters.type) query.type = nextFilters.type;
      if (nextFilters.priority) query.priority = nextFilters.priority;

      setListResult(await fetchTasks(query));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const liveTasks = useMemo(() => {
    return (listResult.data || []).map((task) =>
      mergeTask(task, tasksById[task.id]),
    );
  }, [listResult.data, tasksById]);

  const filteredTasks = useMemo(() => {
    if (!filters.search.trim()) {
      return liveTasks;
    }

    const term = filters.search.trim().toLowerCase();

    return liveTasks.filter((task) => {
      const clientName = clientNameByKey[task.clientId] ?? "";

      return (
        task.id.toLowerCase().includes(term) ||
        task.type.toLowerCase().includes(term) ||
        task.clientId.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term)
      );
    });
  }, [liveTasks, filters.search]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    loadTasks(next);
  };

  const handleCancel = async (taskId) => {
    try {
      await cancelTask(taskId);
      await loadTasks(filters);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRetry = async (taskId) => {
    try {
      await retryTask(taskId);
      await loadTasks(filters);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold">All Tasks</h1>
        <p className="mt-1 text-sm text-slate-400">Browse, filter, cancel, and retry tasks</p>
      </div>

      <section className={cardClass}>
        <h2 className="mb-3 text-base font-semibold">Filters</h2>
        <form
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]"
          onSubmit={handleFilterSubmit}
        >
          <label className={labelClass}>
            Status
            <select
              className={fieldClass}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Type
            <select
              className={fieldClass}
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All</option>
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Priority
            <input
              className={fieldClass}
              type="number"
              min="1"
              max="5"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            />
          </label>

          <label className={labelClass}>
            Search
            <input
              className={fieldClass}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Task id, type, client"
            />
          </label>

          <button type="submit" className={btnSecondary}>
            Apply Filters
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Tasks</h2>
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-sm text-slate-400">
                <th className="border-b border-slate-800 px-2 py-3">ID</th>
                <th className="border-b border-slate-800 px-2 py-3">Type</th>
                <th className="border-b border-slate-800 px-2 py-3">Status</th>
                <th className="border-b border-slate-800 px-2 py-3">Priority</th>
                <th className="border-b border-slate-800 px-2 py-3">Client</th>
                <th className="border-b border-slate-800 px-2 py-3">Progress</th>
                <th className="border-b border-slate-800 px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-2 py-4 text-sm text-slate-400">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="border-b border-slate-800 px-2 py-3 font-mono text-sm">
                      {task.id.slice(0, 8)}...
                    </td>
                    <td className="border-b border-slate-800 px-2 py-3">{task.type}</td>
                    <td className="border-b border-slate-800 px-2 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="border-b border-slate-800 px-2 py-3">{task.priority}</td>
                    <td className="border-b border-slate-800 px-2 py-3 text-sm">
                      {clientNameByKey[task.clientId] ?? task.clientId.slice(-12)}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-3">
                      {task.status === "RUNNING" ? (
                        <ProgressBar value={task.progress ?? 0} />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="border-b border-slate-800 px-2 py-3">
                      <div className="flex gap-1.5">
                        {(task.status === "QUEUED" || task.status === "RUNNING") && (
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => handleCancel(task.id)}
                          >
                            Cancel
                          </button>
                        )}
                        {task.status === "DEAD_LETTER" && (
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => handleRetry(task.id)}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {listResult.pagination?.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={filters.page <= 1}
              onClick={() => {
                const next = { ...filters, page: filters.page - 1 };
                setFilters(next);
                loadTasks(next);
              }}
            >
              Previous
            </button>
            <span className="text-sm text-slate-300">
              Page {listResult.pagination.page} of {listResult.pagination.totalPages}
            </span>
            <button
              type="button"
              className={btnSecondary}
              disabled={filters.page >= listResult.pagination.totalPages}
              onClick={() => {
                const next = { ...filters, page: filters.page + 1 };
                setFilters(next);
                loadTasks(next);
              }}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
