import { useEffect } from "react";
import { Shell } from "../components/layout/Shell";
import { useStudio } from "../store/useStudio";

export default function LibraryPage() {
  const { library, refreshLibrary, uploadFiles, loading } = useStudio();

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  return (
    <Shell>
      <div
        className="max-w-5xl mx-auto p-8"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void uploadFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Library</h1>
          <label className="px-3 py-2 rounded bg-accent text-black text-sm font-semibold cursor-pointer">
            Upload
            <input type="file" hidden multiple accept="audio/*" onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
          </label>
        </div>
        {loading && <p className="text-zinc-500 text-sm">Uploading / analyzing…</p>}
        <div className="grid grid-cols-2 gap-3">
          {library.map((f) => (
            <div key={f.id} className="border border-line rounded p-3 bg-ink-800">
              <div>{f.original_filename}</div>
              <div className="text-xs font-mono text-zinc-500">
                {f.analysis_status} · {f.analysis?.bpm ?? "—"} BPM · {f.analysis?.key ?? ""} · {f.duration?.toFixed(1)}s
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
