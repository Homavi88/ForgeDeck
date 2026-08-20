import { useEffect, useState } from "react";
import { getEngine } from "../../audio-engine/AudioEngine";
import { OSC_TYPES } from "../../audio-engine/demo";
import { StylePackSelect } from "../presets/StylePackSelect";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";
import { PianoRollPanel } from "./PianoRollPanel";
import type { OscType } from "../../types";

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const START = 48;

export function SynthPanel() {
  const synth = useStudio((s) => s.synth);
  const [midiMsg, setMidiMsg] = useState("");
  useI18n((s) => s.locale);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
    <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-3">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{t("synth.title")}</div>
        <button
          className="text-xs bg-ink-700 px-2 py-1 rounded"
          onClick={async () => {
            await useStudio.getState().bootAudio();
            const msg = await getEngine().enableMidi();
            setMidiMsg(msg);
          }}
        >
          {t("synth.enableMidi")}
        </button>
        <span className="text-xs text-zinc-500">{midiMsg || t("synth.midiOff")}</span>
        <label className="text-xs text-zinc-400 flex items-center gap-1">
          <input type="checkbox" checked={synth.poly} onChange={(e) => patch({ poly: e.target.checked })} />
          {t("synth.poly")}
        </label>
        <button
          className="text-xs bg-ink-700 px-2 py-1 rounded"
          onClick={async () => {
            const p = useStudio.getState().project;
            if (!p) return;
            const { api } = await import("../../api/client");
            await api.projects.saveSynth(p.id, "Current", synth as unknown as Record<string, unknown>);
          }}
        >
          {t("synth.save")}
        </button>
        <StylePackSelect parts="synth" label={t("synth.loadStyle")} />
      </div>
      <div className="flex gap-2">
        {OSC_TYPES.map((osc) => (
          <button
            key={osc}
            onClick={() => patch({ oscType: osc as OscType })}
            className={`px-3 py-1 rounded text-xs uppercase ${synth.oscType === osc ? "bg-accent text-black" : "bg-ink-700"}`}
          >
            {osc}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-2 max-w-5xl shrink-0">
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
      <p className="text-[10px] text-zinc-500 shrink-0">{t("synth.hint")}</p>
      <PianoRollPanel />
    </div>
  );
}

function Keyboard() {
  return (
    <div className="relative h-20 max-w-3xl bg-ink-950 rounded border border-line overflow-hidden shrink-0">
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
            className="absolute top-0 h-12 w-6 bg-zinc-950 hover:bg-zinc-700 z-10"
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
