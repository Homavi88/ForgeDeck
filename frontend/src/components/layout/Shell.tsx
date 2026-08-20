import { Link, NavLink } from "react-router-dom";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="h-12 border-b border-line bg-ink-900 flex items-center px-4 gap-6">
        <Link to="/" className="font-semibold tracking-[0.2em] text-accent uppercase text-sm">
          PulseForge
        </Link>
        <nav className="flex gap-4 text-sm text-zinc-400">
          <NavLink to="/projects" className={({ isActive }) => (isActive ? "text-white" : "hover:text-white")}>
            Projects
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => (isActive ? "text-white" : "hover:text-white")}>
            Library
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "text-white" : "hover:text-white")}>
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
