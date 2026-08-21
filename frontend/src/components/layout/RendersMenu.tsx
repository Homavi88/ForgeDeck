import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";

type Job = {
  id: string;
  status: string;
  format: string;
  source: string;
  details: Record<string, unknown>;
  created_at?: string | null;
};

export function RendersMenu() {
  const project = useStudio((s) => s.project);
  useI18n((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Job[]>([]);
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
      .renders(project.id)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project]);

  if (!project) return null;

  const download = async (job: Job) => {
    const blob = await api.projects.downloadRender(project.id, job.id);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${job.source}-${job.id.slice(0, 8)}.${job.format || "wav"}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        title={t("studio.rendersTitle")}
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-3 rounded-md text-xs font-medium ${open ? "bg-ink-600 text-cyan" : "bg-ink-700 hover:bg-ink-600"}`}
      >
        {t("studio.renders")}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-80 max-h-80 overflow-auto rounded-lg border border-line bg-ink-900 shadow-xl p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 px-1 pb-1">{t("studio.rendersTitle")}</div>
          {!items.length && <div className="text-xs text-zinc-500 px-1 py-2">{t("studio.noRenders")}</div>}
          {items.map((job) => (
            <button
              key={job.id}
              type="button"
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-ink-800 flex justify-between gap-2"
              onClick={() => void download(job)}
            >
              <span className="truncate">
                {job.source} · {job.format} · {job.status}
              </span>
              <span className="text-zinc-500 shrink-0">{job.created_at ? new Date(job.created_at).toLocaleString() : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
