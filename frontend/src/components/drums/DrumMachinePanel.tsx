import { getEngine } from "../../audio-engine/AudioEngine";
import { PAD_IDS } from "../../audio-engine/DrumMachine";
import { useStudio } from "../../store/useStudio";

export function DrumMachinePanel() {
  const { drumSteps, drumLength, drumSwing, currentStep, bootAudio } = useStudio();
  const step = currentStep % drumLength;

  return (
    <div className="flex-1 p-4 overflow-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">Drum Machine</div>
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
