import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";
import { useStudio } from "../../store/useStudio";

const LOW = 36;
const HIGH = 72;
const COLS = 16;

export function PianoRollPanel() {
  const { notes, drumLength, currentStep, pushUndo } = useStudio();
  useI18n((s) => s.locale);
  const rows = [];
  for (let p = HIGH; p >= LOW; p--) rows.push(p);

  return (
    <div className="flex-1 p-3 overflow-auto">
      <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">
        {t("piano.title", { n: drumLength })}
      </div>
      <div className="inline-block border border-line">
        {rows.map((pitch) => (
          <div key={pitch} className="flex">
            <div className="w-8 h-4 text-[9px] text-zinc-500 font-mono border-r border-line">{pitch}</div>
            {Array.from({ length: COLS }).map((_, step) => {
              const on = notes.some((n) => n.pitch === pitch && n.startStep === step);
              const play = currentStep % COLS === step;
              return (
                <button
                  key={step}
                  className={`w-6 h-4 border-r border-b border-line ${on ? "bg-accent" : play ? "bg-ink-600" : "bg-ink-900"}`}
                  onClick={() => {
                    pushUndo();
                    const next = getEngine().piano.toggleNote(pitch, step, 1);
                    useStudio.setState({ notes: next });
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
