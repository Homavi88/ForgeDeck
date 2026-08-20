import { useRef } from "react";
import { getEngine } from "../../audio-engine/AudioEngine";
import { t, useI18n } from "../../i18n";

/** Vinyl platter: drag vertically to scratch, wheel to nudge. */
export function Platter({ side }: { side: "A" | "B" }) {
  const lastY = useRef<number | null>(null);
  useI18n((s) => s.locale);
  const deck = () => getEngine().decks[side];

  return (
    <div
      className="w-24 h-24 rounded-full border-4 border-line bg-[conic-gradient(#1c1c22,#ff6a00,#1c1c22,#3dfff3,#1c1c22)] shadow-panel cursor-grab active:cursor-grabbing mx-auto"
      onMouseDown={(e) => {
        lastY.current = e.clientY;
        const move = (ev: MouseEvent) => {
          if (lastY.current == null) return;
          const dy = ev.clientY - lastY.current;
          lastY.current = ev.clientY;
          deck().scratch(-dy * 0.004);
        };
        const up = () => {
          lastY.current = null;
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
      onWheel={(e) => {
        e.preventDefault();
        deck().scratch(e.deltaY * 0.0008);
      }}
      title={t("wave.scratch")}
    />
  );
}
