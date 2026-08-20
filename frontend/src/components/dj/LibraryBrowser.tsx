import { useStudio } from "../../store/useStudio";

export function LibraryBrowser() {
  const { library, uploadFiles, loadToDeck, loading, queue, queueIndex, autoAdvance, addToQueue, removeFromQueue, playQueueItem } =
    useStudio();

  return (
    <div
      className="h-48 border-t border-line bg-ink-900 p-2 overflow-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Library — drop mp3/wav/flac/ogg</div>
        <label className="flex items-center gap-1 text-[10px] uppercase text-zinc-400">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => useStudio.setState({ autoAdvance: e.target.checked })}
          />
          Auto-advance crate
        </label>
        <label className="text-[10px] uppercase bg-ink-700 px-2 py-1 rounded cursor-pointer">
          Upload
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.aiff,.flac,.ogg"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
        </label>
      </div>
      {loading && <div className="text-xs text-zinc-500">Working…</div>}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-8 grid grid-cols-4 gap-2">
          {library.map((file) => (
            <div key={file.id} className="bg-ink-800 border border-line rounded p-2 text-xs">
              <div className="truncate">{file.original_filename}</div>
              <div className="text-zinc-500 font-mono">
                {file.analysis?.bpm?.toFixed(1) ?? file.analysis_status} · {file.analysis?.key ?? ""} {file.analysis?.camelot ?? ""}
              </div>
              <div className="flex gap-1 mt-1">
                <button className="px-1 bg-ink-700 rounded" onClick={() => void loadToDeck("A", file)}>
                  A
                </button>
                <button className="px-1 bg-ink-700 rounded" onClick={() => void loadToDeck("B", file)}>
                  B
                </button>
                <button className="px-1 bg-ink-700 rounded" onClick={() => addToQueue(file)}>
                  +crate
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="col-span-4 bg-ink-800 border border-line rounded p-2">
          <div className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-1">Crate / queue</div>
          {queue.length === 0 && <div className="text-[11px] text-zinc-600">Add tracks with +crate. When a deck ends, the next song loads.</div>}
          <ol className="space-y-1">
            {queue.map((file, i) => (
              <li
                key={`${file.id}-${i}`}
                className={`flex items-center gap-1 text-[11px] ${i === queueIndex ? "text-accent" : "text-zinc-300"}`}
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
