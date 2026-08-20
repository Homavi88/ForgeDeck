import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getEngine } from "../../audio-engine/AudioEngine";
import { encodeWav, renderOfflineWav } from "../../audio-engine/offlineRender";
import { api } from "../../api/client";
import { LanguageSelect, t, useI18n, type MsgKey } from "../../i18n";
import { KEY_OPTIONS } from "../../lib/musicTheory";
import { PowerOffButton } from "./PowerOffButton";
import { useStudio } from "../../store/useStudio";
import type { StudioMode } from "../../types";

const MODES: { id: StudioMode; key: MsgKey }[] = [
  { id: "dj", key: "studio.modeDj" },
  { id: "session", key: "studio.modeSession" },
  { id: "arrange", key: "studio.modeArrange" },
  { id: "drums", key: "studio.modeDrums" },
  { id: "synth", key: "studio.modeSynth" },
  { id: "sampler", key: "studio.modeSampler" },
];

function Chip({
  active,
  onClick,
  title,
  children,
  danger,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 px-2.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
        danger && active
          ? "bg-danger text-white"
          : active
            ? "bg-ink-600 text-cyan"
            : "text-zinc-400 hover:text-white hover:bg-ink-700"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-line shrink-0" aria-hidden />;
}

export function TopBar() {
  const {
    project,
    bpm,
    setBpm,
    musicalKey,
    setMusicalKey,
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
    sessionRec,
    toggleAiPanel,
    toggleLibrary,
    toggleDecksFullscreen,
    toggleSessionRec,
  } = useStudio();
  useI18n((s) => s.locale);
  const name = project?.name ?? t("studio.untitled");
  const aiOn = aiPanelOpen && !decksFullscreen;
  const libOn = libraryOpen && !decksFullscreen;

  return (
    <header className="border-b border-line bg-ink-900 shrink-0">
      <div className="h-12 flex items-center gap-3 px-3">
        <Link
          to="/projects"
          className="text-[10px] tracking-[0.28em] uppercase text-accent font-semibold shrink-0"
        >
          ForgeDeck
        </Link>
        <div className="text-sm font-medium truncate min-w-[7rem] max-w-[14rem]" title={name}>
          {name}
        </div>

        <nav className="flex-1 min-w-0 flex items-center gap-0.5 bg-ink-800 rounded-lg p-0.5 overflow-x-auto">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium ${
                mode === m.id ? "bg-accent text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {t(m.key)}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => void togglePlay()}
          className={`w-9 h-9 shrink-0 rounded-full ${playing ? "bg-mint text-black" : "bg-ink-700 text-white"} font-mono text-sm`}
          title={playing ? "Stop" : "Play"}
        >
          {playing ? "■" : "▶"}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 shrink-0">
          BPM
          <input
            type="number"
            step="0.1"
            className="w-[4.25rem] h-8 bg-ink-800 border border-line rounded-md px-2 font-mono text-sm text-white"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || 120)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 shrink-0">
          {t("studio.key")}
          <select
            className="h-8 bg-ink-800 border border-line rounded-md px-2 text-sm text-zinc-200 max-w-[8.5rem]"
            value={musicalKey}
            onChange={(e) => setMusicalKey(e.target.value)}
          >
            {!KEY_OPTIONS.includes(musicalKey) && <option value={musicalKey}>{musicalKey}</option>}
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 shrink-0">
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

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => void save()}
            className="h-8 px-3 rounded-md bg-ink-700 text-xs font-medium hover:bg-ink-600"
          >
            {saving ? t("studio.saving") : t("studio.save")}
          </button>
          <RecordButton />
          <ExportButton />
        </div>
      </div>

      <div className="h-10 flex items-center gap-1.5 px-3 border-t border-line bg-ink-950">
        <Chip active={sessionRec} danger title={t("session.recTitle")} onClick={() => void toggleSessionRec()}>
          {sessionRec ? t("session.recOn") : t("session.rec")}
        </Chip>
        <Chip onClick={undo}>{t("studio.undo")}</Chip>
        <Chip onClick={redo}>{t("studio.redo")}</Chip>
        <Divider />
        <Chip
          onClick={() => {
            void (async () => {
              await bootAudio();
              await getEngine().enableMidi();
            })();
          }}
        >
          {t("studio.midi")}
        </Chip>
        <MicButton />
        <Chip title={t("studio.keysTitle")} onClick={() => useStudio.setState({ keymapOpen: true })}>
          {t("studio.keys")}
        </Chip>
        <Divider />
        <Chip active={aiOn} onClick={toggleAiPanel}>
          {t("studio.showAi")}
        </Chip>
        <Chip active={libOn} onClick={toggleLibrary}>
          {t("studio.showLib")}
        </Chip>
        <Chip active={decksFullscreen} onClick={toggleDecksFullscreen}>
          {t("studio.decks")}
        </Chip>
        <div className="flex-1 min-w-2" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 hidden lg:inline">
          {saving ? t("studio.autosaving") : t("studio.autosaveOn")}
        </span>
        <LanguageSelect segmented />
        <ShareButton />
        <PowerOffButton compact />
      </div>
    </header>
  );
}

function MicButton() {
  const micOn = useStudio((s) => s.micOn);
  useI18n((s) => s.locale);
  return (
    <Chip
      active={micOn}
      onClick={() => {
        void (async () => {
          await useStudio.getState().bootAudio();
          const next = !useStudio.getState().micOn;
          try {
            await getEngine().setMic(next);
            useStudio.setState({ micOn: next, error: null });
          } catch (err) {
            useStudio.setState({ error: err instanceof Error ? err.message : t("studio.micDenied") });
          }
        })();
      }}
    >
      {micOn ? t("studio.micOn") : t("studio.mic")}
    </Chip>
  );
}

function ShareButton() {
  const project = useStudio((s) => s.project);
  const [copied, setCopied] = useState(false);
  useI18n((s) => s.locale);
  return (
    <Chip
      active={copied}
      onClick={() => {
        void (async () => {
          if (!project) return;
          const res = await api.projects.share(project.id);
          const url = `${window.location.origin}${res.path}`;
          await navigator.clipboard.writeText(url).catch(() => undefined);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        })();
      }}
    >
      {copied ? t("studio.linkCopied") : t("studio.share")}
    </Chip>
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
        <div className="font-mono text-[10px] text-danger hidden xl:block">
          {mm}:{ss} · {(hud.peak * 100).toFixed(0)}% · {mb} MB
        </div>
      )}
      <button
        type="button"
        className={`h-8 px-3 rounded-md text-xs font-semibold ${
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
      type="button"
      className="h-8 px-3 rounded-md bg-accent text-black text-xs font-semibold"
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
