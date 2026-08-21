import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";
import type { ProjectSnapshot } from "../../types";

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const delta = Date.now() - ms;
  if (delta < 45_000) return t("studio.justNow");
  if (delta < 3_600_000) return t("studio.minutesAgo", { n: Math.max(1, Math.round(delta / 60_000)) });
  return new Date(ms).toLocaleString();
}

export function HistoryMenu() {
  const project = useStudio((s) => s.project);
  const restoreSnapshot = useStudio((s) => s.restoreSnapshot);
  const createNamedSnapshot = useStudio((s) => s.createNamedSnapshot);
  useI18n((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProjectSnapshot[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    void api.projects
      .snapshots(project.id)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project, project?.graph_revision]);

  if (!project) return null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        title={t("studio.historyTitle")}
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-3 rounded-md text-xs font-medium ${
          open ? "bg-ink-600 text-cyan" : "bg-ink-700 hover:bg-ink-600"
        }`}
      >
        {t("studio.history")}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-80 rounded-lg border border-line bg-ink-900 shadow-xl p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 px-1 pb-1">{t("studio.historyTitle")}</div>
          <form
            className="flex gap-1 mb-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void createNamedSnapshot(label)
                .then(() => {
                  setLabel("");
                  return api.projects.snapshots(project.id);
                })
                .then(setItems)
                .finally(() => setBusy(false));
            }}
          >
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("studio.snapshotName")}
              className="flex-1 min-w-0 h-7 px-2 rounded-md bg-ink-800 text-[11px] text-white placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-7 px-2 rounded-md bg-accent text-black text-[11px] font-semibold shrink-0"
            >
              {t("studio.pinSnapshot")}
            </button>
          </form>
          <ul className="max-h-64 overflow-y-auto">
            {items.length === 0 && (
              <li className="text-[11px] text-zinc-500 px-1 py-2">{t("studio.noSnapshots")}</li>
            )}
            {items.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-ink-800">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-white truncate">{row.label}</div>
                  <div className="text-[10px] text-zinc-500">
                    r{row.revision}
                    {row.created_at ? ` · ${formatWhen(row.created_at)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="h-6 px-2 rounded text-[10px] text-cyan hover:bg-ink-700 shrink-0"
                  onClick={() => {
                    setBusy(true);
                    void restoreSnapshot(row.id)
                      .then(() => setOpen(false))
                      .finally(() => setBusy(false));
                  }}
                >
                  {t("studio.restore")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
