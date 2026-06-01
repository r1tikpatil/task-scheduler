import { useTasks } from "../context/TaskContext";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";

const cardClass =
  "mb-4 rounded-2xl border border-gray-800 bg-gray-900 p-4";

const btnSecondary =
  "cursor-pointer rounded-lg bg-slate-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50";

const btnPrimary =
  "cursor-pointer rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function WorkerStatsCard() {
  const { workerStats } = useTasks();

  if (!workerStats) {
    return <div className={cardClass}>Loading worker stats...</div>;
  }

  const utilization = workerStats.poolSize
    ? Math.min(
        100,
        Math.round((workerStats.busyWorkers / workerStats.poolSize) * 100),
      )
    : 0;

  return (
    <section className={cardClass}>
      <h2 className="mb-3 text-base font-semibold">Worker Utilization</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <span className="block text-xs text-slate-400">Pool Size</span>
          <strong className="text-lg">{workerStats.poolSize}</strong>
        </div>
        <div>
          <span className="block text-xs text-slate-400">Busy</span>
          <strong className="text-lg text-sky-400">{workerStats.busyWorkers}</strong>
        </div>
        <div>
          <span className="block text-xs text-slate-400">Idle</span>
          <strong className="text-lg text-green-500">{workerStats.idleWorkers}</strong>
        </div>
        <div>
          <span className="block text-xs text-slate-400">Queued</span>
          <strong className="text-lg">{workerStats.queuedTasks}</strong>
        </div>
      </div>
      <ProgressBar value={utilization} />
      <p className="mt-2 text-sm text-slate-400">{utilization}% of workers busy</p>
    </section>
  );
}

export function TaskCard({ task, onCancel, onRetry, showRetry = true }) {
  const canCancel = task.status === "QUEUED" || task.status === "RUNNING";
  const canRetry = showRetry && task.status === "DEAD_LETTER";

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <strong>{task.type}</strong>
          <p className="font-mono text-sm text-slate-400">{task.id.slice(0, 8)}...</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="my-2 flex justify-between gap-2 text-sm text-slate-400">
        <span>Priority {task.priority}</span>
        <span>{task.clientId?.slice(-8)}</span>
      </div>

      {task.status === "RUNNING" && <ProgressBar value={task.progress ?? 0} />}

      {task.errorMessage && (
        <p className="mt-2 text-sm text-red-400">{task.errorMessage}</p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        {canCancel && (
          <button type="button" className={btnSecondary} onClick={() => onCancel(task.id)}>
            Cancel
          </button>
        )}
        {canRetry && (
          <button type="button" className={btnPrimary} onClick={() => onRetry(task.id)}>
            Retry
          </button>
        )}
      </div>
    </article>
  );
}

export function StatusGroup({ title, tasks, onCancel, onRetry, showRetry = true }) {
  return (
    <section className={cardClass}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-sm">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">No tasks in this group.</p>
      ) : (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onCancel={onCancel}
              onRetry={onRetry}
              showRetry={showRetry}
            />
          ))}
        </div>
      )}
    </section>
  );
}
