import { useMemo, useState } from "react";
import { t, useI18n } from "../../i18n";
import { compatibleCamelot } from "../../lib/camelot";
import { setTrackDrag } from "../../lib/trackDrag";
import { useStudio } from "../../store/useStudio";
import type { AudioFile } from "../../types";

type SortKey = "recent" | "name" | "bpm" | "camelot";

export function LibraryBrowser() {
  const { library, uploadFiles, loadToDeck, loading, queue, queueIndex, autoAdvance, addToQueue, removeFromQueue, playQueueItem, deckFiles } =
    useStudio();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  useI18n((s) => s.locale);
  const deckA = deckFiles.A?.analysis;
  const neighbors = deckA?.camelot ? compatibleCamelot(deckA.camelot) : null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = library.filter((f) => {
      if (!q) return true;
      const hay = `${f.original_filename} ${f.analysis?.key ?? ""} ${f.analysis?.camelot ?? ""} ${f.analysis?.bpm ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    const copy = [...filtered];
    copy.sort((a, b) => compareTracks(a, b, sort));
    return copy;
  }, [library, query, sort]);

  return (
    <div
      className="h-56 border-t border-line bg-ink-900 p-2 overflow-auto"
      onDragOver={(e) => {
        if (e.dataTransfer.files.length) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{t("library.title")}</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("library.search")}
          className="flex-1 min-w-[12rem] max-w-xs bg-ink-800 border border-line rounded px-2 py-1 text-xs"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-ink-800 border border-line rounded px-2 py-1 text-[10px] uppercase"
        >
          <option value="recent">{t("library.recent")}</option>
          <option value="name">{t("library.name")}</option>
          <option value="bpm">{t("library.bpm")}</option>
          <option value="camelot">{t("library.camelot")}</option>
        </select>
        <label className="flex items-center gap-1 text-[10px] uppercase text-zinc-400">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => useStudio.setState({ autoAdvance: e.target.checked })}
          />
          {t("library.autoAdvance")}
        </label>
        <label className="text-[10px] uppercase bg-ink-700 px-2 py-1 rounded cursor-pointer">
          {t("library.upload")}
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.aiff,.flac,.ogg"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
        </label>
      </div>
      {loading && <div className="text-xs text-zinc-500">{t("library.working")}</div>}
      {neighbors && (
        <div className="text-[10px] text-mint mb-1">
          {t("library.compatible", { camelot: deckA?.camelot ?? "" })}
        </div>
      )}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-8 grid grid-cols-4 gap-2">
          {rows.map((file) => {
            const cam = file.analysis?.camelot;
            const mixOk = !!(cam && neighbors?.has(cam.toUpperCase()));
            return (
              <div
                key={file.id}
                draggable
                onDragStart={(e) => setTrackDrag(e.dataTransfer, file)}
                className={`bg-ink-800 border rounded p-2 text-xs cursor-grab ${mixOk ? "border-mint/70" : "border-line"}`}
              >
                <div className="truncate">{file.original_filename}</div>
                <div className="text-zinc-500 font-mono">
                  {file.analysis?.bpm?.toFixed(1) ?? file.analysis_status} · {file.analysis?.key ?? ""} {cam ?? ""}
                </div>
                <div className="flex gap-1 mt-1">
                  <button className="px-1 bg-ink-700 rounded" onClick={() => void loadToDeck("A", file)}>
                    A
                  </button>
                  <button className="px-1 bg-ink-700 rounded" onClick={() => void loadToDeck("B", file)}>
                    B
                  </button>
                  <button className="px-1 bg-ink-700 rounded" onClick={() => addToQueue(file)}>
                    {t("library.crateAdd")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="col-span-4 bg-ink-800 border border-line rounded p-2">
          <div className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-1">{t("library.crate")}</div>
          {queue.length === 0 && (
            <div className="text-[11px] text-zinc-600">{t("library.crateEmpty")}</div>
          )}
          <ol className="space-y-1">
            {queue.map((file, i) => (
              <li
                key={`${file.id}-${i}`}
                draggable
                onDragStart={(e) => setTrackDrag(e.dataTransfer, file)}
                className={`flex items-center gap-1 text-[11px] cursor-grab ${i === queueIndex ? "text-accent" : "text-zinc-300"}`}
              >
                <button className="truncate flex-1 text-left" onClick={() => void playQueueItem(i, "A")}>
                  {i + 1}. {file.original_filename}
                </button>
                <button className="text-zinc-500" onClick={() => removeFromQueue(i)}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function compareTracks(a: AudioFile, b: AudioFile, sort: SortKey): number {
  if (sort === "name") return a.original_filename.localeCompare(b.original_filename);
  if (sort === "bpm") return (a.analysis?.bpm ?? 0) - (b.analysis?.bpm ?? 0);
  if (sort === "camelot") return (a.analysis?.camelot ?? "zz").localeCompare(b.analysis?.camelot ?? "zz");
  const ta = a.created_at ? Date.parse(a.created_at) : 0;
  const tb = b.created_at ? Date.parse(b.created_at) : 0;
  return tb - ta;
}
