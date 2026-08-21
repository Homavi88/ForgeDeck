import { CORE_LANES, isCoreMixId } from "../../lib/mix";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";
import { InsertRack } from "./InsertRack";

export function ProductionMixer() {
  const mixer = useStudio((s) => s.mixer);
  const prodLanes = useStudio((s) => s.prodLanes);
  const selectedMixId = useStudio((s) => s.selectedMixId);
  const levels = useStudio((s) => s.levels);
  const masterLevel = useStudio((s) => s.masterLevel);
  useI18n((s) => s.locale);
  const lanes = [...CORE_LANES, ...prodLanes];

  return (
    <section className="rounded-lg border border-line bg-ink-800 p-3 space-y-3 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">{t("mixer.production")}</div>
        <button
          className="text-[10px] uppercase tracking-wider bg-accent text-black font-semibold px-2 py-1 rounded"
          onClick={() => useStudio.getState().addAudioLane()}
        >
          {t("mixer.addTrack")}
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {lanes.map((lane) => (
          <ProdStrip
            key={lane.id}
            id={lane.id}
            name={lane.name}
            color={lane.color}
            removable={!isCoreMixId(lane.id)}
            selected={selectedMixId === lane.id}
            level={levels[lane.id] || 0}
            volume={mixer[lane.id]?.volume ?? 0.85}
            mute={!!mixer[lane.id]?.mute}
            solo={!!mixer[lane.id]?.solo}
          />
        ))}
        <div className="w-16 shrink-0 flex flex-col items-center gap-1 px-1">
          <div className="text-[10px] font-semibold text-zinc-400">{t("mixer.master")}</div>
          <Vu level={masterLevel} />
        </div>
      </div>
      <InsertRack />
    </section>
  );
}

function ProdStrip({
  id,
  name,
  color,
  removable,
  selected,
  level,
  volume,
  mute,
  solo,
}: {
  id: string;
  name: string;
  color: string;
  removable: boolean;
  selected: boolean;
  level: number;
  volume: number;
  mute: boolean;
  solo: boolean;
}) {
  useI18n((s) => s.locale);
  return (
    <div
      className={`w-[4.6rem] shrink-0 flex flex-col items-center gap-1 rounded p-1 cursor-pointer ${
        selected ? "bg-ink-700 ring-1 ring-accent" : "hover:bg-ink-900"
      }`}
      onClick={() => useStudio.getState().selectMix(id)}
    >
      <button
        className="text-[10px] font-semibold truncate w-full text-center"
        style={{ color }}
        title={name}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!removable) return;
          const next = window.prompt(t("mixer.renameTrack"), name);
          if (next != null) useStudio.getState().renameAudioLane(id, next);
        }}
      >
        {name}
      </button>
      <Vu level={level} />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        className="h-20"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => useStudio.getState().applyMixerChannel(id, { volume: Number(e.target.value) })}
      />
      <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          className={`text-[9px] px-1 rounded ${mute ? "bg-danger text-white" : "bg-ink-700"}`}
          onClick={() => useStudio.getState().applyMixerChannel(id, { mute: !mute })}
        >
          M
        </button>
        <button
          className={`text-[9px] px-1 rounded ${solo ? "bg-warn text-black" : "bg-ink-700"}`}
          onClick={() => useStudio.getState().applyMixerChannel(id, { solo: !solo })}
        >
          S
        </button>
      </div>
      {removable && (
        <button
          className="text-[9px] text-zinc-500 hover:text-danger"
          onClick={(e) => {
            e.stopPropagation();
            useStudio.getState().removeAudioLane(id);
          }}
        >
          {t("mixer.removeTrack")}
        </button>
      )}
    </div>
  );
}

function Vu({ level }: { level: number }) {
  const h = Math.min(100, level * 280);
  return (
    <div className="w-2.5 h-16 bg-ink-950 rounded overflow-hidden relative">
      <div className="vu-bar absolute bottom-0 left-0 right-0" style={{ height: `${h}%` }} />
    </div>
  );
}
