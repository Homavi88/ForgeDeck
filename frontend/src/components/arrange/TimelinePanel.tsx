import { MixerPanel } from "../dj/MixerPanel";
import { getEngine } from "../../audio-engine/AudioEngine";
import { useStudio } from "../../store/useStudio";
import type { TimelineClip } from "../../types";

const TRACKS = [
  { id: "drums", name: "Drums", color: "#ff6a00" },
  { id: "synth", name: "Synth", color: "#3dfff3" },
  { id: "deckA", name: "Deck A", color: "#3dff7a" },
  { id: "deckB", name: "Deck B", color: "#ffd23f" },
];

const PX = 28;

export function TimelinePanel() {
  const { clips, bpm, currentStep } = useStudio();
  const playhead = (currentStep / 16) * PX * 4;

  const move = (id: string, startBar: number) => {
    const next = clips.map((c) => (c.id === id ? { ...c, startBar: Math.max(0, startBar) } : c));
    useStudio.setState({ clips: next });
    getEngine().timeline.clips = next;
  };

  const trim = (id: string, lengthBars: number) => {
    useStudio.setState({
      clips: clips.map((c) => (c.id === id ? { ...c, lengthBars: Math.max(1, lengthBars) } : c)),
    });
  };

  return (
    <div className="flex-1 p-3 overflow-auto">
      <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">
        Arrangement · {bpm} BPM · snap to bars
      </div>
      <div className="relative min-w-[1200px]">
        <div className="flex text-[9px] text-zinc-600 mb-1 ml-24">
          {Array.from({ length: 33 }).map((_, i) => (
            <div key={i} style={{ width: PX * 4 }} className="border-l border-line pl-1">
              {i + 1}
            </div>
          ))}
        </div>
        {TRACKS.map((tr) => (
          <div key={tr.id} className="flex h-14 border-b border-line relative">
            <div className="w-24 shrink-0 text-xs pt-2 text-zinc-400">{tr.name}</div>
            <div className="flex-1 relative bg-ink-900">
              {clips
                .filter((c) => c.trackId === tr.id)
                .map((c) => (
                  <ClipView key={c.id} clip={c} onMove={move} onTrim={trim} />
                ))}
            </div>
          </div>
        ))}
        <div className="absolute top-4 bottom-0 w-0.5 bg-white" style={{ left: 96 + playhead }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="text-xs bg-ink-700 px-2 py-1 rounded"
          onClick={() => {
            const clip: TimelineClip = {
              id: crypto.randomUUID(),
              trackId: "synth",
              name: "Clip",
              startBar: 0,
              lengthBars: 4,
              color: "#3dfff3",
            };
            useStudio.setState({ clips: [...clips, clip] });
          }}
        >
          Add clip
        </button>
        <p className="text-xs text-zinc-500">Drag clips · double-click to split at playhead bar</p>
      </div>
      <AutomationLanes />
      <div className="mt-4">
        <MixerPanel />
      </div>
    </div>
  );
}

function AutomationLanes() {
  const automation = useStudio((s) => s.automation);
  if (!automation.length) {
    return <p className="text-xs text-zinc-600 mt-3">Automation lanes appear here after AI Apply (filter/EQ/volume).</p>;
  }
  return (
    <div className="mt-4 space-y-2">
      {automation.map((lane) => (
        <div key={lane.target} className="text-xs font-mono text-zinc-400">
          {lane.target}: {lane.points.map((p) => `${p.time.toFixed(1)}s→${p.value}`).join("  ")}
        </div>
      ))}
    </div>
  );
}

function ClipView({
  clip,
  onMove,
  onTrim,
}: {
  clip: TimelineClip;
  onMove: (id: string, bar: number) => void;
  onTrim: (id: string, bars: number) => void;
}) {
  return (
    <div
      className="absolute top-1 h-10 rounded text-[10px] px-2 flex items-center cursor-grab"
      style={{ left: clip.startBar * PX * 4, width: clip.lengthBars * PX * 4, background: clip.color, color: "#111" }}
      draggable
      onDragEnd={(e) => {
        const parent = (e.target as HTMLElement).parentElement;
        if (!parent) return;
        const x = e.clientX - parent.getBoundingClientRect().left;
        const bar = Math.round(x / (PX * 4));
        onMove(clip.id, bar);
      }}
      onDoubleClick={() => {
        const { currentStep, clips } = useStudio.getState();
        const at = Math.floor(currentStep / 16);
        const next = clips.flatMap((c) => {
          if (c.id !== clip.id) return [c];
          if (at <= c.startBar || at >= c.startBar + c.lengthBars) return [c];
          const left = { ...c, lengthBars: at - c.startBar };
          const right = {
            ...c,
            id: crypto.randomUUID(),
            startBar: at,
            lengthBars: c.startBar + c.lengthBars - at,
          };
          return [left, right];
        });
        useStudio.setState({ clips: next });
      }}
      onWheel={(e) => {
        e.preventDefault();
        onTrim(clip.id, clip.lengthBars + (e.deltaY > 0 ? -1 : 1));
      }}
    >
      {clip.name}
    </div>
  );
}
