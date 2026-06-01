import { useState } from "react";
import { API_CLIENTS, TASK_TYPES } from "../constants/enums";
import { useTasks } from "../context/TaskContext";

const DEFAULT_FORM = {
  clientKey: API_CLIENTS[0].key,
  type: TASK_TYPES[0],
  priority: 3,
  payload: '{\n  "example": true\n}',
};

const fieldClass =
  "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200";

const labelClass = "grid gap-1.5 text-sm";

export default function TaskSubmitForm() {
  const { submitTask } = useTasks();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = JSON.parse(form.payload);
      const task = await submitTask(form.clientKey, {
        type: form.type,
        priority: Number(form.priority),
        payload,
      });

      const clientName =
        API_CLIENTS.find((c) => c.key === form.clientKey)?.name ?? "client";

      setSuccess(`Task ${task.id.slice(0, 8)}... submitted for ${clientName}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="mb-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <h2 className="mb-3 text-base font-semibold">Submit Task</h2>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className={labelClass}>
          Client
          <select
            className={fieldClass}
            value={form.clientKey}
            onChange={(e) => setForm({ ...form, clientKey: e.target.value })}
          >
            {API_CLIENTS.map((client) => (
              <option key={client.key} value={client.key}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Type
          <select
            className={fieldClass}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Priority (1-5)
          <input
            className={fieldClass}
            type="number"
            min="1"
            max="5"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Payload (JSON)
          <textarea
            className={fieldClass}
            rows="5"
            value={form.payload}
            onChange={(e) => setForm({ ...form, payload: e.target.value })}
          />
        </label>

        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit Task
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-400">{success}</p>}
    </section>
  );
}
