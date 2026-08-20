import { DJ_KEYMAP } from "../../lib/djHotkeys";
import { useStudio } from "../../store/useStudio";

export function KeymapHelp() {
  const open = useStudio((s) => s.keymapOpen);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6"
      onClick={() => useStudio.setState({ keymapOpen: false })}
    >
      <div
        className="bg-ink-800 border border-line rounded-lg p-5 max-w-md w-full shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">CDJ keys · focused deck</div>
          <button className="text-xs text-zinc-500" onClick={() => useStudio.setState({ keymapOpen: false })}>
            Esc
          </button>
        </div>
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-xs">
          {DJ_KEYMAP.map(([k, d]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-accent">{k}</dt>
              <dd className="text-zinc-300">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
