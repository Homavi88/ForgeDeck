import type { TimelineClip } from "../types";

/** One bar at zoom 1 (4 beats × 28 px). */
export const BAR_PX = 112;

export const ARRANGE_SNAPS = [1, 0.25, 0.125] as const;
export type ArrangeSnap = (typeof ARRANGE_SNAPS)[number];

export const ARRANGE_ZOOMS = [0.5, 1, 2, 3] as const;
export type ArrangeZoom = (typeof ARRANGE_ZOOMS)[number];

export function normalizeSnap(v: unknown): ArrangeSnap {
  return v === 1 || v === 0.25 || v === 0.125 ? v : 0.25;
}

export function normalizeZoom(v: unknown): ArrangeZoom {
  return v === 0.5 || v === 1 || v === 2 || v === 3 ? v : 1;
}

export function snapBar(v: number, snap: number): number {
  if (!(snap > 0) || !Number.isFinite(v)) return Math.max(0, v || 0);
  return Math.max(0, Math.round(v / snap) * snap);
}

export function minClipLength(snap: number): number {
  return snap > 0 ? snap : 0.125;
}

export function clampFades(
  lengthBars: number,
  fadeInBars = 0,
  fadeOutBars = 0,
): { fadeInBars: number; fadeOutBars: number } {
  const len = Math.max(0.001, lengthBars);
  let fi = Math.max(0, fadeInBars);
  let fo = Math.max(0, fadeOutBars);
  if (fi + fo > len) {
    const s = len / (fi + fo);
    fi *= s;
    fo *= s;
  }
  return { fadeInBars: fi, fadeOutBars: fo };
}

export function duplicateClip(clip: TimelineClip): TimelineClip {
  return {
    ...clip,
    id: crypto.randomUUID(),
    startBar: clip.startBar + clip.lengthBars,
  };
}

export function cloneClipTo(clip: TimelineClip, startBar: number, trackId: string): TimelineClip {
  return {
    ...clip,
    id: crypto.randomUUID(),
    startBar: Math.max(0, startBar),
    trackId,
  };
}

export function clipContainsBar(clip: TimelineClip, bar: number): boolean {
  return bar > clip.startBar && bar < clip.startBar + clip.lengthBars;
}

export function splitClipAt(clip: TimelineClip, atBar: number): TimelineClip[] | null {
  if (!clipContainsBar(clip, atBar)) return null;
  const leftLen = atBar - clip.startBar;
  const left: TimelineClip = { ...clip, lengthBars: leftLen };
  const right: TimelineClip = {
    ...clip,
    id: crypto.randomUUID(),
    startBar: atBar,
    lengthBars: clip.startBar + clip.lengthBars - atBar,
  };
  return [left, right];
}
