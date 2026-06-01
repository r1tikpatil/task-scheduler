import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAnalytics } from "../api/tasks";

const fieldClass =
  "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200";

const cardClass =
  "min-h-[360px] rounded-2xl border border-gray-800 bg-gray-900 p-4";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = async (selectedHours = hours) => {
    setLoading(true);
    setError("");

    try {
      setAnalytics(await fetchAnalytics(selectedHours));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Execution metrics and queue performance
          </p>
        </div>

        <label className="grid gap-1.5 text-sm">
          Hours
          <select
            className={fieldClass}
            value={hours}
            onChange={(e) => {
              const value = Number(e.target.value);
              setHours(value);
              loadAnalytics(value);
            }}
          >
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="72">72</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading analytics...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {analytics && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className={cardClass}>
            <h2 className="mb-3 text-base font-semibold">Average Execution Time by Type</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.avgExecutionTimeByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <YAxis tick={{ fill: "#cbd5e1" }} />
                <Tooltip />
                <Bar dataKey="avgSeconds" fill="#38bdf8" name="Avg seconds" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 text-base font-semibold">Throughput Over Time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.throughputOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="minute" tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                <YAxis tick={{ fill: "#cbd5e1" }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Completed/min"
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 text-base font-semibold">Failure Rate by Type</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.failureRateByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <YAxis tick={{ fill: "#cbd5e1" }} />
                <Tooltip />
                <Bar dataKey="failureRate" fill="#f97316" name="Failure rate" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 text-base font-semibold">Queue Wait Time Distribution</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.queueWaitDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="bucket" tick={{ fill: "#cbd5e1" }} />
                <YAxis tick={{ fill: "#cbd5e1" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#a78bfa" name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      )}
    </div>
  );
}
