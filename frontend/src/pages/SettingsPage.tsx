import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Shell } from "../components/layout/Shell";
import { getEngine } from "../audio-engine/AudioEngine";
import { DEFAULT_MIDI, MIDI_TARGETS, persistMidiBindings, type MidiBindings } from "../audio-engine/midiMap";
import { useStudio } from "../store/useStudio";

type FxPreset = { id: string; name: string; effect_type: string; params: Record<string, number> };
type MidiPreset = { id: string; name: string; bindings: MidiBindings };

export default function SettingsPage() {
  const [fx, setFx] = useState<FxPreset[]>([]);
  const [maps, setMaps] = useState<MidiPreset[]>([]);
  const [bindings, setBindings] = useState<MidiBindings>(() => getEngine().midiBindings);
  const [midiMsg, setMidiMsg] = useState<string>("");
  const [learnTarget, setLearnTarget] = useState<string>("master.volume");
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setFx(await api.presets.effects());
      setMaps(await api.presets.midi());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load presets");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const applyBindings = (next: MidiBindings) => {
    setBindings(next);
    getEngine().setMidiBindings(next);
  };

  return (
    <Shell>
      <div className="max-w-3xl mx-auto p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-zinc-400 text-sm mt-2">
            JWT login is at <code className="text-accent">/login</code>. Demo account:{" "}
            <code className="text-accent">producer@forgedeck.local</code> / <code className="text-accent">demo</code>{" "}
            when <code>REQUIRE_AUTH=false</code>. Realtime audio stays in the browser. Optional S3, Demucs, and OpenAI
            keys live in <code className="text-accent">.env</code>.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-zinc-500">FX presets</h2>
          <div className="flex flex-wrap gap-2">
            {fx.map((p) => (
              <button
                key={p.id}
                className="px-3 py-1.5 rounded bg-ink-800 border border-line text-xs uppercase tracking-wider hover:border-accent"
                onClick={() => {
                  const eng = getEngine();
                  for (const [k, v] of Object.entries(p.params)) {
                    if (typeof v !== "number") continue;
                    eng.mixer.channels.A.fx.setWet(k, v);
                    eng.mixer.channels.B.fx.setWet(k, v * 0.65);
                    const cur = useStudio.getState().mixer.A;
                    useStudio.getState().applyMixerChannel("A", { fx: { ...cur.fx, [k]: v } });
                  }
                  setStatus(`Applied ${p.name}`);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            className="text-[10px] uppercase tracking-wider text-zinc-500"
            onClick={async () => {
              const name = prompt("Preset name", "My FX") || "My FX";
              const fxState = useStudio.getState().mixer.A.fx;
              await api.presets.saveEffect(name, fxState);
              await refresh();
            }}
          >
            Save current FX
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-zinc-500">MIDI map (Pioneer / Akai-style)</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              className="px-3 py-1.5 rounded bg-accent text-black text-xs uppercase tracking-wider font-semibold"
              onClick={async () => {
                await useStudio.getState().bootAudio();
                const msg = await getEngine().enableMidi();
                setMidiMsg(msg);
              }}
            >
              Enable MIDI
            </button>
            <select
              className="bg-ink-800 border border-line rounded px-2 py-1 text-sm"
              value={learnTarget}
              onChange={(e) => setLearnTarget(e.target.value)}
            >
              {MIDI_TARGETS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <button
              className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider"
              onClick={() => {
                setMidiMsg(`Move a knob to learn ${learnTarget}`);
                getEngine().armMidiLearn((kind, number) => {
                  const next = structuredClone(bindings);
                  if (kind === "cc") next.cc[String(number)] = learnTarget;
                  else next.notes[String(number)] = learnTarget;
                  applyBindings(next);
                  setMidiMsg(`Learned ${kind} ${number} → ${learnTarget}`);
                });
              }}
            >
              Learn
            </button>
            <button
              className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider"
              onClick={() => applyBindings(structuredClone(DEFAULT_MIDI))}
            >
              Reset map
            </button>
            {midiMsg && <span className="text-xs text-mint">{midiMsg}</span>}
          </div>
          <table className="w-full text-xs">
            <thead className="text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left py-1">CC</th>
                <th className="text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bindings.cc).map(([cc, target]) => (
                <tr key={cc} className="border-t border-line">
                  <td className="py-1 font-mono">{cc}</td>
                  <td>
                    <select
                      className="bg-ink-800 border border-line rounded px-1 py-0.5"
                      value={target}
                      onChange={(e) => {
                        const next = structuredClone(bindings);
                        next.cc[cc] = e.target.value;
                        applyBindings(next);
                      }}
                    >
                      {MIDI_TARGETS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button
              className="text-[10px] uppercase tracking-wider text-zinc-500"
              onClick={async () => {
                const name = prompt("Map name", "My controller") || "My controller";
                await api.presets.saveMidi(name, bindings);
                persistMidiBindings(bindings);
                await refresh();
                setStatus("MIDI map saved");
              }}
            >
              Save map
            </button>
            {maps.map((m) => (
              <button
                key={m.id}
                className="text-[10px] uppercase tracking-wider text-zinc-400 hover:text-white"
                onClick={() => {
                  applyBindings({
                    cc: { ...DEFAULT_MIDI.cc, ...(m.bindings?.cc || {}) },
                    notes: { ...DEFAULT_MIDI.notes, ...(m.bindings?.notes || {}) },
                  });
                  setStatus(`Loaded ${m.name}`);
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </section>

        {status && <p className="text-sm text-mint">{status}</p>}
        <ul className="text-sm text-zinc-500 list-disc pl-5 space-y-1">
          <li>Backend docs: http://localhost:8000/docs</li>
          <li>Health: http://localhost:8000/api/health</li>
          <li>Stems: GPU Demucs (CUDA/MPS) if torch+demucs are installed, else CPU Demucs, else HPSS.</li>
          <li>Key lock is Rubber Band WASM (CDJ master tempo). WSOLA only if WASM fails to load.</li>
        </ul>
      </div>
    </Shell>
  );
}
