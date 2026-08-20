import type { AudioFile } from "../types";

export const TRACK_DRAG_MIME = "application/x-forgedeck-track";

export function setTrackDrag(dt: DataTransfer, file: AudioFile): void {
  dt.setData(TRACK_DRAG_MIME, JSON.stringify({ id: file.id }));
  dt.setData("text/plain", `forgedeck:${file.id}`);
  dt.effectAllowed = "copy";
}

export function peekTrackDrag(dt: DataTransfer): boolean {
  return dt.types.includes(TRACK_DRAG_MIME) || dt.types.includes("text/plain") || dt.types.includes("Files");
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
  if (plain.startsWith("forgedeck:")) return plain.slice("forgedeck:".length);
  return null;
}
