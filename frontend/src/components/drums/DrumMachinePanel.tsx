import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { getEngine } from "../../audio-engine/AudioEngine";
import { PAD_IDS } from "../../audio-engine/DrumMachine";
import { t, useI18n, type MsgKey } from "../../i18n";
import { rotateRow } from "../../lib/pianoRoll";
import { collabName, getCollabId, sendCollab } from "../../store/useProjectSync";
import { useStudio } from "../../store/useStudio";
import type { DrumSteps } from "../../types";

function commitSteps(steps: DrumSteps): void {
  getEngine().drums.steps = steps;
  useStudio.setState({ drumSteps: steps });
}

const FILL_KEYS: Record<"beat" | "eighth" | "all" | "off", MsgKey> = {
  beat: "drums.fill.beat",
  eighth: "drums.fill.eighth",
  all: "drums.fill.all",
  off: "drums.fill.off",
};

function fillPad(steps: DrumSteps, id: string, length: number, pred: (i: number) => number): DrumSteps {
  const row = [...(steps[id] || Array(64).fill(0))];
  for (let i = 0; i < length; i++) row[i] = pred(i);
  return { ...steps, [id]: row };
}

export function DrumMachinePanel() {
  const { drumSteps, drumLength, drumSwing, currentStep, bootAudio, locks, pushUndo } = useStudio();
  const step = currentStep % drumLength;
  const lock = locks.drums;
  const blocked = !!lock && lock.clientId !== getCollabId();
  const mine = lock?.clientId === getCollabId();
  const [kits, setKits] = useState<Array<{ id: string; name: string; pads: unknown[] }>>([]);
  const [kitName, setKitName] = useState("808 Core");
  const [selected, setSelected] = useState<string>("kick");
  const paint = useRef<{ id: string; value: number } | null>(null);
  useI18n((s) => s.locale);

  useEffect(() => {
    void api.presets.kits().then(setKits).catch(() => undefined);
  }, []);

  useEffect(() => {
    const up = () => {
      paint.current = null;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const paintCell = (id: string, i: number, value: number) => {
    if (blocked) return;
    const row = [...(drumSteps[id] || Array(64).fill(0))];
    row[i] = value;
    const steps = { ...drumSteps, [id]: row };
    getEngine().drums.setStep(id, i, value);
    useStudio.setState({ drumSteps: steps });
  };

  const selectedRow = drumSteps[selected] || Array(64).fill(0);

  return (
    <div className={`flex-1 p-4 overflow-auto flex flex-col gap-4 ${blocked ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`text-xs px-2 py-1 rounded ${mine ? "bg-accent text-black" : "bg-ink-700"}`}
          onClick={() => sendCollab({ type: mine ? "unlock" : "lock", resource: "drums", name: collabName() })}
        >
          {blocked ? t("drums.lockedBy", { name: lock.name }) : mine ? t("drums.unlock") : t("drums.lock")}
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
          {t("drums.savePattern")}
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
          {t("drums.saveKit")}
        </button>
        <select
          className="bg-ink-800 border border-line rounded px-2 py-1 text-xs"
          defaultValue=""
          onChange={(e) => {
            const kit = kits.find((k) => k.id === e.target.value);
            if (kit) setKitName(kit.name);
          }}
        >
          <option value="">{t("drums.loadKit")}</option>
          {kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <label className="text-xs text-zinc-400">
          {t("drums.steps")}
          <select
            className="ml-2 bg-ink-800 border border-line rounded px-2 py-1"
            value={drumLength}
            onChange={(e) => {
              const length = Number(e.target.value);
              getEngine().drums.length = length;
              getEngine().piano.setLoopSteps(length);
              useStudio.setState({ drumLength: length });
            }}
          >
            {[16, 32, 64].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-400 flex items-center gap-2">
          {t("drums.swing")}
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
            className={`aspect-square rounded-lg border text-[10px] uppercase tracking-wider ${
              selected === id ? "bg-accent text-black border-accent" : "bg-ink-700 border-line hover:border-accent"
            }`}
            onMouseDown={() => {
              setSelected(id);
              void bootAudio().then(() => getEngine().drums.trigger(id));
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-forgedeck-stem")) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/x-forgedeck-stem");
              if (!raw) return;
              try {
                const parsed = JSON.parse(raw) as { audioFileId?: string; stem?: string };
                if (parsed.audioFileId && parsed.stem) {
                  void useStudio.getState().dropStemOnPad(id, parsed.audioFileId, parsed.stem);
                }
              } catch {
                /* ignore */
              }
            }}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="overflow-auto">
        <div className="min-w-max">
          {PAD_IDS.slice(0, 8).map((id) => (
            <div key={id} className={`flex items-center gap-1 mb-1 ${selected === id ? "bg-ink-800/80 rounded" : ""}`}>
              <button
                className={`w-14 text-[10px] uppercase text-left ${selected === id ? "text-accent" : "text-zinc-400"}`}
                onClick={(e) => {
                  setSelected(id);
                  if (e.shiftKey) getEngine().drums.muted[id] = !getEngine().drums.muted[id];
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelected(id);
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
                    onPointerDown={(e) => {
                      if (blocked || e.button !== 0) return;
                      setSelected(id);
                      pushUndo();
                      const next = on ? 0 : i % 4 === 0 ? 1 : 0.75;
                      paint.current = { id, value: next };
                      paintCell(id, i, next);
                    }}
                    onPointerEnter={() => {
                      if (!paint.current || paint.current.id !== id) return;
                      paintCell(id, i, paint.current.value);
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
      <div className="border border-line rounded bg-ink-900 p-3 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
            {t("drums.graph", { pad: selected })}
          </div>
          {(
            [
              ["beat", () => fillPad(drumSteps, selected, drumLength, (i) => (i % 4 === 0 ? 1 : 0))],
              ["eighth", () => fillPad(drumSteps, selected, drumLength, (i) => (i % 2 === 0 ? 0.85 : 0))],
              ["all", () => fillPad(drumSteps, selected, drumLength, () => 0.7)],
              ["off", () => fillPad(drumSteps, selected, drumLength, (i) => (i % 2 === 1 ? 0.7 : 0))],
            ] as const
          ).map(([id, fn]) => (
            <button
              key={id}
              className="text-[10px] uppercase bg-ink-700 px-2 py-0.5 rounded"
              onClick={() => {
                if (blocked) return;
                pushUndo();
                commitSteps(fn());
              }}
            >
              {t(FILL_KEYS[id])}
            </button>
          ))}
          <button
            className="text-[10px] uppercase bg-ink-700 px-2 py-0.5 rounded"
            onClick={() => {
              if (blocked) return;
              pushUndo();
              commitSteps({ ...drumSteps, [selected]: rotateRow(selectedRow, drumLength, -1) });
            }}
          >
            {t("drums.shiftLeft")}
          </button>
          <button
            className="text-[10px] uppercase bg-ink-700 px-2 py-0.5 rounded"
            onClick={() => {
              if (blocked) return;
              pushUndo();
              commitSteps({ ...drumSteps, [selected]: rotateRow(selectedRow, drumLength, 1) });
            }}
          >
            {t("drums.shiftRight")}
          </button>
          <button
            className="text-[10px] uppercase bg-ink-700 px-2 py-0.5 rounded"
            onClick={() => {
              if (blocked) return;
              pushUndo();
              const row = [...selectedRow];
              for (let i = 0; i < drumLength; i++) {
                if (row[i] > 0) row[i] = Math.max(0.2, Math.min(1, row[i] + (Math.random() * 2 - 1) * 0.18));
              }
              commitSteps({ ...drumSteps, [selected]: row });
            }}
          >
            {t("drums.humanize")}
          </button>
          <button
            className="text-[10px] uppercase bg-ink-700 px-2 py-0.5 rounded"
            onClick={() => {
              if (blocked) return;
              pushUndo();
              commitSteps(fillPad(drumSteps, selected, drumLength, () => 0));
            }}
          >
            {t("drums.clearRow")}
          </button>
        </div>
        <div
          className="flex items-end gap-0.5 h-16"
          onPointerDown={(e) => {
            if (blocked || e.button !== 0) return;
            pushUndo();
            const lane = e.currentTarget;
            const paintVel = (ev: PointerEvent) => {
              const r = lane.getBoundingClientRect();
              const i = Math.max(0, Math.min(drumLength - 1, Math.floor(((ev.clientX - r.left) / r.width) * drumLength)));
              const vel = Math.max(0, Math.min(1, 1 - (ev.clientY - r.top) / r.height));
              paintCell(selected, i, vel < 0.05 ? 0 : vel);
            };
            paintVel(e.nativeEvent);
            const move = (ev: PointerEvent) => paintVel(ev);
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          {Array.from({ length: drumLength }).map((_, i) => {
            const vel = selectedRow[i] ?? 0;
            return (
              <div
                key={i}
                className={`flex-1 min-w-[8px] rounded-sm ${i === step ? "ring-1 ring-white" : ""} ${
                  vel > 0 ? "bg-accent" : i % 4 === 0 ? "bg-ink-600" : "bg-ink-800"
                }`}
                style={{ height: `${Math.max(8, Math.round(vel * 100))}%`, opacity: vel > 0 ? 0.5 + vel * 0.5 : 0.35 }}
              />
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">{t("drums.graphHint")}</p>
      </div>
    </div>
  );
}
