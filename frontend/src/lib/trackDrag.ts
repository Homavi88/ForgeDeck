import type { AudioFile } from "../types";

export const TRACK_DRAG_MIME = "application/x-forgedeck-track";
export const STEM_DRAG_MIME = "application/x-forgedeck-stem";

export type StemDrag = { audioFileId: string; stem: string; name?: string };

export function setTrackDrag(dt: DataTransfer, file: AudioFile): void {
  dt.setData(TRACK_DRAG_MIME, JSON.stringify({ id: file.id }));
  dt.setData("text/plain", `forgedeck:${file.id}`);
  dt.effectAllowed = "copy";
}

export function setStemDrag(dt: DataTransfer, payload: StemDrag): void {
  dt.setData(STEM_DRAG_MIME, JSON.stringify(payload));
  dt.setData("text/plain", `forgedeck-stem:${payload.audioFileId}:${payload.stem}`);
  dt.effectAllowed = "copy";
}

export function peekTrackDrag(dt: DataTransfer): boolean {
  return dt.types.includes(TRACK_DRAG_MIME) || dt.types.includes("text/plain") || dt.types.includes("Files");
}

export function peekStemDrag(dt: DataTransfer): boolean {
  return dt.types.includes(STEM_DRAG_MIME);
}

export function readTrackDragId(dt: DataTransfer): string | null {
  const raw = dt.getData(TRACK_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id?: string };
      if (parsed.id) return parsed.id;
    } catch {
      /* fall through */
    }
  }
  const plain = dt.getData("text/plain");
  if (plain.startsWith("forgedeck:") && !plain.startsWith("forgedeck-stem:")) {
    return plain.slice("forgedeck:".length);
  }
  return null;
}

export function readStemDrag(dt: DataTransfer): StemDrag | null {
  const raw = dt.getData(STEM_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StemDrag;
      if (parsed.audioFileId && parsed.stem) return parsed;
    } catch {
      /* fall through */
    }
  }
  const plain = dt.getData("text/plain");
  if (plain.startsWith("forgedeck-stem:")) {
    const rest = plain.slice("forgedeck-stem:".length);
    const i = rest.indexOf(":");
    if (i > 0) return { audioFileId: rest.slice(0, i), stem: rest.slice(i + 1) };
  }
  return null;
}
