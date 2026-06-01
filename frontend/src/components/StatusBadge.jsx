import { STATUS_LABELS } from "../constants/enums";

const STATUS_STYLES = {
  QUEUED: "bg-slate-600",
  RUNNING: "bg-blue-700",
  COMPLETED: "bg-green-800",
  FAILED: "bg-orange-800",
  CANCELLED: "bg-stone-600",
  DEAD_LETTER: "bg-orange-800",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        STATUS_STYLES[status] || "bg-slate-600"
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
