/** Minimal Standard MIDI File (type 0/1) read/write for the piano roll. */

import type { MidiNote } from "../types";

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function vlq(n: number): number[] {
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}

function readVlq(view: DataView, offset: { i: number }): number {
  let v = 0;
  for (let k = 0; k < 4; k++) {
    const b = view.getUint8(offset.i++);
    v = (v << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return v;
}

export function notesToMidi(notes: MidiNote[], ppq = 96): Uint8Array {
  const ticksPerStep = ppq / 4;
  type Ev = { t: number; on: boolean; pitch: number; vel: number };
  const ev: Ev[] = [];
  for (const n of notes) {
    const start = Math.max(0, Math.round(n.startStep * ticksPerStep));
    const end = Math.max(start + 1, Math.round((n.startStep + Math.max(1, n.length)) * ticksPerStep));
    ev.push({ t: start, on: true, pitch: n.pitch, vel: Math.round(Math.max(1, Math.min(127, (n.velocity || 0.8) * 127))) });
    ev.push({ t: end, on: false, pitch: n.pitch, vel: 0 });
  }
  ev.sort((a, b) => a.t - b.t || Number(b.on) - Number(a.on));
  const body: number[] = [];
  let t = 0;
  for (const e of ev) {
    body.push(...vlq(e.t - t));
    t = e.t;
    body.push(e.on ? 0x90 : 0x80, e.pitch & 0x7f, e.vel & 0x7f);
  }
  body.push(...vlq(0), 0xff, 0x2f, 0x00);
  const track = new Uint8Array(8 + body.length);
  track.set([0x4d, 0x54, 0x72, 0x6b]);
  track.set(u32(body.length), 4);
  track.set(body, 8);
  const header = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff]);
  const out = new Uint8Array(header.length + track.length);
  out.set(header);
  out.set(track, header.length);
  return out;
}

export function midiToNotes(bytes: ArrayBuffer): MidiNote[] {
  const view = new DataView(bytes);
  if (view.byteLength < 14) return [];
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "MThd") return [];
  const ntrks = view.getUint16(10);
  const division = view.getUint16(12);
  const ppq = division & 0x7fff || 96;
  let i = 8 + view.getUint32(4);
  const notes: MidiNote[] = [];
  const open = new Map<number, { start: number; vel: number }>();
  const ticksPerStep = ppq / 4;
  for (let tr = 0; tr < ntrks && i + 8 <= view.byteLength; tr++) {
    const tag = String.fromCharCode(view.getUint8(i), view.getUint8(i + 1), view.getUint8(i + 2), view.getUint8(i + 3));
    const len = view.getUint32(i + 4);
    i += 8;
    if (tag !== "MTrk") {
      i += len;
      continue;
    }
    const end = Math.min(view.byteLength, i + len);
    const cur = { i };
    let abs = 0;
    let running = 0;
    while (cur.i < end) {
      abs += readVlq(view, cur);
      if (cur.i >= end) break;
      let st = view.getUint8(cur.i);
      if (st < 0x80) st = running;
      else cur.i++;
      running = st;
      const cmd = st & 0xf0;
      if (st === 0xff) {
        cur.i++;
        const n = readVlq(view, cur);
        cur.i += n;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        const n = readVlq(view, cur);
        cur.i += n;
        continue;
      }
      if (cmd === 0x90 || cmd === 0x80) {
        const pitch = view.getUint8(cur.i++);
        const vel = view.getUint8(cur.i++);
        const step = abs / ticksPerStep;
        if (cmd === 0x90 && vel > 0) open.set(pitch, { start: step, vel });
        else {
          const on = open.get(pitch);
          if (on) {
            notes.push({
              id: crypto.randomUUID(),
              pitch,
              startStep: on.start,
              length: Math.max(1, step - on.start),
              velocity: on.vel / 127,
            });
            open.delete(pitch);
          }
        }
        continue;
      }
      if (cmd === 0xc0 || cmd === 0xd0) cur.i += 1;
      else cur.i += 2;
    }
    i = end;
  }
  return notes;
}
