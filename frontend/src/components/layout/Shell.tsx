import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { currentUser, logout, type AuthUser } from "../../store/auth";

export function Shell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    setUser(currentUser());
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <header className="h-12 border-b border-line bg-ink-900 flex items-center px-4 gap-6">
        <Link to="/" className="font-semibold tracking-[0.2em] text-accent uppercase text-sm">
          ForgeDeck
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
        <div className="flex-1" />
        {user ? (
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="hidden sm:inline">{user.name}</span>
            <button
              className="uppercase tracking-wider hover:text-white"
              onClick={() => {
                logout();
                setUser(null);
                nav("/login");
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-xs uppercase tracking-wider text-zinc-400 hover:text-white">
            Sign in
          </Link>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
