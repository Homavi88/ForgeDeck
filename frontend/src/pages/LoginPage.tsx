import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register } from "../store/auth";
import { Shell } from "../components/layout/Shell";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("producer@forgedeck.local");
  const [name, setName] = useState("Producer");
  const [password, setPassword] = useState("demo");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Shell>
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Demo: <code className="text-accent">producer@forgedeck.local</code> / <code className="text-accent">demo</code>
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              if (mode === "register") await register(email, name, password);
              else await login(email, password);
              nav("/projects");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Auth failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "register" && (
            <input
              className="w-full bg-ink-800 border border-line rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
          )}
          <input
            className="w-full bg-ink-800 border border-line rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            type="password"
            className="w-full bg-ink-800 border border-line rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <div className="text-danger text-sm">{error}</div>}
          <button disabled={busy} className="w-full py-2 rounded bg-accent text-black font-semibold">
            {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <button
          className="mt-4 text-xs uppercase tracking-wider text-zinc-500"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
        <div className="mt-6">
          <Link to="/" className="text-sm text-zinc-400">
            ← Home
          </Link>
        </div>
      </div>
    </Shell>
  );
}
