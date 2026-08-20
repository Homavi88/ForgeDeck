import { useEffect, useState } from "react";
import { getEngine } from "../../audio-engine/AudioEngine";
import { OSC_TYPES } from "../../audio-engine/demo";
import { useStudio } from "../../store/useStudio";
import type { OscType } from "../../types";

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const START = 48;

export function SynthPanel() {
  const synth = useStudio((s) => s.synth);
  const [midiMsg, setMidiMsg] = useState("MIDI off");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72 };
      if (e.repeat) return;
      const midi = map[e.key.toLowerCase()];
      if (midi == null) return;
      void useStudio.getState().bootAudio().then(() => getEngine().synth.noteOn(midi));
    };
    const up = (e: KeyboardEvent) => {
      const map: Record<string, number> = { a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71, k: 72 };
      const midi = map[e.key.toLowerCase()];
      if (midi != null) getEngine().synth.noteOff(midi);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const patch = (partial: Partial<typeof synth>) => {
    const next = { ...synth, ...partial };
    getEngine().synth.setParams(next);
    useStudio.setState({ synth: next });
  };

  return (
    <div className="flex-1 p-4 overflow-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Subtractive Synth</div>
        <button
          className="text-xs bg-ink-700 px-2 py-1 rounded"
          onClick={async () => {
            await useStudio.getState().bootAudio();
            const msg = await getEngine().enableMidi((midi, vel, on) => {
              if (on) getEngine().synth.noteOn(midi, vel);
              else getEngine().synth.noteOff(midi);
            });
            setMidiMsg(msg);
          }}
        >
          Enable MIDI
        </button>
        <span className="text-xs text-zinc-500">{midiMsg}</span>
        <label className="text-xs text-zinc-400 flex items-center gap-1">
          <input type="checkbox" checked={synth.poly} onChange={(e) => patch({ poly: e.target.checked })} />
          Poly
        </label>
      </div>
      <div className="flex gap-2">
        {OSC_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => patch({ oscType: t as OscType })}
            className={`px-3 py-1 rounded text-xs uppercase ${synth.oscType === t ? "bg-accent text-black" : "bg-ink-700"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4 max-w-3xl">
        {(
          [
            ["gain", 0, 1, 0.01],
            ["attack", 0.001, 2, 0.001],
            ["decay", 0.01, 2, 0.01],
            ["sustain", 0, 1, 0.01],
            ["release", 0.01, 3, 0.01],
            ["cutoff", 80, 8000, 1],
            ["resonance", 0.1, 18, 0.1],
            ["lfoRate", 0.1, 20, 0.1],
            ["lfoDepth", 0, 2000, 1],
          ] as const
        ).map(([key, min, max, step]) => (
          <label key={key} className="text-[10px] uppercase tracking-wider text-zinc-500">
            {key} {Number(synth[key]).toFixed(2)}
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={synth[key] as number}
              className="w-full"
              onChange={(e) => patch({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <Keyboard />
      <p className="text-xs text-zinc-500">Keys A S D F G H J K · MIDI controllers via Web MIDI API</p>
    </div>
  );
}

function Keyboard() {
  return (
    <div className="relative h-32 max-w-3xl bg-ink-950 rounded border border-line overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => {
        const midi = START + i;
        const pc = midi % 12;
        const isWhite = WHITE.includes(pc);
        if (!isWhite) return null;
        const whitesBefore = Array.from({ length: i }).filter((_, j) => WHITE.includes((START + j) % 12)).length;
        return (
          <button
            key={midi}
            className="absolute top-0 bottom-0 w-10 border border-zinc-700 bg-zinc-100 hover:bg-white"
            style={{ left: whitesBefore * 40 }}
            onMouseDown={() => {
              void useStudio.getState().bootAudio().then(() => getEngine().synth.noteOn(midi));
            }}
            onMouseUp={() => getEngine().synth.noteOff(midi)}
            onMouseLeave={() => getEngine().synth.noteOff(midi)}
          />
        );
      })}
      {Array.from({ length: 24 }).map((_, i) => {
        const midi = START + i;
        const pc = midi % 12;
        if (WHITE.includes(pc)) return null;
        const whitesBefore = Array.from({ length: i }).filter((_, j) => WHITE.includes((START + j) % 12)).length;
        return (
          <button
            key={midi}
            className="absolute top-0 h-20 w-6 bg-zinc-950 hover:bg-zinc-700 z-10"
            style={{ left: whitesBefore * 40 - 12 }}
            onMouseDown={() => {
              void useStudio.getState().bootAudio().then(() => getEngine().synth.noteOn(midi));
            }}
            onMouseUp={() => getEngine().synth.noteOff(midi)}
          />
        );
      })}
    </div>
  );
}
