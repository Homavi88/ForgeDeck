import { ProductionMixer } from "../mix/ProductionMixer";
import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";
import { CORE_LANES, arrangeIdForMix } from "../../lib/mix";
import { peekStemDrag, peekTrackDrag, readStemDrag, readTrackDragId } from "../../lib/trackDrag";
import { useStudio } from "../../store/useStudio";
import type { TimelineClip } from "../../types";
import type { DragEvent, PointerEvent } from "react";

const PX = 28;

export function TimelinePanel() {
  const { clips, bpm, currentStep, library, prodLanes, selectedMixId } = useStudio();
  const playhead = (currentStep / 16) * PX * 4;
  useI18n((s) => s.locale);
  const lanes = [...CORE_LANES, ...prodLanes];

  const move = (id: string, startBar: number) => {
    const next = clips.map((c) => (c.id === id ? { ...c, startBar: Math.max(0, startBar) } : c));
    useStudio.setState({ clips: next });
    getEngine().timeline.clips = next;
  };

  const trim = (id: string, startBar: number, lengthBars: number) => {
    const next = clips.map((c) =>
      c.id === id ? { ...c, startBar: Math.max(0, startBar), lengthBars: Math.max(1, lengthBars) } : c,
    );
    useStudio.setState({ clips: next });
    getEngine().timeline.clips = next;
  };

  const dropOnTrack = (trackId: string, e: DragEvent) => {
    e.preventDefault();
    const parent = e.currentTarget.getBoundingClientRect();
    const bar = Math.max(0, Math.round((e.clientX - parent.left) / (PX * 4)));
    const stem = readStemDrag(e.dataTransfer);
    if (stem) {
      const file = library.find((f) => f.id === stem.audioFileId);
      if (file) useStudio.getState().placeLoopOnArrange(trackId, bar, file, stem.stem);
      return;
    }
    const id = readTrackDragId(e.dataTransfer);
    const file = id ? library.find((f) => f.id === id) : null;
    if (file) useStudio.getState().placeLoopOnArrange(trackId, bar, file);
  };

  return (
    <div className="flex-1 p-3 overflow-auto flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
          {t("arrange.title", { bpm })}
        </div>
        <button
          className="text-xs bg-accent text-black font-semibold px-2 py-1 rounded"
          onClick={() => useStudio.getState().addAudioLane()}
        >
          {t("arrange.addTrack")}
        </button>
      </div>
      <div className="relative min-w-[1200px]">
        <div className="flex text-[9px] text-zinc-600 mb-1 ml-24">
          {Array.from({ length: 33 }).map((_, i) => (
            <div key={i} style={{ width: PX * 4 }} className="border-l border-line pl-1">
              {i + 1}
            </div>
          ))}
        </div>
        {lanes.map((lane) => {
          const trackId = arrangeIdForMix(lane.id);
          const selected = selectedMixId === lane.id;
          return (
            <div key={lane.id} className={`flex h-16 border-b border-line relative ${selected ? "bg-ink-800/40" : ""}`}>
              <button
                className="w-24 shrink-0 text-xs pt-2 text-left px-1 truncate"
                style={{ color: lane.color }}
                onClick={() => useStudio.getState().selectMix(lane.id)}
              >
                {lane.name}
              </button>
              <div
                className="flex-1 relative bg-ink-900"
                onDragOver={(e) => {
                  if (peekTrackDrag(e.dataTransfer) || peekStemDrag(e.dataTransfer)) e.preventDefault();
                }}
                onDrop={(e) => dropOnTrack(trackId, e)}
                onClick={() => useStudio.getState().selectMix(lane.id)}
              >
                {clips
                  .filter((c) => c.trackId === trackId)
                  .map((c) => (
                    <ClipView key={c.id} clip={c} onMove={move} onTrim={trim} />
                  ))}
              </div>
            </div>
          );
        })}
        <div className="absolute top-4 bottom-0 w-0.5 bg-white" style={{ left: 96 + playhead }} />
      </div>
      <p className="text-xs text-zinc-500">{t("arrange.hint")}</p>
      <AutomationLanes />
      <ProductionMixer />
    </div>
  );
}

function AutomationLanes() {
  const automation = useStudio((s) => s.automation);
  useI18n((s) => s.locale);
  if (!automation.length) {
    return <p className="text-xs text-zinc-600">{t("arrange.autoEmpty")}</p>;
  }
  return (
    <div className="space-y-2">
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
  onTrim: (id: string, startBar: number, lengthBars: number) => void;
}) {
  useI18n((s) => s.locale);
  const file = useStudio((s) => s.library.find((f) => f.id === clip.audioFileId));
  const bpm = clip.sourceBpm ?? file?.analysis?.bpm;
  const key = clip.sourceKey ?? file?.analysis?.key;
  const peaks = file?.analysis?.waveform;

  const startTrim = (edge: "left" | "right", e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const originX = e.clientX;
    const start = clip.startBar;
    const len = clip.lengthBars;
    const movePtr = (ev: globalThis.PointerEvent) => {
      const delta = Math.round((ev.clientX - originX) / (PX * 4));
      if (edge === "right") {
        onTrim(clip.id, start, Math.max(1, len + delta));
        return;
      }
      const nextStart = Math.max(0, start + delta);
      const consumed = nextStart - start;
      onTrim(clip.id, nextStart, Math.max(1, len - consumed));
    };
    const up = () => {
      window.removeEventListener("pointermove", movePtr);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", movePtr);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="absolute top-1 h-14 rounded text-[10px] cursor-grab overflow-hidden"
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
        getEngine().timeline.clips = next;
      }}
    >
      {clip.kind === "audio" && peaks && peaks.length > 1 && <ClipWave peaks={peaks} />}
      <div className="relative z-10 px-2 h-full flex items-center gap-1 pointer-events-none">
        <span className="truncate font-medium drop-shadow">{clip.name}</span>
        {clip.kind === "audio" && (
          <>
            <span className="shrink-0 bg-black/20 rounded px-1 font-mono">
              {bpm ? `${Math.round(bpm)}` : "—"} {key ? key.split(" ")[0] : ""}
              {clip.stem ? ` · ${clip.stem}` : ""}
            </span>
            <button
              className={`pointer-events-auto shrink-0 rounded px-1 ${clip.keyFollow ? "bg-black text-mint" : "bg-black/20"}`}
              title={t("arrange.keyFollow")}
              onClick={(e) => {
                e.stopPropagation();
                useStudio.getState().toggleClipKeyFollow(clip.id, "timeline");
              }}
            >
              {t("arrange.keyFollowShort")}
            </button>
          </>
        )}
      </div>
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-20 bg-black/30"
        title={t("arrange.trim")}
        onPointerDown={(e) => startTrim("left", e)}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-20 bg-black/30"
        title={t("arrange.trim")}
        onPointerDown={(e) => startTrim("right", e)}
      />
    </div>
  );
}

function ClipWave({ peaks }: { peaks: number[] }) {
  const w = Math.max(peaks.length - 1, 1);
  const pts = peaks
    .map((p, i) => {
      const x = (i / w) * 100;
      const y = 50 - Math.max(0, Math.min(1, p)) * 42;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" stroke="#111" strokeWidth="1.4" points={pts} />
    </svg>
  );
}
