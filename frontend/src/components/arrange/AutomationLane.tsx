import { t, useI18n } from "../../i18n";
import {
  autoTargetOptions,
  parseAutoTarget,
  removeAutoPointNear,
  snapAutoTime,
  unitToValue,
  upsertAutoPoint,
  valueToUnit,
  type AutoKind,
} from "../../lib/automation";
import { useStudio } from "../../store/useStudio";
import type { PointerEvent } from "react";

const LANE_H = 56;

export function AutomationLane({
  barPx,
  snap,
  bars,
  bpm,
}: {
  barPx: number;
  snap: number;
  bars: number;
  bpm: number;
}) {
  useI18n((s) => s.locale);
  const automation = useStudio((s) => s.automation);
  const selectedAutoTarget = useStudio((s) => s.selectedAutoTarget);
  const prodLanes = useStudio((s) => s.prodLanes);
  const currentStep = useStudio((s) => s.currentStep);
  const options = autoTargetOptions(prodLanes);
  const parsed = parseAutoTarget(selectedAutoTarget) || { id: selectedAutoTarget, mixId: "A", kind: "volume" as AutoKind };
  const lane = automation.find((a) => a.target === selectedAutoTarget);
  const points = lane?.points || [];
  const barSec = (60 / Math.max(1, bpm)) * 4;
  const width = bars * barPx;
  const playhead = (currentStep / 16) * barPx;
  const mergeSec = Math.max(0.02, snap * barSec * 0.45);

  const kindLabel = (kind: AutoKind) => {
    if (kind === "volume") return t("arrange.autoVolume");
    if (kind === "filter") return t("arrange.autoFilter");
    if (kind === "eqLow") return t("arrange.autoEqLow");
    if (kind === "pan") return t("arrange.autoPan");
    if (kind === "sendRev") return t("arrange.autoSendRev");
    return t("arrange.autoSendDly");
  };

  const mixName = (mixId: string) => {
    if (mixId === "master") return t("mixer.master");
    if (mixId === "drums") return t("session.drums");
    if (mixId === "synth") return t("session.synth");
    if (mixId === "A") return t("session.deckA");
    if (mixId === "B") return t("session.deckB");
    return prodLanes.find((l) => l.id === mixId)?.name || mixId;
  };

  const paintAt = (el: HTMLElement, clientX: number, clientY: number, remove: boolean) => {
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = snapAutoTime((x / barPx) * barSec, snap, barSec);
    const unit = 1 - Math.max(0, Math.min(1, y / LANE_H));
    const value = unitToValue(parsed.kind, unit);
    const cur = useStudio.getState().automation.find((a) => a.target === selectedAutoTarget)?.points || [];
    const next = remove
      ? removeAutoPointNear(cur, time, mergeSec * 1.4)
      : upsertAutoPoint(cur, time, value, mergeSec);
    useStudio.getState().writeAutomation(selectedAutoTarget, next);
  };

  const startPaint = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    useStudio.getState().pushUndo();
    const remove = e.altKey;
    paintAt(el, e.clientX, e.clientY, remove);
    const movePtr = (ev: globalThis.PointerEvent) => {
      paintAt(el, ev.clientX, ev.clientY, remove || ev.altKey);
    };
    const up = () => {
      window.removeEventListener("pointermove", movePtr);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", movePtr);
    window.addEventListener("pointerup", up);
  };

  const pts = points
    .map((p) => {
      const x = (p.time / barSec) * barPx;
      const y = (1 - valueToUnit(parsed.kind, p.value)) * LANE_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">{t("arrange.autoTitle")}</div>
        <select
          className="bg-ink-800 border border-line rounded px-1 py-0.5 text-xs text-zinc-200 max-w-[220px]"
          value={selectedAutoTarget}
          onChange={(e) => useStudio.getState().setSelectedAutoTarget(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {mixName(opt.mixId)} · {kindLabel(opt.kind)}
            </option>
          ))}
        </select>
        <button
          className="text-xs bg-ink-800 border border-line rounded px-2 py-0.5 disabled:opacity-40"
          disabled={!points.length}
          onClick={() => useStudio.getState().clearAutomation(selectedAutoTarget)}
        >
          {t("arrange.autoClear")}
        </button>
      </div>
      <div className="flex">
        <div className="w-24 shrink-0 text-[10px] text-zinc-500 pt-1 pr-1 truncate">
          {mixName(parsed.mixId)}
          <div className="text-zinc-600">{kindLabel(parsed.kind)}</div>
        </div>
        <div
          className="relative bg-ink-900 border border-line rounded cursor-crosshair overflow-hidden"
          style={{ width, height: LANE_H }}
          onPointerDown={startPaint}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" width={width} height={LANE_H}>
            {pts && (
              <polyline fill="none" stroke="#3dfff3" strokeWidth="1.6" points={pts} />
            )}
            {points.map((p, i) => {
              const x = (p.time / barSec) * barPx;
              const y = (1 - valueToUnit(parsed.kind, p.value)) * LANE_H;
              return <circle key={i} cx={x} cy={y} r="2.5" fill="#3dfff3" />;
            })}
          </svg>
          <div className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none" style={{ left: playhead }} />
        </div>
      </div>
      <p className="text-xs text-zinc-600">{t("arrange.autoHint")}</p>
      {automation.filter((a) => a.target !== selectedAutoTarget && a.points.length).length > 0 && (
        <p className="text-[10px] font-mono text-zinc-600">
          {automation
            .filter((a) => a.points.length)
            .map((a) => `${a.target} (${a.points.length})`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
