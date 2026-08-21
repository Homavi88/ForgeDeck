import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Shell } from "../components/layout/Shell";
import { getEngine } from "../audio-engine/AudioEngine";
import { DEFAULT_MIDI, MIDI_TARGETS, persistMidiBindings, type MidiBindings } from "../audio-engine/midiMap";
import { t, useI18n } from "../i18n";
import { useStudio } from "../store/useStudio";
import type { StylePack } from "../types";

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useI18n((s) => s.locale);
  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-zinc-500">{t("settings.password")}</h2>
      <p className="text-xs text-zinc-500">{t("settings.passwordHint")}</p>
      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void api.auth
            .changePassword(current, next)
            .then(() => {
              setCurrent("");
              setNext("");
              setMsg(t("settings.passwordOk"));
            })
            .catch((err) => setMsg(err instanceof Error ? err.message : t("settings.passwordFail")));
        }}
      >
        <label className="text-xs text-zinc-400">
          {t("settings.currentPassword")}
          <input
            type="password"
            className="block mt-1 bg-ink-800 border border-line rounded px-2 py-1 text-sm"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="text-xs text-zinc-400">
          {t("settings.newPassword")}
          <input
            type="password"
            className="block mt-1 bg-ink-800 border border-line rounded px-2 py-1 text-sm"
            value={next}
            minLength={4}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider">
          {t("settings.changePassword")}
        </button>
      </form>
      {msg && <p className="text-xs text-mint">{msg}</p>}
    </section>
  );
}

type FxPreset = { id: string; name: string; effect_type: string; params: Record<string, number> };
type MidiPreset = { id: string; name: string; bindings: MidiBindings };

export default function SettingsPage() {
  const [fx, setFx] = useState<FxPreset[]>([]);
  const [maps, setMaps] = useState<MidiPreset[]>([]);
  const [styles, setStyles] = useState<StylePack[]>([]);
  const [bindings, setBindings] = useState<MidiBindings>(() => getEngine().midiBindings);
  const [midiMsg, setMidiMsg] = useState<string>("");
  const [learnTarget, setLearnTarget] = useState<string>("master.volume");
  const [status, setStatus] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  useI18n((s) => s.locale);

  const refresh = async () => {
    try {
      setFx(await api.presets.effects());
      setMaps(await api.presets.midi());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t("settings.loadFailed"));
    }
  };

  useEffect(() => {
    void refresh();
    void api.presets
      .styles()
      .then(setStyles)
      .catch(() => undefined);
  }, []);

  const applyBindings = (next: MidiBindings) => {
    setBindings(next);
    getEngine().setMidiBindings(next);
  };

  return (
    <Shell>
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
          <p className="text-zinc-400 text-sm mt-2">{t("settings.intro")}</p>
        </div>

        <PasswordSection />

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-zinc-500">{t("settings.styles")}</h2>
          <p className="text-xs text-zinc-500">{t("settings.styleHint")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {styles.map((pack) => (
              <div key={pack.id} className="p-4 rounded-lg border border-line bg-ink-800 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{pack.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {pack.genre} · {pack.bpm} BPM · {pack.key}
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded bg-accent text-black text-xs uppercase tracking-wider font-semibold shrink-0 disabled:opacity-50"
                    disabled={applying === pack.id}
                    onClick={async () => {
                      setApplying(pack.id);
                      try {
                        await useStudio.getState().applyStylePack(pack);
                        setStatus(t("settings.applied", { name: pack.name }));
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : t("toast.styleFailed"));
                      } finally {
                        setApplying(null);
                      }
                    }}
                  >
                    {t("settings.applyStyle")}
                  </button>
                </div>
                <p className="text-xs text-zinc-400">{pack.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-zinc-500">{t("settings.fx")}</h2>
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
                  setStatus(t("settings.applied", { name: p.name }));
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            className="text-[10px] uppercase tracking-wider text-zinc-500"
            onClick={async () => {
              const name = prompt(t("settings.fxName"), t("settings.fxDefault")) || t("settings.fxDefault");
              const fxState = useStudio.getState().mixer.A.fx;
              await api.presets.saveEffect(name, fxState);
              await refresh();
            }}
          >
            {t("settings.saveFx")}
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-zinc-500">{t("settings.midi")}</h2>
          <p className="text-xs text-zinc-500">{t("settings.midiHint")}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              className="px-3 py-1.5 rounded bg-accent text-black text-xs uppercase tracking-wider font-semibold"
              onClick={async () => {
                await useStudio.getState().bootAudio();
                const msg = await getEngine().enableMidi();
                setMidiMsg(msg);
              }}
            >
              {t("settings.enableMidi")}
            </button>
            <select
              className="bg-ink-800 border border-line rounded px-2 py-1 text-sm"
              value={learnTarget}
              onChange={(e) => setLearnTarget(e.target.value)}
            >
              {MIDI_TARGETS.map((target) => (
                <option key={target}>{target}</option>
              ))}
            </select>
            <button
              className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider"
              onClick={() => {
                setMidiMsg(t("settings.learnHint", { target: learnTarget }));
                getEngine().armMidiLearn((kind, number, channel) => {
                  const next = structuredClone(bindings);
                  const key = `${channel}:${number}`;
                  if (kind === "cc") next.cc[key] = learnTarget;
                  else next.notes[key] = learnTarget;
                  applyBindings(next);
                  setMidiMsg(t("settings.learned", { kind, number, channel, target: learnTarget }));
                });
              }}
            >
              {t("settings.learn")}
            </button>
            <button
              className="px-3 py-1.5 rounded bg-ink-700 text-xs uppercase tracking-wider"
              onClick={() => applyBindings(structuredClone(DEFAULT_MIDI))}
            >
              {t("settings.resetMap")}
            </button>
            {midiMsg && <span className="text-xs text-mint">{midiMsg}</span>}
          </div>
          <table className="w-full text-xs">
            <thead className="text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left py-1">{t("settings.cc")}</th>
                <th className="text-left">{t("settings.target")}</th>
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
                      {MIDI_TARGETS.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-xs">
            <thead className="text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left py-1">{t("settings.notes")}</th>
                <th className="text-left">{t("settings.target")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bindings.notes).map(([note, target]) => (
                <tr key={note} className="border-t border-line">
                  <td className="py-1 font-mono">{note}</td>
                  <td>
                    <select
                      className="bg-ink-800 border border-line rounded px-1 py-0.5"
                      value={target}
                      onChange={(e) => {
                        const next = structuredClone(bindings);
                        next.notes[note] = e.target.value;
                        applyBindings(next);
                      }}
                    >
                      {MIDI_TARGETS.map((opt) => (
                        <option key={opt}>{opt}</option>
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
                const name = prompt(t("settings.mapName"), t("settings.mapDefault")) || t("settings.mapDefault");
                await api.presets.saveMidi(name, bindings);
                persistMidiBindings(bindings);
                await refresh();
                setStatus(t("settings.midiSaved"));
              }}
            >
              {t("settings.saveMap")}
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
                  setStatus(t("settings.loaded", { name: m.name }));
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </section>

        {status && <p className="text-sm text-mint">{status}</p>}
        <ul className="text-sm text-zinc-500 list-disc pl-5 space-y-1">
          <li>{t("settings.tipDocs")}</li>
          <li>{t("settings.tipHealth")}</li>
          <li>{t("settings.tipStems")}</li>
          <li>{t("settings.tipKeylock")}</li>
        </ul>
      </div>
    </Shell>
  );
}
