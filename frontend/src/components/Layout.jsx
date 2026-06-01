import { Link, NavLink } from "react-router-dom";

const navLinkClass = ({ isActive }) =>
  `rounded-full px-3 py-1.5 text-slate-300 transition-colors ${
    isActive ? "bg-blue-700 text-white" : "hover:text-white"
  }`;

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-200 antialiased">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-gray-900 px-6 py-4">
        <div>
          <Link to="/" className="text-lg font-bold text-inherit no-underline">
            Task Execution Engine
          </Link>
          <p className="mt-0.5 text-sm text-slate-400">Distributed task monitoring</p>
        </div>

        <nav className="flex gap-3">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/tasks" className={navLinkClass}>
            All Tasks
          </NavLink>
          <NavLink to="/analytics" className={navLinkClass}>
            Analytics
          </NavLink>
        </nav>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}
