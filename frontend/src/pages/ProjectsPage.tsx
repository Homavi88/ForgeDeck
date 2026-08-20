import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/layout/Shell";

interface Item {
  id: string;
  name: string;
  bpm: number;
  musical_key?: string;
  updated_at?: string;
}

export default function ProjectsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("Night Set");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  const refresh = async () => {
    try {
      setItems(await api.projects.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Shell>
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6">Projects</h1>
        <form
          className="flex gap-2 mb-8"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const p = await api.projects.create(name);
              nav(`/projects/${p.id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Create failed");
              setBusy(false);
            }
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-ink-800 border border-line rounded px-3 py-2"
            placeholder="Project name"
          />
          <button disabled={busy} className="px-4 rounded bg-accent text-black font-semibold">
            {busy ? "…" : "Create"}
          </button>
        </form>
        {error && <div className="text-danger text-sm mb-4">{error}</div>}
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-ink-800 border border-line rounded px-4 py-3">
              <Link to={`/projects/${p.id}`} className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-zinc-500 font-mono">{p.bpm} BPM</div>
              </Link>
              <button
                className="text-xs text-zinc-400"
                onClick={async () => {
                  await api.projects.duplicate(p.id);
                  await refresh();
                }}
              >
                Duplicate
              </button>
              <button
                className="text-xs text-danger"
                onClick={async () => {
                  await api.projects.remove(p.id);
                  await refresh();
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
