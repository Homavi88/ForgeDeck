import { getEngine } from "../../audio-engine/AudioEngine";
import { useStudio } from "../../store/useStudio";

const FX = ["delay", "reverb", "flanger", "distortion", "bitcrush"] as const;

export function MixerPanel() {
  const { mixer, levels, masterLevel, crossfader, sidechain } = useStudio();

  return (
    <section className="w-[280px] shrink-0 bg-ink-800 rounded-lg border border-line p-3 flex flex-col gap-3 shadow-panel">
      <div className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 text-center">Mixer</div>
      <div className="flex gap-2">
        <Strip id="A" label="A" level={levels.A} />
        <Strip id="B" label="B" level={levels.B} />
      </div>
      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
        Crossfader
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={crossfader}
          className="w-full"
          onChange={(e) => {
            const v = Number(e.target.value);
            getEngine().mixer.setCrossfader(v);
            useStudio.setState({ crossfader: v });
          }}
        />
      </label>
      <div className="flex gap-3 items-end justify-center">
        <Vu level={masterLevel} />
        <label className="text-[10px] uppercase tracking-wider text-zinc-500">
          Master
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.9}
            className="w-24"
            onChange={(e) => {
              getEngine().mixer.master.setVolume(Number(e.target.value));
            }}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[10px] uppercase text-zinc-500">
        <input
          type="checkbox"
          checked={sidechain}
          onChange={(e) => {
            getEngine().mixer.sidechain = e.target.checked;
            useStudio.setState({ sidechain: e.target.checked });
          }}
        />
        Sidechain duck
      </label>
      <div className="grid grid-cols-2 gap-1">
        {FX.map((fx) => (
          <label key={fx} className="text-[9px] uppercase text-zinc-500">
            {fx}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              defaultValue={mixer.A.fx[fx] ?? 0}
              className="w-full"
              onChange={(e) => {
                const v = Number(e.target.value);
                getEngine().mixer.channels.A.fx.setWet(fx, v);
                getEngine().mixer.channels.B.fx.setWet(fx, v * 0.6);
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function Strip({ id, label, level }: { id: "A" | "B"; label: string; level: number }) {
  const ch = () => getEngine().mixer.channels[id];
  const state = useStudio((s) => s.mixer[id]);
  const patch = (partial: Partial<typeof state>) => {
    useStudio.setState({ mixer: { ...useStudio.getState().mixer, [id]: { ...state, ...partial } } });
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="text-xs font-semibold">{label}</div>
      <Vu level={level} />
      {(["low", "mid", "high"] as const).map((band, i) => (
        <label key={band} className="text-[9px] uppercase text-zinc-500 w-full text-center">
          {band}
          <input
            type="range"
            min={-12}
            max={12}
            step={0.1}
            defaultValue={0}
            className="w-full"
            onChange={(e) => {
              const eq = [...state.eq] as [number, number, number];
              eq[i] = Number(e.target.value);
              ch().eq.set(eq[0], eq[1], eq[2]);
              patch({ eq });
            }}
          />
        </label>
      ))}
      <label className="text-[9px] uppercase text-zinc-500 w-full text-center">
        Filter
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          className="w-full"
          onChange={(e) => {
            const v = Number(e.target.value);
            ch().filter.setKnob(v);
            patch({ filter: v });
          }}
        />
      </label>
      <label className="text-[9px] uppercase text-zinc-500 w-full text-center">
        Gain
        <input
          type="range"
          min={-12}
          max={12}
          step={0.1}
          defaultValue={0}
          className="w-full"
          onChange={(e) => ch().setGainDb(Number(e.target.value))}
        />
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={state.volume}
            className="h-24"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
        onChange={(e) => {
          const v = Number(e.target.value);
          ch().setVolume(v);
          patch({ volume: v });
        }}
      />
      <div className="flex gap-1">
        <button
          className={`text-[9px] px-1 rounded ${state.mute ? "bg-danger text-white" : "bg-ink-700"}`}
          onClick={() => {
            useStudio.getState().applyMixerChannel(id, { mute: !state.mute });
          }}
        >
          M
        </button>
        <button
          className={`text-[9px] px-1 rounded ${state.solo ? "bg-warn text-black" : "bg-ink-700"}`}
          onClick={() => {
            useStudio.getState().applyMixerChannel(id, { solo: !state.solo });
          }}
        >
          S
        </button>
      </div>
      <label className="text-[9px] uppercase text-zinc-500 w-full text-center">
        Pan
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          className="w-full"
          onChange={(e) => useStudio.getState().applyMixerChannel(id, { pan: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

function Vu({ level }: { level: number }) {
  const h = Math.min(100, level * 280);
  return (
    <div className="w-3 h-24 bg-ink-950 rounded overflow-hidden relative">
      <div className="vu-bar absolute bottom-0 left-0 right-0" style={{ height: `${h}%` }} />
    </div>
  );
}
