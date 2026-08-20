import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { TimelinePanel } from "../components/arrange/TimelinePanel";
import { DeckPanel } from "../components/dj/DeckPanel";
import { LibraryBrowser } from "../components/dj/LibraryBrowser";
import { MixerPanel } from "../components/dj/MixerPanel";
import { DrumMachinePanel } from "../components/drums/DrumMachinePanel";
import { AIPanel } from "../components/layout/AIPanel";
import { TopBar } from "../components/layout/TopBar";
import { SynthPanel } from "../components/synth/SynthPanel";
import { useStudio } from "../store/useStudio";

export default function StudioPage() {
  const { id } = useParams();
  const { loadProject, loading, error, mode, pollMeters, bootAudio } = useStudio();

  useEffect(() => {
    if (id) void loadProject(id);
  }, [id, loadProject]);

  useEffect(() => {
    const t = window.setInterval(() => pollMeters(), 80);
    return () => window.clearInterval(t);
  }, [pollMeters]);

  useEffect(() => {
    const unlock = () => {
      void bootAudio();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, [bootAudio]);

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <TopBar />
      {error && <div className="bg-danger/20 text-danger text-xs px-3 py-1">{error}</div>}
      {loading && <div className="text-xs text-zinc-500 px-3 py-1">Loading project…</div>}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {mode === "dj" && (
            <>
              <div className="flex-1 flex gap-3 p-3 min-h-0">
                <DeckPanel side="A" />
                <MixerPanel />
                <DeckPanel side="B" />
              </div>
              <LibraryBrowser />
            </>
          )}
          {mode === "drums" && <DrumMachinePanel />}
          {mode === "synth" && <SynthPanel />}
          {mode === "arrange" && <TimelinePanel />}
        </div>
        <AIPanel />
      </div>
    </div>
  );
}
