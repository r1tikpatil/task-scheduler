import { useState } from "react";
import { API_CLIENTS, TASK_TYPES } from "../constants/enums";
import { useTasks } from "../context/TaskContext";

const SEED_COUNT = 55;

const btnSecondary =
  "cursor-pointer rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50";

const btnDanger =
  "cursor-pointer rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50";

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const randomPriority = () => Math.floor(Math.random() * 5) + 1;

export default function DashboardDemoActions() {
  const { seedDemoTasks, submitTask } = useTasks();
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const runAction = async (key, action) => {
    setBusy(key);
    setMessage("");
    setError("");

    try {
      const result = await action();
      setMessage(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleSeed = () =>
    runAction("seed", async () => {
      const result = await seedDemoTasks(SEED_COUNT);
      return result.message ?? `Created ${result.created} demo tasks`;
    });

  const handleFailingTask = () =>
    runAction("fail", async () => {
      const client = randomItem(API_CLIENTS);
      const type = randomItem(TASK_TYPES);
      const priority = randomPriority();
      const task = await submitTask(client.key, {
        type,
        priority,
        payload: {
          simulateFailure: true,
          demo: "retry-dlq-test",
          note: "Fails near 50% progress, then retries up to 3 times before DLQ",
        },
      });

      return `Failing demo task ${task.id.slice(0, 8)}... queued for ${client.name} (priority ${priority})`;
    });

  return (
    <section className="mb-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <h2 className="mb-1 text-base font-semibold">Demo Actions</h2>
      <p className="mb-3 text-sm text-slate-400">
        Seed load-test tasks or submit one task that fails mid-run to exercise retries and
        dead letter.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={btnSecondary}
          disabled={busy !== null}
          onClick={handleSeed}
        >
          {busy === "seed" ? "Seeding..." : `Seed ${SEED_COUNT} Tasks`}
        </button>

        <button
          type="button"
          className={btnDanger}
          disabled={busy !== null}
          onClick={handleFailingTask}
        >
          {busy === "fail" ? "Submitting..." : "Create Failing Task"}
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
