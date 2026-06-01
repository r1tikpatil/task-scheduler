export default function ProgressBar({ value = 0 }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div
      className="relative h-5 overflow-hidden rounded-full bg-slate-800"
      aria-label={`Progress ${safeValue}%`}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-[width] duration-300 ease-out"
        style={{ width: `${safeValue}%` }}
      />
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold">
        {safeValue}%
      </span>
    </div>
  );
}
