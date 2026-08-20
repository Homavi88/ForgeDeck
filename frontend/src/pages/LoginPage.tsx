import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register } from "../store/auth";
import { Shell } from "../components/layout/Shell";
import { t, useI18n } from "../i18n";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("producer@forgedeck.local");
  const [name, setName] = useState("Producer");
  const [password, setPassword] = useState("demo");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useI18n((s) => s.locale);

  return (
    <Shell>
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-2">{t("login.title")}</h1>
        <p className="text-sm text-zinc-500 mb-6">
          {t("login.demo")} <code className="text-accent">producer@forgedeck.local</code> /{" "}
          <code className="text-accent">demo</code>
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
              setError(err instanceof Error ? err.message : t("login.failed"));
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
              placeholder={t("login.name")}
            />
          )}
          <input
            className="w-full bg-ink-800 border border-line rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.email")}
          />
          <input
            type="password"
            className="w-full bg-ink-800 border border-line rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("login.password")}
          />
          {error && <div className="text-danger text-sm">{error}</div>}
          <button disabled={busy} className="w-full py-2 rounded bg-accent text-black font-semibold">
            {busy ? "…" : mode === "login" ? t("login.logIn") : t("login.create")}
          </button>
        </form>
        <button
          className="mt-4 text-xs uppercase tracking-wider text-zinc-500"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? t("login.needAccount") : t("login.haveAccount")}
        </button>
        <div className="mt-6">
          <Link to="/" className="text-sm text-zinc-400">
            {t("login.home")}
          </Link>
        </div>
      </div>
    </Shell>
  );
}
