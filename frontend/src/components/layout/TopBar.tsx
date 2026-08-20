import { Link } from "react-router-dom";
import { getEngine } from "../../audio-engine/AudioEngine";
import { renderOfflineWav } from "../../audio-engine/offlineRender";
import { api } from "../../api/client";
import { useStudio } from "../../store/useStudio";
import type { StudioMode } from "../../types";

const MODES: { id: StudioMode; label: string }[] = [
  { id: "dj", label: "DJ" },
  { id: "session", label: "Session" },
  { id: "arrange", label: "Arrange" },
  { id: "drums", label: "Drums" },
  { id: "synth", label: "Synth" },
  { id: "sampler", label: "Sampler" },
];

export function TopBar() {
  const { project, bpm, setBpm, togglePlay, playing, metronome, save, saving, setMode, mode, undo, redo, bootAudio } =
    useStudio();

  return (
    <div className="h-14 border-b border-line bg-ink-900 flex items-center px-3 gap-3">
      <Link to="/projects" className="text-[10px] tracking-[0.25em] uppercase text-accent font-semibold pr-2">
        PulseForge
      </Link>
      <div className="text-sm font-medium truncate max-w-[160px]">{project?.name ?? "Untitled"}</div>
      <div className="flex items-center gap-1 bg-ink-800 rounded-md p-1 overflow-auto">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${mode === m.id ? "bg-accent text-black" : "text-zinc-400 hover:text-white"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => void togglePlay()}
        className={`w-10 h-10 rounded-full ${playing ? "bg-mint text-black" : "bg-ink-700 text-white"} font-mono text-sm`}
      >
        {playing ? "■" : "▶"}
      </button>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        BPM
        <input
          type="number"
          className="w-16 bg-ink-800 border border-line rounded px-2 py-1 font-mono text-white"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value) || 120)}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={metronome}
          onChange={(e) => {
            useStudio.setState({ metronome: e.target.checked });
            getEngine().transport.metronome = e.target.checked;
          }}
        />
        Click
      </label>
      <button className="text-[10px] uppercase text-zinc-400" onClick={undo}>
        Undo
      </button>
      <button className="text-[10px] uppercase text-zinc-400" onClick={redo}>
        Redo
      </button>
      <button
        className="text-[10px] uppercase text-zinc-400"
        onClick={async () => {
          await bootAudio();
          await getEngine().enableMidi();
        }}
      >
        MIDI
      </button>
      <div className="flex-1" />
      <button
        onClick={() => void save()}
        className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider hover:bg-ink-600"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <ExportButton />
    </div>
  );
}

function ExportButton() {
  const project = useStudio((s) => s.project);
  return (
    <button
      className="px-3 py-1.5 rounded bg-accent text-black text-xs uppercase tracking-wider font-semibold"
      onClick={async () => {
        if (!project) return;
        try {
          const blob = await renderOfflineWav();
          await api.projects.uploadRender(project.id, blob);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project.name || "mix"}.wav`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          await api.projects.render(project.id, "wav");
          useStudio.setState({
            error: err instanceof Error ? `${err.message} — queued server render` : "Queued server render",
          });
        }
      }}
    >
      Export
    </button>
  );
}
