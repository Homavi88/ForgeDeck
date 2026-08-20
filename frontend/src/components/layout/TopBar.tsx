import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEngine } from "../../audio-engine/AudioEngine";
import { encodeWav, renderOfflineWav } from "../../audio-engine/offlineRender";
import { api } from "../../api/client";
import { PowerOffButton } from "./PowerOffButton";
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
  const {
    project,
    bpm,
    setBpm,
    togglePlay,
    playing,
    metronome,
    save,
    saving,
    setMode,
    mode,
    undo,
    redo,
    bootAudio,
    aiPanelOpen,
    libraryOpen,
    decksFullscreen,
    toggleAiPanel,
    toggleLibrary,
    toggleDecksFullscreen,
  } = useStudio();

  return (
    <div className="h-14 border-b border-line bg-ink-900 flex items-center px-3 gap-3">
      <Link to="/projects" className="text-[10px] tracking-[0.25em] uppercase text-accent font-semibold pr-2">
        ForgeDeck
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
      <MicButton />
      <button
        className="text-[10px] uppercase text-zinc-400"
        title="CDJ keyboard"
        onClick={() => useStudio.setState({ keymapOpen: true })}
      >
        Keys
      </button>
      <button
        className={`text-[10px] uppercase ${aiPanelOpen && !decksFullscreen ? "text-cyan" : "text-zinc-500"}`}
        onClick={toggleAiPanel}
      >
        {aiPanelOpen && !decksFullscreen ? "Hide AI" : "AI"}
      </button>
      <button
        className={`text-[10px] uppercase ${libraryOpen && !decksFullscreen ? "text-cyan" : "text-zinc-500"}`}
        onClick={toggleLibrary}
      >
        {libraryOpen && !decksFullscreen ? "Hide lib" : "Library"}
      </button>
      <button
        className={`text-[10px] uppercase ${decksFullscreen ? "text-accent" : "text-zinc-500"}`}
        onClick={toggleDecksFullscreen}
      >
        {decksFullscreen ? "Exit decks" : "Decks"}
      </button>
      <div className="flex-1" />
      <span className="text-[10px] uppercase text-zinc-600">{saving ? "Autosaving…" : "Autosave on"}</span>
      <button
        onClick={() => void save()}
        className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider hover:bg-ink-600"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <ShareButton />
      <RecordButton />
      <ExportButton />
      <PowerOffButton compact />
    </div>
  );
}

function MicButton() {
  const micOn = useStudio((s) => s.micOn);
  return (
    <button
      className={`text-[10px] uppercase ${micOn ? "text-mint" : "text-zinc-400"}`}
      onClick={async () => {
        await useStudio.getState().bootAudio();
        const next = !useStudio.getState().micOn;
        try {
          await getEngine().setMic(next);
          useStudio.setState({ micOn: next, error: null });
        } catch (err) {
          useStudio.setState({ error: err instanceof Error ? err.message : "Mic permission denied" });
        }
      }}
    >
      {micOn ? "Mic on" : "Mic"}
    </button>
  );
}

function ShareButton() {
  const project = useStudio((s) => s.project);
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider hover:bg-ink-600"
      onClick={async () => {
        if (!project) return;
        const res = await api.projects.share(project.id);
        const url = `${window.location.origin}${res.path}`;
        await navigator.clipboard.writeText(url).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

function RecordButton() {
  const project = useStudio((s) => s.project);
  const [on, setOn] = useState(false);
  const [hud, setHud] = useState({ elapsed: 0, peak: 0, bytes: 0 });

  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => {
      setHud(getEngine().recorder.stats);
    }, 200);
    return () => window.clearInterval(t);
  }, [on]);

  const mm = Math.floor(hud.elapsed / 60);
  const ss = Math.floor(hud.elapsed % 60)
    .toString()
    .padStart(2, "0");
  const mb = (hud.bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex items-center gap-2">
      {on && (
        <div className="font-mono text-[10px] text-danger">
          {mm}:{ss} · peak {(hud.peak * 100).toFixed(0)}% · ~{mb} MB
        </div>
      )}
      <button
        className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-semibold ${
          on ? "bg-danger text-white" : "bg-ink-700 hover:bg-ink-600"
        }`}
        onClick={async () => {
          const eng = getEngine();
          await useStudio.getState().bootAudio();
          if (!on) {
            eng.startRecording();
            setOn(true);
            return;
          }
          const buffer = eng.stopRecording();
          setOn(false);
          if (!buffer) return;
          const blob = encodeWav(buffer);
          if (project) await api.projects.uploadRender(project.id, blob).catch(() => undefined);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project?.name || "set"}-live.wav`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        {on ? "Stop rec" : "Rec"}
      </button>
    </div>
  );
}

function ExportButton() {
  const project = useStudio((s) => s.project);
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="px-3 py-1.5 rounded bg-accent text-black text-xs uppercase tracking-wider font-semibold"
      onClick={async () => {
        if (!project || busy) return;
        setBusy(true);
        useStudio.getState().pushToast({ id: "bounce", kind: "info", text: "Rendering bounce…", ttl: 0 });
        try {
          await useStudio.getState().bootAudio();
          const blob = await renderOfflineWav();
          await api.projects.uploadRender(project.id, blob);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project.name || "mix"}-bounce.wav`;
          a.click();
          URL.revokeObjectURL(url);
          useStudio.getState().dismissToast("bounce");
          useStudio.getState().pushToast({ id: "bounce", kind: "ok", text: "Bounce ready — download started", ttl: 3500 });
        } catch (err) {
          await api.projects.render(project.id, "wav");
          const msg = err instanceof Error ? `${err.message} — queued server render` : "Queued server render";
          useStudio.setState({ error: msg });
          useStudio.getState().dismissToast("bounce");
          useStudio.getState().pushToast({ id: "bounce", kind: "warn", text: msg, ttl: 4500 });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Bounce…" : "Bounce"}
    </button>
  );
}
