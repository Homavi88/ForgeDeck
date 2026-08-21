import { useEffect } from "react";
import { ProductionMixer } from "../mix/ProductionMixer";
import { AutomationLane } from "./AutomationLane";
import { t, useI18n } from "../../i18n";
import { ARRANGE_SNAPS, ARRANGE_ZOOMS, BAR_PX, snapBar } from "../../lib/clipEdit";
import { CORE_LANES, arrangeIdForMix, mixerIdForTrack } from "../../lib/mix";
import { peekStemDrag, peekTrackDrag, readStemDrag, readTrackDragId } from "../../lib/trackDrag";
import { useStudio } from "../../store/useStudio";
import type { TimelineClip } from "../../types";
import type { DragEvent, PointerEvent } from "react";

function trackIdAtPoint(x: number, y: number): string | null {
  const rows = document.querySelectorAll("[data-arrange-track]");
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) {
      return row.getAttribute("data-arrange-track");
    }
  }
  return null;
}

export function TimelinePanel() {
  const {
    clips,
    bpm,
    currentStep,
    library,
    prodLanes,
    selectedMixId,
    selectedClipId,
    arrangeZoom,
    arrangeSnap,
    frozenLanes,
    bounceRange,
    renderBusy,
    loopOn,
  } = useStudio();
  useI18n((s) => s.locale);
  const barPx = BAR_PX * arrangeZoom;
  const playhead = (currentStep / 16) * barPx;
  const lanes = [...CORE_LANES, ...prodLanes];
  const selected = clips.find((c) => c.id === selectedClipId) || null;
  const bars = 33;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const st = useStudio.getState();
      if (st.mode !== "arrange") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!st.selectedClipId) return;
        e.preventDefault();
        st.deleteSelectedClip();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        st.duplicateSelectedClip();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        st.copySelectedClip();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        st.pasteClip();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!st.selectedClipId) return;
        e.preventDefault();
        st.nudgeSelectedClip(e.key === "ArrowLeft" ? -st.arrangeSnap : st.arrangeSnap);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dropOnTrack = (trackId: string, e: DragEvent) => {
    e.preventDefault();
    const parent = e.currentTarget.getBoundingClientRect();
    const bar = snapBar((e.clientX - parent.left) / barPx, arrangeSnap);
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

  const zoomIdx = ARRANGE_ZOOMS.indexOf(arrangeZoom);

  return (
    <div className="flex-1 p-3 overflow-auto flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
          {t("arrange.title", { bpm })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            {t("arrange.snap")}
            <select
              className="bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
              value={String(arrangeSnap)}
              onChange={(e) => useStudio.getState().setArrangeSnap(Number(e.target.value) as (typeof ARRANGE_SNAPS)[number])}
            >
              <option value="1">{t("arrange.snapBar")}</option>
              <option value="0.25">{t("arrange.snapBeat")}</option>
              <option value="0.125">{t("arrange.snap8th")}</option>
            </select>
          </label>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            {t("arrange.zoom")}
            <button
              className="text-xs bg-ink-800 border border-line rounded px-1.5 py-0.5 disabled:opacity-40"
              disabled={zoomIdx <= 0}
              onClick={() => useStudio.getState().setArrangeZoom(ARRANGE_ZOOMS[Math.max(0, zoomIdx - 1)])}
            >
              {t("arrange.zoomOut")}
            </button>
            <span className="font-mono text-zinc-300 w-10 text-center">{Math.round(arrangeZoom * 100)}%</span>
            <button
              className="text-xs bg-ink-800 border border-line rounded px-1.5 py-0.5 disabled:opacity-40"
              disabled={zoomIdx < 0 || zoomIdx >= ARRANGE_ZOOMS.length - 1}
              onClick={() =>
                useStudio.getState().setArrangeZoom(ARRANGE_ZOOMS[Math.min(ARRANGE_ZOOMS.length - 1, zoomIdx + 1)])
              }
            >
              {t("arrange.zoomIn")}
            </button>
          </div>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={!selected}
            onClick={() => useStudio.getState().duplicateSelectedClip()}
          >
            {t("arrange.dup")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={!selected}
            onClick={() => useStudio.getState().copySelectedClip()}
          >
            {t("arrange.copy")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5"
            onClick={() => useStudio.getState().pasteClip()}
          >
            {t("arrange.paste")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={renderBusy || !!frozenLanes[selectedMixId]}
            title={t("arrange.freezeHint")}
            onClick={() => void useStudio.getState().freezeLane()}
          >
            {renderBusy ? t("arrange.freezing") : t("arrange.freeze")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={!frozenLanes[selectedMixId]}
            onClick={() => useStudio.getState().unfreezeLane()}
          >
            {t("arrange.unfreeze")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={renderBusy}
            title={t("arrange.flattenHint")}
            onClick={() => void useStudio.getState().flattenLane()}
          >
            {t("arrange.flatten")}
          </button>
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            {t("arrange.bounceFrom")}
            <input
              type="number"
              min={1}
              step={1}
              className="w-12 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
              value={bounceRange ? bounceRange.startBar + 1 : ""}
              placeholder="1"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  useStudio.getState().setBounceRange(bounceRange?.lengthBars ? { startBar: 0, lengthBars: bounceRange.lengthBars } : null);
                  return;
                }
                const startBar = Math.max(0, Number(raw) - 1);
                useStudio.getState().setBounceRange({ startBar, lengthBars: bounceRange?.lengthBars || 0 });
              }}
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            {t("arrange.bounceLen")}
            <input
              type="number"
              min={0}
              step={1}
              className="w-12 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
              value={bounceRange?.lengthBars ? bounceRange.lengthBars : ""}
              placeholder={t("arrange.bounceAuto")}
              onChange={(e) => {
                const raw = e.target.value;
                const lengthBars = raw === "" ? 0 : Number(raw);
                useStudio.getState().setBounceRange({ startBar: bounceRange?.startBar || 0, lengthBars });
              }}
            />
          </label>
          {selected && selected.kind === "audio" && (
            <>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {t("arrange.fadeIn")}
                <input
                  type="number"
                  min={0}
                  step={arrangeSnap}
                  className="w-14 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
                  value={Number((selected.fadeInBars || 0).toFixed(3))}
                  onChange={(e) =>
                    useStudio.getState().setClipFades(selected.id, Number(e.target.value) || 0, selected.fadeOutBars || 0)
                  }
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {t("arrange.fadeOut")}
                <input
                  type="number"
                  min={0}
                  step={arrangeSnap}
                  className="w-14 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
                  value={Number((selected.fadeOutBars || 0).toFixed(3))}
                  onChange={(e) =>
                    useStudio.getState().setClipFades(selected.id, selected.fadeInBars || 0, Number(e.target.value) || 0)
                  }
                />
              </label>
            </>
          )}
          {selected && selected.kind === "audio" && (
            <>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {t("arrange.gain")}
                <input
                  type="number"
                  min={0}
                  max={4}
                  step={0.05}
                  className="w-14 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
                  value={Number((selected.gain ?? 1).toFixed(2))}
                  onChange={(e) => useStudio.getState().setClipAudio(selected.id, { gain: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {t("arrange.transpose")}
                <input
                  type="number"
                  min={-24}
                  max={24}
                  step={1}
                  className="w-12 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
                  value={selected.transpose || 0}
                  onChange={(e) => useStudio.getState().setClipAudio(selected.id, { transpose: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {t("arrange.offset")}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-14 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
                  value={Number((selected.audioOffsetSec || 0).toFixed(3))}
                  onChange={(e) => useStudio.getState().setClipAudio(selected.id, { audioOffsetSec: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {t("arrange.xfade")}
                <input
                  type="number"
                  min={0}
                  step={arrangeSnap}
                  className="w-14 bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200"
                  value={Number((selected.crossfadeBars || 0).toFixed(3))}
                  onChange={(e) => useStudio.getState().setClipAudio(selected.id, { crossfadeBars: Number(e.target.value) || 0 })}
                />
              </label>
              <button
                className={`text-xs border border-line rounded px-2 py-0.5 ${selected.reverse ? "bg-accent text-black" : "bg-ink-800"}`}
                onClick={() => useStudio.getState().setClipAudio(selected.id, { reverse: !selected.reverse })}
              >
                {t("arrange.reverse")}
              </button>
            </>
          )}
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            <input
              type="checkbox"
              checked={loopOn}
              onChange={(e) => useStudio.getState().setLoopOn(e.target.checked)}
            />
            {t("arrange.loop")}
          </label>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5"
            title={t("arrange.tempoHint")}
            onClick={() => useStudio.getState().setTempoPoint(bounceRange?.startBar || 0, bpm)}
          >
            {t("arrange.tempoHere")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={renderBusy}
            onClick={() => void useStudio.getState().exportLane()}
          >
            {t("arrange.exportLane")}
          </button>
          <button
            className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
            disabled={renderBusy}
            onClick={() => void useStudio.getState().exportAllLanes()}
          >
            {t("arrange.exportAll")}
          </button>
          <button
            className="text-xs bg-accent text-black font-semibold px-2 py-1 rounded"
            onClick={() => useStudio.getState().addAudioLane()}
          >
            {t("arrange.addTrack")}
          </button>
        </div>
      </div>
      <div className="relative" style={{ minWidth: 96 + bars * barPx }}>
        <div className="flex text-[9px] text-zinc-600 mb-1 ml-24">
          {Array.from({ length: bars }).map((_, i) => (
            <div key={i} style={{ width: barPx }} className="border-l border-line pl-1 shrink-0">
              {i + 1}
            </div>
          ))}
        </div>
        {lanes.map((lane) => {
          const trackId = arrangeIdForMix(lane.id);
          const laneOn = selectedMixId === lane.id;
          return (
            <div
              key={lane.id}
              data-arrange-track={trackId}
              className={`flex h-16 border-b border-line relative ${laneOn ? "bg-ink-800/40" : ""}`}
            >
              <button
                className="w-24 shrink-0 text-xs pt-2 text-left px-1 truncate"
                style={{ color: lane.color }}
                onClick={() => {
                  useStudio.getState().selectMix(lane.id);
                  useStudio.getState().selectClip(null);
                }}
              >
                {lane.name}
                {frozenLanes[lane.id] ? <span className="ml-1 text-[9px] text-zinc-400">{t("arrange.frozenBadge")}</span> : null}
              </button>
              <div
                className="flex-1 relative bg-ink-900"
                onDragOver={(e) => {
                  if (peekTrackDrag(e.dataTransfer) || peekStemDrag(e.dataTransfer)) e.preventDefault();
                }}
                onDrop={(e) => dropOnTrack(trackId, e)}
                onClick={() => {
                  useStudio.getState().selectMix(lane.id);
                  useStudio.getState().selectClip(null);
                }}
              >
                {arrangeSnap < 1 &&
                  Array.from({ length: bars * (arrangeSnap === 0.125 ? 8 : 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-white/5 pointer-events-none"
                      style={{ left: i * barPx * arrangeSnap }}
                    />
                  ))}
                {clips
                  .filter((c) => c.trackId === trackId)
                  .map((c) => (
                    <ClipView key={c.id} clip={c} barPx={barPx} snap={arrangeSnap} selected={c.id === selectedClipId} />
                  ))}
              </div>
            </div>
          );
        })}
        <div className="absolute top-4 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: 96 + playhead }} />
      </div>
      <p className="text-xs text-zinc-500">{t("arrange.hint")}</p>
      <AutomationLane barPx={barPx} snap={arrangeSnap} bars={bars} bpm={bpm} />
      <ProductionMixer />
    </div>
  );
}

function ClipView({
  clip,
  barPx,
  snap,
  selected,
}: {
  clip: TimelineClip;
  barPx: number;
  snap: number;
  selected: boolean;
}) {
  useI18n((s) => s.locale);
  const file = useStudio((s) => s.library.find((f) => f.id === clip.audioFileId));
  const bpm = clip.sourceBpm ?? file?.analysis?.bpm;
  const key = clip.sourceKey ?? file?.analysis?.key;
  const peaks = file?.analysis?.waveform;
  const fadeIn = clip.fadeInBars || 0;
  const fadeOut = clip.fadeOutBars || 0;

  const startTrim = (edge: "left" | "right", e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    useStudio.getState().pushUndo();
    const originX = e.clientX;
    const start = clip.startBar;
    const len = clip.lengthBars;
    const movePtr = (ev: globalThis.PointerEvent) => {
      const delta = (ev.clientX - originX) / barPx;
      if (edge === "right") {
        useStudio.getState().trimClip(clip.id, start, Math.max(snap, len + delta));
        return;
      }
      const nextStart = Math.max(0, start + delta);
      const consumed = nextStart - start;
      useStudio.getState().trimClip(clip.id, nextStart, Math.max(snap, len - consumed));
    };
    const up = () => {
      window.removeEventListener("pointermove", movePtr);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", movePtr);
    window.addEventListener("pointerup", up);
  };

  const startFade = (edge: "in" | "out", e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    useStudio.getState().pushUndo();
    useStudio.getState().selectClip(clip.id);
    const originX = e.clientX;
    const fi0 = fadeIn;
    const fo0 = fadeOut;
    const movePtr = (ev: globalThis.PointerEvent) => {
      const delta = (ev.clientX - originX) / barPx;
      if (edge === "in") useStudio.getState().setClipFades(clip.id, Math.max(0, fi0 + delta), fo0);
      else useStudio.getState().setClipFades(clip.id, fi0, Math.max(0, fo0 - delta));
    };
    const up = () => {
      window.removeEventListener("pointermove", movePtr);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", movePtr);
    window.addEventListener("pointerup", up);
  };

  const startMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useStudio.getState().selectClip(clip.id);
    useStudio.getState().selectMix(mixerIdForTrack(clip.trackId));
    const originX = e.clientX;
    const originY = e.clientY;
    const start = clip.startBar;
    const originTrack = clip.trackId;
    let moved = false;
    const movePtr = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - originX) + Math.abs(ev.clientY - originY) < 4) return;
      if (!moved) {
        if (!ev.altKey) useStudio.getState().pushUndo();
        moved = true;
      }
      const bar = snapBar(start + (ev.clientX - originX) / barPx, snap);
      const trackId = trackIdAtPoint(ev.clientX, ev.clientY) || originTrack;
      if (ev.altKey) return;
      useStudio.getState().moveClip(clip.id, bar, trackId);
    };
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", movePtr);
      window.removeEventListener("pointerup", up);
      if (!moved) return;
      if (!ev.altKey) return;
      const bar = snapBar(start + (ev.clientX - originX) / barPx, snap);
      const trackId = trackIdAtPoint(ev.clientX, ev.clientY) || originTrack;
      useStudio.getState().copyClipToTrack(clip.id, bar, trackId);
    };
    window.addEventListener("pointermove", movePtr);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`absolute top-1 h-14 rounded text-[10px] cursor-grab overflow-hidden ${selected ? "ring-2 ring-white z-10" : ""}`}
      style={{ left: clip.startBar * barPx, width: Math.max(8, clip.lengthBars * barPx), background: clip.color, color: "#111" }}
      onPointerDown={startMove}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useStudio.getState().splitClipAtPlayhead(clip.id);
      }}
    >
      {clip.kind === "audio" && peaks && peaks.length > 1 && <ClipWave peaks={peaks} />}
      {fadeIn > 0 && (
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-black/55 to-transparent pointer-events-none z-[5]"
          style={{ width: `${Math.min(100, (fadeIn / clip.lengthBars) * 100)}%` }}
        />
      )}
      {fadeOut > 0 && (
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-black/55 to-transparent pointer-events-none z-[5]"
          style={{ width: `${Math.min(100, (fadeOut / clip.lengthBars) * 100)}%` }}
        />
      )}
      <div className="relative z-10 px-2 h-full flex items-center gap-1 pointer-events-none">
        <span className="truncate font-medium drop-shadow">{clip.name}</span>
        {clip.frozen && (
          <span className="shrink-0 bg-black/30 rounded px-1 font-mono uppercase">{t("arrange.frozenBadge")}</span>
        )}
        {clip.kind === "audio" && (
          <>
            <span className="shrink-0 bg-black/20 rounded px-1 font-mono">
              {bpm ? `${Math.round(bpm)}` : "—"} {key ? key.split(" ")[0] : ""}
              {clip.stem ? ` · ${clip.stem}` : ""}
            </span>
            <button
              className={`pointer-events-auto shrink-0 rounded px-1 ${clip.keyFollow ? "bg-black text-mint" : "bg-black/20"}`}
              title={t("arrange.keyFollow")}
              onPointerDown={(e) => e.stopPropagation()}
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
      {clip.kind === "audio" && (
        <>
          <div
            className="absolute left-1 top-0 w-0 h-0 z-30 cursor-ew-resize border-t-[10px] border-t-black/70 border-r-[10px] border-r-transparent"
            title={t("arrange.fadeIn")}
            onPointerDown={(e) => startFade("in", e)}
          />
          <div
            className="absolute right-1 top-0 w-0 h-0 z-30 cursor-ew-resize border-t-[10px] border-t-black/70 border-l-[10px] border-l-transparent"
            title={t("arrange.fadeOut")}
            onPointerDown={(e) => startFade("out", e)}
          />
        </>
      )}
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
