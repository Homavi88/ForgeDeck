import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEngine } from "../../audio-engine/AudioEngine";
import { encodeWav, renderOfflineWav } from "../../audio-engine/offlineRender";
import { api } from "../../api/client";
import { LanguageSelect, t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";
import type { StudioMode } from "../../types";

const MODES: { id: StudioMode; key: string }[] = [
  { id: "dj", key: "studio.modeDj" },
  { id: "session", key: "studio.modeSession" },
  { id: "arrange", key: "studio.modeArrange" },
  { id: "drums", key: "studio.modeDrums" },
  { id: "synth", key: "studio.modeSynth" },
  { id: "sampler", key: "studio.modeSampler" },
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
  useI18n((s) => s.locale);

  return (
    <div className="h-14 border-b border-line bg-ink-900 flex items-center px-3 gap-3">
      <Link to="/projects" className="text-[10px] tracking-[0.25em] uppercase text-accent font-semibold pr-2">
        ForgeDeck
      </Link>
      <div className="text-sm font-medium truncate max-w-[160px]">{project?.name ?? t("studio.untitled")}</div>
      <div className="flex items-center gap-1 bg-ink-800 rounded-md p-1 overflow-auto">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${mode === m.id ? "bg-accent text-black" : "text-zinc-400 hover:text-white"}`}
          >
            {t(m.key)}
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
        {t("studio.click")}
      </label>
      <button className="text-[10px] uppercase text-zinc-400" onClick={undo}>
        {t("studio.undo")}
      </button>
      <button className="text-[10px] uppercase text-zinc-400" onClick={redo}>
        {t("studio.redo")}
      </button>
      <button
        className="text-[10px] uppercase text-zinc-400"
        onClick={async () => {
          await bootAudio();
          await getEngine().enableMidi();
        }}
      >
        {t("studio.midi")}
      </button>
      <MicButton />
      <button
        className="text-[10px] uppercase text-zinc-400"
        title={t("studio.keysTitle")}
        onClick={() => useStudio.setState({ keymapOpen: true })}
      >
        {t("studio.keys")}
      </button>
      <button
        className={`text-[10px] uppercase ${aiPanelOpen && !decksFullscreen ? "text-cyan" : "text-zinc-500"}`}
        onClick={toggleAiPanel}
      >
        {aiPanelOpen && !decksFullscreen ? t("studio.hideAi") : t("studio.showAi")}
      </button>
      <button
        className={`text-[10px] uppercase ${libraryOpen && !decksFullscreen ? "text-cyan" : "text-zinc-500"}`}
        onClick={toggleLibrary}
      >
        {libraryOpen && !decksFullscreen ? t("studio.hideLib") : t("studio.showLib")}
      </button>
      <button
        className={`text-[10px] uppercase ${decksFullscreen ? "text-accent" : "text-zinc-500"}`}
        onClick={toggleDecksFullscreen}
      >
        {decksFullscreen ? t("studio.exitDecks") : t("studio.decks")}
      </button>
      <div className="flex-1" />
      <LanguageSelect compact />
      <span className="text-[10px] uppercase text-zinc-600">{saving ? t("studio.autosaving") : t("studio.autosaveOn")}</span>
      <button
        onClick={() => void save()}
        className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider hover:bg-ink-600"
      >
        {saving ? t("studio.saving") : t("studio.save")}
      </button>
      <ShareButton />
      <RecordButton />
      <ExportButton />
    </div>
  );
}

function MicButton() {
  const micOn = useStudio((s) => s.micOn);
  useI18n((s) => s.locale);
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
          useStudio.setState({ error: err instanceof Error ? err.message : t("studio.micDenied") });
        }
      }}
    >
      {micOn ? t("studio.micOn") : t("studio.mic")}
    </button>
  );
}

function ShareButton() {
  const project = useStudio((s) => s.project);
  const [copied, setCopied] = useState(false);
  useI18n((s) => s.locale);
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
      {copied ? t("studio.linkCopied") : t("studio.share")}
    </button>
  );
}

function RecordButton() {
  const project = useStudio((s) => s.project);
  const [on, setOn] = useState(false);
  useI18n((s) => s.locale);
  const [hud, setHud] = useState({ elapsed: 0, peak: 0, bytes: 0 });

  useEffect(() => {
    if (!on) return;
    const timer = window.setInterval(() => {
      setHud(getEngine().recorder.stats);
    }, 200);
    return () => window.clearInterval(timer);
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
        {on ? t("studio.stopRec") : t("studio.rec")}
      </button>
    </div>
  );
}

function ExportButton() {
  const project = useStudio((s) => s.project);
  const [busy, setBusy] = useState(false);
  useI18n((s) => s.locale);
  return (
    <button
      className="px-3 py-1.5 rounded bg-accent text-black text-xs uppercase tracking-wider font-semibold"
      onClick={async () => {
        if (!project || busy) return;
        setBusy(true);
        useStudio.getState().pushToast({ id: "bounce", kind: "info", text: t("toast.bounce"), ttl: 0 });
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
          useStudio.getState().pushToast({ id: "bounce", kind: "ok", text: t("toast.bounceReady"), ttl: 3500 });
        } catch (err) {
          await api.projects.render(project.id, "wav");
          const msg = err instanceof Error ? t("toast.bounceQueuedErr", { msg: err.message }) : t("toast.bounceQueued");
          useStudio.setState({ error: msg });
          useStudio.getState().dismissToast("bounce");
          useStudio.getState().pushToast({ id: "bounce", kind: "warn", text: msg, ttl: 4500 });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? t("studio.bouncing") : t("studio.bounce")}
    </button>
  );
}
