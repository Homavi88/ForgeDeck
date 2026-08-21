import { t, useI18n } from "../../i18n";
import { INSERT_DEVICES, type InsertKind } from "../../lib/mix";
import { useStudio } from "../../store/useStudio";

export function InsertRack() {
  const selectedMixId = useStudio((s) => s.selectedMixId);
  const state = useStudio((s) => s.mixer[s.selectedMixId]);
  const lane = useStudio((s) => s.prodLanes.find((l) => l.id === s.selectedMixId));
  useI18n((s) => s.locale);
  if (!state) return null;
  const name =
    selectedMixId === "A"
      ? "Deck A"
      : selectedMixId === "B"
        ? "Deck B"
        : selectedMixId === "drums"
          ? t("session.drums")
          : selectedMixId === "synth"
            ? t("session.synth")
            : lane?.name || selectedMixId;

  return (
    <div className="rounded-lg border border-line bg-ink-900 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
          {t("mixer.rack")} · {name}
        </div>
        <p className="text-[10px] text-zinc-600 hidden sm:block">{t("mixer.rackHint")}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {INSERT_DEVICES.map((dev) => (
          <DeviceModule key={dev.kind} id={selectedMixId} kind={dev.kind} label={dev.label} />
        ))}
      </div>
    </div>
  );
}

function DeviceModule({ id, kind, label }: { id: string; kind: InsertKind; label: string }) {
  const state = useStudio((s) => s.mixer[id]);
  const on = !(state?.bypass || {})[kind];
  useI18n((s) => s.locale);
  if (!state) return null;

  return (
    <div className={`shrink-0 w-[7.5rem] rounded border p-2 space-y-1 ${on ? "border-line bg-ink-800" : "border-line/40 bg-ink-950 opacity-60"}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
        <button
          className={`w-3.5 h-3.5 rounded-full border ${on ? "bg-mint border-mint" : "bg-ink-950 border-zinc-600"}`}
          title={t("mixer.bypass")}
          onClick={() => useStudio.getState().setInsertBypass(id, kind, on)}
        />
      </div>
      {kind === "eq" ? (
        <>
          {(
            [
              ["low", t("mixer.low")],
              ["mid", t("mixer.mid")],
              ["high", t("mixer.high")],
            ] as const
          ).map(([band, label], i) => (
            <Knob
              key={band}
              label={label}
              min={-12}
              max={12}
              step={0.1}
              value={state.eq[i] ?? 0}
              disabled={!on}
              onChange={(v) => {
                const eq = [...state.eq] as [number, number, number];
                eq[i] = v;
                useStudio.getState().applyMixerChannel(id, { eq });
              }}
            />
          ))}
        </>
      ) : kind === "filter" ? (
        <Knob
          label={t("mixer.filter")}
          min={-1}
          max={1}
          step={0.01}
          value={state.filter}
          disabled={!on}
          onChange={(v) => useStudio.getState().applyMixerChannel(id, { filter: v })}
        />
      ) : (
        <Knob
          label={t("mixer.wet")}
          min={0}
          max={1}
          step={0.01}
          value={state.fx[kind] ?? 0}
          disabled={!on}
          onChange={(v) =>
            useStudio.getState().applyMixerChannel(id, { fx: { ...state.fx, [kind]: v } })
          }
        />
      )}
    </div>
  );
}

function Knob({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[9px] uppercase text-zinc-500">
      {label} {value.toFixed(2)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="w-full"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
