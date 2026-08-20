import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { getEngine } from "../../audio-engine/AudioEngine";
import { PAD_IDS } from "../../audio-engine/DrumMachine";
import { collabName, getCollabId, sendCollab } from "../../store/useProjectSync";
import { useStudio } from "../../store/useStudio";

export function DrumMachinePanel() {
  const { drumSteps, drumLength, drumSwing, currentStep, bootAudio, locks } = useStudio();
  const step = currentStep % drumLength;
  const lock = locks.drums;
  const blocked = !!lock && lock.clientId !== getCollabId();
  const mine = lock?.clientId === getCollabId();
  const [kits, setKits] = useState<Array<{ id: string; name: string; pads: unknown[] }>>([]);
  const [kitName, setKitName] = useState("808 Core");

  useEffect(() => {
    void api.presets.kits().then(setKits).catch(() => undefined);
  }, []);

  return (
    <div className={`flex-1 p-4 overflow-auto flex flex-col gap-4 ${blocked ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <button
          className={`text-xs px-2 py-1 rounded ${mine ? "bg-accent text-black" : "bg-ink-700"}`}
          onClick={() => sendCollab({ type: mine ? "unlock" : "lock", resource: "drums", name: collabName() })}
        >
          {blocked ? `Locked by ${lock.name}` : mine ? "Unlock drums" : "Lock drums"}
        </button>
        <button
          className="text-xs bg-ink-700 px-2 py-1 rounded"
          onClick={async () => {
            const p = useStudio.getState().project;
            if (!p) return;
            await api.projects.savePattern(p.id, {
              name: "Main",
              length: drumLength,
              swing: drumSwing,
              bpm: useStudio.getState().bpm,
              steps: drumSteps,
            });
          }}
        >
          Save pattern
        </button>
        <input
          className="w-28 bg-ink-800 border border-line rounded px-2 py-1 text-xs"
          value={kitName}
          onChange={(e) => setKitName(e.target.value)}
        />
        <button
          className="text-xs bg-ink-700 px-2 py-1 rounded"
          onClick={async () => {
            await api.presets.saveKit(
              kitName,
              PAD_IDS.map((id) => ({ id, muted: !!getEngine().drums.muted[id] })),
            );
            setKits(await api.presets.kits());
          }}
        >
          Save kit
        </button>
        <select
          className="bg-ink-800 border border-line rounded px-2 py-1 text-xs"
          defaultValue=""
          onChange={(e) => {
            const kit = kits.find((k) => k.id === e.target.value);
            if (kit) setKitName(kit.name);
          }}
        >
          <option value="">Load kit…</option>
          {kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <label className="text-xs text-zinc-400">
          Steps
          <select
            className="ml-2 bg-ink-800 border border-line rounded px-2 py-1"
            value={drumLength}
            onChange={(e) => {
              const length = Number(e.target.value);
              getEngine().drums.length = length;
              useStudio.setState({ drumLength: length });
            }}
          >
            {[16, 32, 64].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-400 flex items-center gap-2">
          Swing
          <input
            type="range"
            min={0}
            max={0.4}
            step={0.01}
            value={drumSwing}
            onChange={(e) => {
              const swing = Number(e.target.value);
              getEngine().drums.swing = swing;
              useStudio.setState({ drumSwing: swing });
            }}
          />
        </label>
      </div>
      <div className="grid grid-cols-8 gap-2 max-w-xl">
        {PAD_IDS.map((id) => (
          <button
            key={id}
            className="aspect-square rounded-lg bg-ink-700 border border-line hover:border-accent active:bg-accent active:text-black text-[10px] uppercase tracking-wider"
            onMouseDown={() => {
              void bootAudio().then(() => getEngine().drums.trigger(id));
            }}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="overflow-auto">
        <div className="min-w-max">
          {PAD_IDS.slice(0, 8).map((id) => (
            <div key={id} className="flex items-center gap-1 mb-1">
              <button
                className="w-14 text-[10px] uppercase text-left text-zinc-400"
                onClick={() => {
                  getEngine().drums.muted[id] = !getEngine().drums.muted[id];
                }}
              >
                {id}
              </button>
              {Array.from({ length: drumLength }).map((_, i) => {
                const vel = drumSteps[id]?.[i] ?? 0;
                const on = vel > 0;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (blocked) return;
                      const next = on ? 0 : i % 4 === 0 ? 1 : 0.75;
                      const steps = { ...drumSteps, [id]: [...(drumSteps[id] || Array(64).fill(0))] };
                      steps[id][i] = next;
                      getEngine().drums.setStep(id, i, next);
                      useStudio.setState({ drumSteps: steps });
                    }}
                    className={`w-5 h-5 rounded-sm border border-line ${
                      i === step ? "ring-1 ring-white" : ""
                    } ${on ? "bg-accent" : i % 4 === 0 ? "bg-ink-600" : "bg-ink-800"}`}
                    style={{ opacity: on ? 0.4 + vel * 0.6 : 1 }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
