import { MixerPanel } from "../dj/MixerPanel";
import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";
import { peekStemDrag, peekTrackDrag, readStemDrag, readTrackDragId } from "../../lib/trackDrag";
import { useStudio } from "../../store/useStudio";
import type { TimelineClip } from "../../types";
import type { DragEvent } from "react";

const TRACK_IDS = [
  { id: "drums", nameKey: "session.drums", color: "#ff6a00" },
  { id: "synth", nameKey: "session.synth", color: "#3dfff3" },
  { id: "deckA", nameKey: "session.deckA", color: "#3dff7a" },
  { id: "deckB", nameKey: "session.deckB", color: "#ffd23f" },
] as const;

const PX = 28;

export function TimelinePanel() {
  const { clips, bpm, currentStep, library } = useStudio();
  const playhead = (currentStep / 16) * PX * 4;
  useI18n((s) => s.locale);

  const move = (id: string, startBar: number) => {
    const next = clips.map((c) => (c.id === id ? { ...c, startBar: Math.max(0, startBar) } : c));
    useStudio.setState({ clips: next });
    getEngine().timeline.clips = next;
  };

  const trim = (id: string, lengthBars: number) => {
    const next = clips.map((c) => (c.id === id ? { ...c, lengthBars: Math.max(1, lengthBars) } : c));
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
    <div className="flex-1 p-3 overflow-auto">
      <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">
        {t("arrange.title", { bpm })}
      </div>
      <div className="relative min-w-[1200px]">
        <div className="flex text-[9px] text-zinc-600 mb-1 ml-24">
          {Array.from({ length: 33 }).map((_, i) => (
            <div key={i} style={{ width: PX * 4 }} className="border-l border-line pl-1">
              {i + 1}
            </div>
          ))}
        </div>
        {TRACK_IDS.map((tr) => (
          <div key={tr.id} className="flex h-14 border-b border-line relative">
            <div className="w-24 shrink-0 text-xs pt-2 text-zinc-400">{t(tr.nameKey)}</div>
            <div
              className="flex-1 relative bg-ink-900"
              onDragOver={(e) => {
                if (peekTrackDrag(e.dataTransfer) || peekStemDrag(e.dataTransfer)) e.preventDefault();
              }}
              onDrop={(e) => dropOnTrack(tr.id, e)}
            >
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
              name: t("arrange.clip"),
              startBar: 0,
              lengthBars: 4,
              color: "#3dfff3",
            };
            useStudio.setState({ clips: [...clips, clip] });
          }}
        >
          {t("arrange.addClip")}
        </button>
        <p className="text-xs text-zinc-500">{t("arrange.hint")}</p>
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
  useI18n((s) => s.locale);
  if (!automation.length) {
    return <p className="text-xs text-zinc-600 mt-3">{t("arrange.autoEmpty")}</p>;
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
  useI18n((s) => s.locale);
  const file = useStudio((s) => s.library.find((f) => f.id === clip.audioFileId));
  const bpm = clip.sourceBpm ?? file?.analysis?.bpm;
  const key = clip.sourceKey ?? file?.analysis?.key;
  return (
    <div
      className="absolute top-1 h-10 rounded text-[10px] px-2 flex items-center gap-1 cursor-grab overflow-hidden"
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
      onWheel={(e) => {
        e.preventDefault();
        onTrim(clip.id, clip.lengthBars + (e.deltaY > 0 ? -1 : 1));
      }}
    >
      <span className="truncate font-medium">{clip.name}</span>
      {clip.kind === "audio" && (
        <>
          <span className="shrink-0 bg-black/20 rounded px-1 font-mono">
            {bpm ? `${Math.round(bpm)}` : "—"} {key ? key.split(" ")[0] : ""}
            {clip.stem ? ` · ${clip.stem}` : ""}
          </span>
          <button
            className={`shrink-0 rounded px-1 ${clip.keyFollow ? "bg-black text-mint" : "bg-black/20"}`}
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
  );
}
