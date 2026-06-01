import { useMemo } from "react";
import { DASHBOARD_PROGRESS_STATUSES, STATUS_LABELS } from "../constants/enums";
import { useTasks } from "../context/TaskContext";
import WorkerStatsCard, { StatusGroup } from "../components/DashboardWidgets";
import DashboardDemoActions from "../components/DashboardDemoActions";
import TaskSubmitForm from "../components/TaskSubmitForm";

export default function DashboardPage() {
  const { tasks, stats, loading, error, cancelTask } = useTasks();

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(
      DASHBOARD_PROGRESS_STATUSES.map((status) => [status, []]),
    );

    tasks.forEach((task) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    });

    Object.values(groups).forEach((list) => {
      list.sort(
        (a, b) =>
          b.priority - a.priority || new Date(b.updatedAt) - new Date(a.updatedAt),
      );
    });

    return groups;
  }, [tasks]);

  const handleCancel = async (taskId) => {
    try {
      await cancelTask(taskId);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Worker utilization, submit tasks, and live progress
          </p>
        </div>
        {stats && (
          <div className="flex gap-4 text-sm text-slate-300">
            <span>Running: {stats.RUNNING}</span>
            <span>Queued: {stats.QUEUED}</span>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">Loading tasks...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WorkerStatsCard />
        <TaskSubmitForm />
      </div>

      <DashboardDemoActions />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {DASHBOARD_PROGRESS_STATUSES.map((status) => (
          <StatusGroup
            key={status}
            title={STATUS_LABELS[status]}
            tasks={grouped[status]}
            onCancel={handleCancel}
            showRetry={false}
          />
        ))}
      </div>
    </div>
  );
}
