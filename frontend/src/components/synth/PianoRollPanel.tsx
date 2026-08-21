import { useEffect, useMemo, useRef, useState } from "react";
import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n, type MsgKey } from "../../i18n";
import {
  CHORD_STAMPS,
  SCALE_IDS,
  inScale,
  isBlackKey,
  midiName,
  scalePitchClasses,
  type ChordStampId,
  type ScaleId,
} from "../../lib/musicTheory";
import {
  ARP_MODES,
  COL_W,
  KEY_W,
  PIANO_HIGH,
  PIANO_LOW,
  ROW_H,
  SNAP_OPTIONS,
  arpeggiate,
  clampNote,
  duplicateNotes,
  hitResize,
  humanizeVelocity,
  marqueeIds,
  noteAt,
  pasteNotes,
  quantizeNotes,
  setVelocities,
  shiftNotes,
  snapFloor,
  stampChord,
  strumNotes,
  type ArpMode,
} from "../../lib/pianoRoll";
import { useStudio } from "../../store/useStudio";
import type { MidiNote } from "../../types";

type Tool = "draw" | "select" | "stamp";
type Drag =
  | { kind: "draw"; id: string; start: number }
  | { kind: "move"; ids: string[]; originStep: number; originPitch: number; notes: MidiNote[] }
  | { kind: "resize"; id: string; origin: MidiNote }
  | { kind: "marquee"; pitch: number; step: number };

const TOOL_KEYS: Record<Tool, MsgKey> = {
  draw: "piano.draw",
  select: "piano.select",
  stamp: "piano.stamp",
};

const SCALE_KEYS: Record<ScaleId, MsgKey> = {
  chromatic: "piano.scales.chromatic",
  diatonic: "piano.scales.diatonic",
  pentMin: "piano.scales.pentMin",
  pentMaj: "piano.scales.pentMaj",
  blues: "piano.scales.blues",
  dorian: "piano.scales.dorian",
  mixolydian: "piano.scales.mixolydian",
  harmonicMinor: "piano.scales.harmonicMinor",
};

const ARP_KEYS: Record<ArpMode, MsgKey> = {
  up: "piano.arpUp",
  down: "piano.arpDown",
  upDown: "piano.arpUpDown",
  random: "piano.arpRandom",
};

let clipboard: MidiNote[] = [];

const PITCHES: number[] = [];
for (let p = PIANO_HIGH; p >= PIANO_LOW; p--) PITCHES.push(p);

function commit(notes: MidiNote[]): void {
  useStudio.getState().writeNotes(notes);
}

function cellFromEvent(el: HTMLElement, e: { clientX: number; clientY: number }, loop: number) {
  const r = el.getBoundingClientRect();
  const step = Math.max(0, Math.min(loop - 1, Math.floor((e.clientX - r.left) / COL_W)));
  const row = Math.max(0, Math.min(PITCHES.length - 1, Math.floor((e.clientY - r.top) / ROW_H)));
  return { step, pitch: PITCHES[row] };
}

export function PianoRollPanel() {
  const {
    notes,
    drumLength,
    currentStep,
    pushUndo,
    musicalKey,
    playing,
    midiPatterns,
    activeMidiPatternId,
    ghostNotes,
  } = useStudio();
  useI18n((s) => s.locale);
  const loop = drumLength;
  const [tool, setTool] = useState<Tool>("draw");
  const [snap, setSnap] = useState(1);
  const [scaleId, setScaleId] = useState<ScaleId>("diatonic");
  const [stamp, setStamp] = useState<ChordStampId>("min");
  const [arpMode, setArpMode] = useState<ArpMode>("up");
  const [arpOct, setArpOct] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [scrollX, setScrollX] = useState(0);
  const [marquee, setMarquee] = useState<{ a: { pitch: number; step: number }; b: { pitch: number; step: number } } | null>(
    null,
  );
  const drag = useRef<Drag | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pcs = useMemo(() => scalePitchClasses(musicalKey, scaleId), [musicalKey, scaleId]);
  const playStep = currentStep % loop;
  const ids = selected.size ? selected : new Set(notes.map((n) => n.id));
  const ghosts = useMemo(
    () =>
      ghostNotes
        ? midiPatterns
            .filter((p) => p.id !== activeMidiPatternId)
            .flatMap((p) => p.notes)
            .filter((n) => n.startStep < loop)
        : [],
    [ghostNotes, midiPatterns, activeMidiPatternId, loop],
  );

  useEffect(() => {
    getEngine().piano.setLoopSteps(loop);
  }, [loop]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = PITCHES.indexOf(72);
    if (idx >= 0) el.scrollTop = Math.max(0, idx * ROW_H - 80);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (useStudio.getState().mode !== "synth") return;
      const loopNow = useStudio.getState().drumLength;
      const cur = useStudio.getState().notes;
      const sel = selected;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!sel.size) return;
        e.preventDefault();
        pushUndo();
        commit(cur.filter((n) => !sel.has(n.id)));
        setSelected(new Set());
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(cur.map((n) => n.id)));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        clipboard = cur.filter((n) => sel.has(n.id)).map((n) => ({ ...n }));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pushUndo();
        const at = snapFloor(useStudio.getState().currentStep % loopNow, snap);
        const next = pasteNotes(cur, clipboard, at, loopNow);
        commit(next);
        setSelected(new Set(next.filter((n) => !cur.some((o) => o.id === n.id)).map((n) => n.id)));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!sel.size) return;
        pushUndo();
        const next = duplicateNotes(cur, sel, loopNow);
        commit(next);
        setSelected(new Set(next.filter((n) => !cur.some((o) => o.id === n.id)).map((n) => n.id)));
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!sel.size) return;
        e.preventDefault();
        pushUndo();
        const dStep = e.key === "ArrowLeft" ? -snap : e.key === "ArrowRight" ? snap : 0;
        const dPitch = e.key === "ArrowDown" ? -1 : e.key === "ArrowUp" ? 1 : 0;
        const oct = e.shiftKey && dPitch ? dPitch * 11 : 0;
        commit(shiftNotes(cur, sel, dStep, dPitch + oct, loopNow));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, snap, pushUndo]);

  useEffect(() => {
    const up = () => {
      if (drag.current) {
        try {
          getEngine().synth.allOff();
        } catch {
          /* engine may not be ready */
        }
      }
      drag.current = null;
      setMarquee(null);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const applyDrag = (step: number, pitch: number) => {
    const d = drag.current;
    if (!d) return;
    const cur = useStudio.getState().notes;
    if (d.kind === "draw") {
      const length = Math.max(snap, step - d.start + 1);
      commit(cur.map((x) => (x.id === d.id ? clampNote({ ...x, length }, loop) : x)));
    } else if (d.kind === "move") {
      const ds = step - d.originStep;
      const dp = pitch - d.originPitch;
      commit(
        d.notes.map((n) =>
          d.ids.includes(n.id) ? clampNote({ ...n, startStep: n.startStep + ds, pitch: n.pitch + dp }, loop) : n,
        ),
      );
    } else if (d.kind === "resize") {
      const length = Math.max(1, step - d.origin.startStep + 1);
      commit(cur.map((n) => (n.id === d.id ? clampNote({ ...n, length }, loop) : n)));
    } else if (d.kind === "marquee") {
      setMarquee({ a: { pitch: d.pitch, step: d.step }, b: { pitch, step } });
      setSelected(new Set(marqueeIds(cur, d.pitch, pitch, d.step, step)));
    }
  };

  const onGridPointer = (e: React.PointerEvent) => {
    if (!gridRef.current || e.button !== 0) return;
    const { step, pitch } = cellFromEvent(gridRef.current, e, loop);
    const snapped = snapFloor(step, snap);
    const hit = noteAt(notes, pitch, step);

    if (e.altKey) {
      const ghost = noteAt(ghosts, pitch, step);
      if (ghost) {
        pushUndo();
        commit([...notes, clampNote({ ...ghost, id: crypto.randomUUID() }, loop)]);
        return;
      }
    }

    if (tool === "stamp") {
      pushUndo();
      commit(stampChord(notes, pitch, snapped, Math.max(snap, 4), stamp, loop));
      return;
    }

    if (tool === "select" && !hit) {
      drag.current = { kind: "marquee", pitch, step };
      setSelected(new Set());
      setMarquee({ a: { pitch, step }, b: { pitch, step } });
      return;
    }

    if (hit && hitResize(hit, step)) {
      pushUndo();
      drag.current = { kind: "resize", id: hit.id, origin: hit };
      setSelected(new Set([hit.id]));
      return;
    }

    if (hit) {
      const nextSel = e.shiftKey ? new Set(selected) : selected.has(hit.id) ? selected : new Set<string>();
      if (!nextSel.has(hit.id)) nextSel.add(hit.id);
      if (!e.shiftKey && !selected.has(hit.id)) {
        nextSel.clear();
        nextSel.add(hit.id);
      }
      setSelected(new Set(nextSel));
      pushUndo();
      drag.current = {
        kind: "move",
        ids: [...nextSel],
        originStep: step,
        originPitch: pitch,
        notes: notes.map((n) => ({ ...n })),
      };
      void useStudio.getState().bootAudio().then(() => getEngine().synth.noteOn(pitch, hit.velocity));
      return;
    }

    if (tool === "draw") {
      pushUndo();
      const note: MidiNote = clampNote(
        { id: crypto.randomUUID(), pitch, startStep: snapped, length: snap, velocity: 0.8 },
        loop,
      );
      commit([...notes, note]);
      setSelected(new Set([note.id]));
      drag.current = { kind: "draw", id: note.id, start: snapped };
      void useStudio.getState().bootAudio().then(() => getEngine().synth.noteOn(pitch, 0.8));
    }
  };

  const onVelPointer = (e: React.PointerEvent, lane: HTMLDivElement) => {
    if (e.button !== 0) return;
    const r = lane.getBoundingClientRect();
    const setAt = (clientX: number, clientY: number) => {
      const step = Math.max(0, Math.min(loop - 1, Math.floor((clientX - r.left) / COL_W)));
      const vel = Math.max(0.05, Math.min(1, 1 - (clientY - r.top) / r.height));
      const targets = notes.filter((n) => n.startStep === step && (selected.size === 0 || selected.has(n.id)));
      if (!targets.length) return;
      commit(setVelocities(notes, new Set(targets.map((n) => n.id)), vel));
    };
    pushUndo();
    setAt(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => setAt(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex-1 min-h-[320px] flex flex-col border border-line rounded overflow-hidden bg-ink-950">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-line bg-ink-900 text-[10px] uppercase tracking-wider text-zinc-500">
        <span className="mr-1">{t("piano.title", { n: loop })}</span>
        {(["draw", "select", "stamp"] as const).map((id) => (
          <button
            key={id}
            className={`px-2 py-0.5 rounded ${tool === id ? "bg-accent text-black" : "bg-ink-700 text-zinc-300"}`}
            onClick={() => setTool(id)}
          >
            {t(TOOL_KEYS[id])}
          </button>
        ))}
        {tool === "stamp" &&
          CHORD_STAMPS.map((c) => (
            <button
              key={c.id}
              className={`px-1.5 py-0.5 rounded ${stamp === c.id ? "bg-cyan text-black" : "bg-ink-800 text-zinc-400"}`}
              onClick={() => setStamp(c.id)}
            >
              {c.id}
            </button>
          ))}
        <label className="ml-1 flex items-center gap-1">
          {t("piano.snap")}
          <select
            className="bg-ink-800 border border-line rounded px-1 py-0.5 text-zinc-200"
            value={snap}
            onChange={(e) => setSnap(Number(e.target.value))}
          >
            {SNAP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1/16" : n === 2 ? "1/8" : "1/4"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          {t("piano.scale")}
          <select
            className="bg-ink-800 border border-line rounded px-1 py-0.5 text-zinc-200"
            value={scaleId}
            onChange={(e) => setScaleId(e.target.value as ScaleId)}
          >
            {SCALE_IDS.map((id) => (
              <option key={id} value={id}>
                {t(SCALE_KEYS[id])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          {t("piano.pattern")}
          <select
            className="bg-ink-800 border border-line rounded px-1 py-0.5 text-zinc-200"
            value={activeMidiPatternId}
            onChange={(e) => {
              setSelected(new Set());
              useStudio.getState().selectMidiPattern(e.target.value);
            }}
          >
            {midiPatterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="px-1.5 py-0.5 rounded bg-ink-700 text-zinc-300"
          title={t("piano.patternAdd")}
          onClick={() => {
            setSelected(new Set());
            useStudio.getState().addMidiPattern();
          }}
        >
          +
        </button>
        {midiPatterns.length > 1 && (
          <button
            className="px-1.5 py-0.5 rounded bg-ink-700 text-zinc-300"
            title={t("piano.patternDel")}
            onClick={() => {
              setSelected(new Set());
              useStudio.getState().removeMidiPattern(activeMidiPatternId);
            }}
          >
            ×
          </button>
        )}
        <button
          className={`px-2 py-0.5 rounded ${ghostNotes ? "bg-mint text-black" : "bg-ink-700 text-zinc-300"}`}
          onClick={() => useStudio.getState().setGhostNotes(!ghostNotes)}
        >
          {t("piano.ghost")}
        </button>
        <label className="flex items-center gap-1">
          {t("piano.length")}
          <select
            className="bg-ink-800 border border-line rounded px-1 py-0.5 text-zinc-200"
            value={loop}
            onChange={(e) => {
              const length = Number(e.target.value);
              getEngine().drums.length = length;
              getEngine().piano.setLoopSteps(length);
              useStudio.setState({ drumLength: length });
            }}
          >
            {[16, 32, 64].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (!notes.length) return;
            pushUndo();
            commit(quantizeNotes(notes, ids, snap, loop));
          }}
        >
          {t("piano.quantize")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (!notes.length) return;
            pushUndo();
            commit(humanizeVelocity(notes, ids));
          }}
        >
          {t("piano.humanize")}
        </button>
        <label className="flex items-center gap-1">
          {t("piano.arp")}
          <select
            className="bg-ink-800 border border-line rounded px-1 py-0.5 text-zinc-200"
            value={arpMode}
            onChange={(e) => setArpMode(e.target.value as ArpMode)}
          >
            {ARP_MODES.map((id) => (
              <option key={id} value={id}>
                {t(ARP_KEYS[id])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-zinc-400">
          <input type="checkbox" checked={arpOct > 1} onChange={(e) => setArpOct(e.target.checked ? 2 : 1)} />
          {t("piano.arpOct")}
        </label>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (!ids.size) return;
            pushUndo();
            const next = arpeggiate(notes, ids, arpMode, snap, arpOct, loop);
            commit(next);
            setSelected(new Set());
          }}
        >
          {t("piano.arpGo")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (ids.size < 2) return;
            pushUndo();
            commit(strumNotes(notes, ids, 1, true, loop));
          }}
        >
          {t("piano.strumUp")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (ids.size < 2) return;
            pushUndo();
            commit(strumNotes(notes, ids, 1, false, loop));
          }}
        >
          {t("piano.strumDown")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (!selected.size) return;
            pushUndo();
            const next = duplicateNotes(notes, selected, loop);
            commit(next);
          }}
        >
          {t("piano.dup")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (!selected.size) return;
            pushUndo();
            commit(shiftNotes(notes, selected, 0, 12, loop));
          }}
        >
          {t("piano.octUp")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            if (!selected.size) return;
            pushUndo();
            commit(shiftNotes(notes, selected, 0, -12, loop));
          }}
        >
          {t("piano.octDown")}
        </button>
        <button
          className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300"
          onClick={() => {
            pushUndo();
            commit([]);
            setSelected(new Set());
          }}
        >
          {t("piano.clear")}
        </button>
        <label className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300 cursor-pointer">
          {t("piano.importMidi")}
          <input
            type="file"
            accept=".mid,.midi,audio/midi"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void useStudio.getState().importMidiFile(file);
            }}
          />
        </label>
        <button className="px-2 py-0.5 rounded bg-ink-700 text-zinc-300" onClick={() => useStudio.getState().exportMidiFile()}>
          {t("piano.exportMidi")}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto"
        onScroll={(e) => setScrollX((e.target as HTMLDivElement).scrollLeft)}
      >
        <div className="flex" style={{ width: KEY_W + loop * COL_W, height: PITCHES.length * ROW_H }}>
          <div className="sticky left-0 z-20 shrink-0 bg-ink-900 border-r border-line" style={{ width: KEY_W }}>
            {PITCHES.map((p) => {
              const black = isBlackKey(p);
              const ok = inScale(p, pcs);
              return (
                <button
                  key={p}
                  className={`block w-full text-left px-1 font-mono text-[9px] border-b border-line ${
                    black ? "bg-zinc-950 text-zinc-500" : "bg-zinc-200 text-zinc-800"
                  } ${ok ? "" : "opacity-40"}`}
                  style={{ height: ROW_H }}
                  onMouseDown={() => {
                    void useStudio.getState().bootAudio().then(() => getEngine().synth.noteOn(p));
                  }}
                  onMouseUp={() => getEngine().synth.noteOff(p)}
                  onMouseLeave={() => getEngine().synth.noteOff(p)}
                >
                  {p % 12 === 0 ? midiName(p) : black ? "" : ""}
                </button>
              );
            })}
          </div>
          <div
            ref={gridRef}
            className="relative select-none"
            style={{
              width: loop * COL_W,
              height: PITCHES.length * ROW_H,
              backgroundImage: [
                `repeating-linear-gradient(90deg, transparent 0, transparent ${COL_W - 1}px, #2e2e38 ${COL_W - 1}px, #2e2e38 ${COL_W}px)`,
                `repeating-linear-gradient(180deg, transparent 0, transparent ${ROW_H - 1}px, #2e2e38 ${ROW_H - 1}px, #2e2e38 ${ROW_H}px)`,
              ].join(","),
            }}
            onPointerDown={onGridPointer}
            onPointerMove={(e) => {
              if (!drag.current || !gridRef.current) return;
              const { step, pitch } = cellFromEvent(gridRef.current, e, loop);
              applyDrag(step, pitch);
            }}
            onPointerUp={() => getEngine().synth.allOff()}
          >
            {PITCHES.map((p, i) => {
              const black = isBlackKey(p);
              const ok = inScale(p, pcs);
              return (
                <div
                  key={p}
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: i * ROW_H,
                    height: ROW_H,
                    background: black ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.03)",
                    boxShadow: ok && scaleId !== "chromatic" ? "inset 3px 0 0 #3dff7a55" : undefined,
                  }}
                />
              );
            })}
            {Array.from({ length: loop }).map((_, i) =>
              i % 4 === 0 ? (
                <div
                  key={`b${i}`}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: i * COL_W,
                    width: 1,
                    background: i % 16 === 0 ? "rgba(255,106,0,0.45)" : "rgba(255,255,255,0.12)",
                  }}
                />
              ) : null,
            )}
            {ghosts.map((n) => (
              <div
                key={`g-${n.id}`}
                className="absolute rounded-[2px] border border-mint/40 bg-mint/20 pointer-events-none"
                style={{
                  left: n.startStep * COL_W + 1,
                  top: (PIANO_HIGH - n.pitch) * ROW_H + 1,
                  width: n.length * COL_W - 2,
                  height: ROW_H - 2,
                  opacity: 0.35,
                }}
              />
            ))}
            {notes.map((n) => {
              const y = (PIANO_HIGH - n.pitch) * ROW_H;
              const sel = selected.has(n.id);
              return (
                <div
                  key={n.id}
                  className={`absolute rounded-[2px] border pointer-events-none ${
                    sel ? "bg-cyan border-white" : "bg-accent border-orange-300"
                  }`}
                  style={{
                    left: n.startStep * COL_W + 1,
                    top: y + 1,
                    width: n.length * COL_W - 2,
                    height: ROW_H - 2,
                    opacity: 0.45 + n.velocity * 0.55,
                  }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-black/40" />
                </div>
              );
            })}
            {playing || currentStep > 0 ? (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-mint pointer-events-none z-10"
                style={{ left: playStep * COL_W }}
              />
            ) : null}
            {marquee ? (
              <div
                className="absolute border border-cyan/80 bg-cyan/10 pointer-events-none z-10"
                style={{
                  left: Math.min(marquee.a.step, marquee.b.step) * COL_W,
                  top: (PIANO_HIGH - Math.max(marquee.a.pitch, marquee.b.pitch)) * ROW_H,
                  width: (Math.abs(marquee.b.step - marquee.a.step) + 1) * COL_W,
                  height: (Math.abs(marquee.b.pitch - marquee.a.pitch) + 1) * ROW_H,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="h-14 border-t border-line bg-ink-900 flex overflow-hidden shrink-0">
        <div className="shrink-0 border-r border-line text-[9px] uppercase text-zinc-500 flex items-center justify-center" style={{ width: KEY_W }}>
          {t("piano.vel")}
        </div>
        <div className="flex-1 overflow-hidden">
          <div
            className="relative h-full"
            style={{ width: loop * COL_W, transform: `translateX(-${scrollX}px)` }}
            onPointerDown={(e) => onVelPointer(e, e.currentTarget)}
          >
            {notes.map((n) => (
              <div
                key={`v${n.id}`}
                className={`absolute bottom-0 ${selected.has(n.id) || selected.size === 0 ? "bg-accent" : "bg-ink-600"}`}
                style={{
                  left: n.startStep * COL_W + 2,
                  width: Math.max(4, COL_W - 4),
                  height: `${Math.round(n.velocity * 100)}%`,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="px-2 py-1 text-[10px] text-zinc-500 border-t border-line">{t("piano.hint")}</p>
    </div>
  );
}
