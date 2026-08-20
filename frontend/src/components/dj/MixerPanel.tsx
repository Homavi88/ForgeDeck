import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";

const FX = ["delay", "reverb", "flanger", "distortion", "bitcrush"] as const;

export function MixerPanel() {
  const { mixer, levels, masterLevel, crossfader, sidechain, cueMix, splitCue } = useStudio();
  useI18n((s) => s.locale);

  return (
    <section className="w-[300px] shrink-0 bg-ink-800 rounded-lg border border-line p-3 flex flex-col gap-3 shadow-panel overflow-auto">
      <div className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 text-center">{t("mixer.title")}</div>
      <div className="flex gap-2">
        <Strip id="A" label="A" level={levels.A} />
        <Strip id="B" label="B" level={levels.B} />
      </div>
      <HeadphonesSection cueMix={cueMix} splitCue={splitCue} />
      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
        {t("mixer.crossfader")}
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
          {t("mixer.master")}
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
        {t("mixer.sidechain")}
      </label>
      <button
        className="text-[10px] uppercase tracking-wider bg-ink-700 rounded py-1 hover:bg-ink-600"
        onClick={() => useStudio.getState().tapTempo()}
      >
        {t("mixer.tap")}
      </button>
      <FxPresetBar />
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
                const st = useStudio.getState();
                getEngine().mixer.channels.A.fx.setWet(fx, v);
                getEngine().mixer.channels.B.fx.setWet(fx, v * 0.6);
                useStudio.setState({
                  mixer: {
                    ...st.mixer,
                    A: { ...st.mixer.A, fx: { ...st.mixer.A.fx, [fx]: v } },
                    B: { ...st.mixer.B, fx: { ...st.mixer.B.fx, [fx]: v * 0.6 } },
                  },
                });
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function FxPresetBar() {
  useI18n((s) => s.locale);
  const [list, setList] = useState<Array<{ id: string; name: string; params: Record<string, number> }>>([]);
  useEffect(() => {
    void api.presets
      .effects()
      .then(setList)
      .catch(() => undefined);
  }, []);
  if (!list.length) return null;
  return (
    <label className="text-[9px] uppercase text-zinc-500">
      {t("mixer.fxPreset")}
      <select
        className="w-full bg-ink-900 border border-line rounded px-1 py-1 mt-1 text-[10px]"
        defaultValue=""
        onChange={(e) => {
          const p = list.find((x) => x.id === e.target.value);
          if (!p) return;
          const st = useStudio.getState();
          const fxA = { ...st.mixer.A.fx };
          const fxB = { ...st.mixer.B.fx };
          for (const [k, v] of Object.entries(p.params)) {
            if (typeof v !== "number") continue;
            getEngine().mixer.channels.A.fx.setWet(k, v);
            getEngine().mixer.channels.B.fx.setWet(k, v * 0.6);
            fxA[k] = v;
            fxB[k] = v * 0.6;
          }
          useStudio.setState({
            mixer: {
              ...st.mixer,
              A: { ...st.mixer.A, fx: fxA },
              B: { ...st.mixer.B, fx: fxB },
            },
          });
        }}
      >
        <option value="">—</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Strip({ id, label, level }: { id: "A" | "B"; label: string; level: number }) {
  const ch = () => getEngine().mixer.channels[id];
  const state = useStudio((s) => s.mixer[id]);
  useI18n((s) => s.locale);
  const patch = (partial: Partial<typeof state>) => {
    useStudio.setState({ mixer: { ...useStudio.getState().mixer, [id]: { ...state, ...partial } } });
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="text-xs font-semibold">{label}</div>
      <Vu level={level} />
      {(["low", "mid", "high"] as const).map((band, i) => (
        <label key={band} className="text-[9px] uppercase text-zinc-500 w-full text-center">
{t(`mixer.${band}`)}
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
        {t("mixer.filter")}
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
        {t("mixer.gain")}
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
        <PflButton id={id} />
      </div>
      <label className="text-[9px] uppercase text-zinc-500 w-full text-center">
        {t("mixer.pan")}
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

function PflButton({ id }: { id: "A" | "B" }) {
  const on = useStudio((s) => s.pfl[id]);
  useI18n((s) => s.locale);
  return (
    <button
      className={`text-[9px] px-1 rounded ${on ? "bg-mint text-black" : "bg-ink-700"}`}
      title={t("mixer.pflTitle")}
      onClick={() => useStudio.getState().setPfl(id, !on)}
    >
      {t("mixer.cue")}
    </button>
  );
}

function HeadphonesSection({ cueMix, splitCue }: { cueMix: number; splitCue: boolean }) {
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const deviceId = useStudio((s) => s.headphoneDeviceId);
  useI18n((s) => s.locale);
  return (
    <div className="border border-line rounded p-2 space-y-2">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">{t("mixer.hp")}</div>
      <label className="text-[9px] uppercase text-zinc-500 w-full">
        {cueMix < 0.5 ? t("mixer.cueMixMaster") : t("mixer.cueMixCue")}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={cueMix}
          className="w-full"
          onChange={(e) => useStudio.getState().setCueMix(Number(e.target.value))}
        />
      </label>
      <label className="flex items-center gap-2 text-[9px] uppercase text-zinc-500">
        <input
          type="checkbox"
          checked={splitCue}
          onChange={(e) => useStudio.getState().setSplitCue(e.target.checked)}
        />
        {t("mixer.split")}
      </label>
      <button
        className="text-[9px] uppercase text-zinc-400"
        onClick={async () => {
          await useStudio.getState().bootAudio();
          setOutputs(await getEngine().listAudioOutputs());
        }}
      >
        {outputs.length ? t("mixer.refreshOut") : t("mixer.listOut")}
      </button>
      {outputs.length > 0 && (
        <select
          className="w-full bg-ink-900 border border-line rounded px-1 py-1 text-[10px]"
          value={deviceId || ""}
          onChange={async (e) => {
            const id = e.target.value;
            useStudio.setState({ headphoneDeviceId: id || null });
            if (id) {
              const msg = await getEngine().setHeadphonesSink(id);
              useStudio.getState().pushToast({ id: "hp", kind: "ok", text: msg, ttl: 1800 });
            }
          }}
        >
          <option value="">{t("mixer.defaultOut")}</option>
          {outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 12)}
            </option>
          ))}
        </select>
      )}
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
