import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { getEngine } from "../audio-engine/AudioEngine";
import { TimelinePanel } from "../components/arrange/TimelinePanel";
import { DeckPanel } from "../components/dj/DeckPanel";
import { HeadphonesMonitor } from "../components/dj/HeadphonesMonitor";
import { KeymapHelp } from "../components/dj/KeymapHelp";
import { LibraryBrowser } from "../components/dj/LibraryBrowser";
import { MixerPanel } from "../components/dj/MixerPanel";
import { DrumMachinePanel } from "../components/drums/DrumMachinePanel";
import { AIPanel } from "../components/layout/AIPanel";
import { ToastHost } from "../components/layout/ToastHost";
import { TopBar } from "../components/layout/TopBar";
import { SamplerPanel } from "../components/sampler/SamplerPanel";
import { SessionPanel } from "../components/session/SessionPanel";
import { SynthPanel } from "../components/synth/SynthPanel";
import { t, useI18n } from "../i18n";
import { handleDjHotkey } from "../lib/djHotkeys";
import { useProjectSync } from "../store/useProjectSync";
import { useStudio } from "../store/useStudio";

let demoPlayed = false;

export default function StudioPage() {
  const { id } = useParams();
  const {
    loadProject,
    loading,
    error,
    mode,
    pollMeters,
    bootAudio,
    undo,
    redo,
    project,
    bpm,
    mixer,
    queue,
    autoAdvance,
    drumSteps,
    musicalKey,
    notes,
    midiPatterns,
    activeMidiPatternId,
    ghostNotes,
    clips,
    synth,
    crossfader,
    xfaderCurve,
    sidechain,
    deckFiles,
    keyLock,
    trackView,
    pitchRange,
    sessionClips,
    fxReturns,
    prodLanes,
    arrangeZoom,
    arrangeSnap,
    automation,
    aiPanelOpen,
    libraryOpen,
    decksFullscreen,
  } = useStudio();
  useI18n((s) => s.locale);
  useProjectSync(id);
  const saveArmed = useRef(false);

  useEffect(() => {
    if (!id) return;
    saveArmed.current = false;
    void loadProject(id).then(() => {
      window.setTimeout(() => {
        saveArmed.current = true;
      }, 900);
    });
  }, [id, loadProject]);

  useEffect(() => {
    const t = window.setInterval(() => pollMeters(), 80);
    return () => window.clearInterval(t);
  }, [pollMeters]);

  useEffect(() => {
    if (!project || loading || !saveArmed.current) return;
    const t = window.setTimeout(() => {
      void useStudio.getState().save();
    }, 2200);
    return () => window.clearTimeout(t);
  }, [
    project,
    loading,
    mode,
    bpm,
    mixer,
    queue,
    autoAdvance,
    drumSteps,
    musicalKey,
    notes,
    midiPatterns,
    activeMidiPatternId,
    ghostNotes,
    clips,
    synth,
    crossfader,
    xfaderCurve,
    sidechain,
    deckFiles,
    keyLock,
    trackView,
    pitchRange,
    sessionClips,
    fxReturns,
    prodLanes,
    arrangeZoom,
    arrangeSnap,
    automation,
  ]);

  useEffect(() => {
    const unlock = async () => {
      await bootAudio();
      const s = useStudio.getState();
      if (!demoPlayed && s.deckFiles.A) {
        const deck = getEngine().decks.A;
        if (deck.buffer && !deck.playing) {
          deck.play();
          useStudio.setState({ playing: true });
          demoPlayed = true;
        }
      }
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    const keys = (e: KeyboardEvent) => {
      if (e.type === "keyup") {
        handleDjHotkey(e);
        return;
      }
      if (e.key === "Escape") {
        const st = useStudio.getState();
        if (st.keymapOpen) {
          useStudio.setState({ keymapOpen: false });
          return;
        }
        if (st.decksFullscreen) st.toggleDecksFullscreen();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void useStudio.getState().save();
        return;
      }
      if (handleDjHotkey(e)) return;
      if (e.code === "Space") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        void useStudio.getState().togglePlay();
      }
    };
    window.addEventListener("keydown", keys);
    window.addEventListener("keyup", keys);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", keys);
      window.removeEventListener("keyup", keys);
    };
  }, [bootAudio, undo, redo]);

  const showAi = aiPanelOpen && !decksFullscreen;
  const showLib =
    libraryOpen && !decksFullscreen && (mode === "dj" || mode === "session" || mode === "arrange" || mode === "sampler");

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <HeadphonesMonitor />
      <ToastHost />
      <KeymapHelp />
      <TopBar />
      {error && <div className="bg-danger/20 text-danger text-xs px-3 py-1">{error}</div>}
      {loading && <div className="text-xs text-zinc-500 px-3 py-1">{t("studio.loading")}</div>}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {mode === "dj" && (
            <>
              <div className="flex-1 flex gap-3 p-3 min-h-0">
                <DeckPanel side="A" />
                <MixerPanel />
                <DeckPanel side="B" />
              </div>
              {showLib && <LibraryBrowser />}
            </>
          )}
          {mode === "session" && (
            <>
              <SessionPanel />
              {showLib && <LibraryBrowser />}
            </>
          )}
          {mode === "drums" && <DrumMachinePanel />}
          {mode === "synth" && <SynthPanel />}
          {mode === "arrange" && (
            <>
              <TimelinePanel />
              {showLib && <LibraryBrowser />}
            </>
          )}
          {mode === "sampler" && (
            <>
              <SamplerPanel />
              {showLib && <LibraryBrowser />}
            </>
          )}
        </div>
        {showAi && <AIPanel />}
      </div>
    </div>
  );
}
