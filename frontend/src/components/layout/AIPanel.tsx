import { useState } from "react";
import { useStudio } from "../../store/useStudio";

const QUICK = [
  { label: "Analyze this track", msg: "Analyze this track and suggest cues" },
  { label: "Create DJ transition", msg: "Create a DJ transition between decks" },
  { label: "Make drum pattern", msg: "Make a house drum pattern" },
  { label: "Suggest mix settings", msg: "Suggest mix settings and gain staging" },
  { label: "Generate arrangement", msg: "Generate arrangement structure intro buildup drop" },
  { label: "Create synth preset", msg: "Create a dark bass synth preset" },
];

export function AIPanel() {
  const { chat, chatAI, aiBusy, pendingActions, applyAI, rejectAI } = useStudio();
  const [text, setText] = useState("");

  return (
    <aside className="w-[320px] border-l border-line bg-ink-900 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-line text-[10px] tracking-[0.25em] uppercase text-cyan">
        AI Producer
      </div>
      <div className="p-2 flex flex-wrap gap-1 border-b border-line">
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={() => void chatAI(q.msg)}
            className="text-[10px] px-2 py-1 rounded bg-ink-700 hover:bg-ink-600 text-zinc-300"
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {chat.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-zinc-200" : "text-zinc-400"}>
            <div className="text-[10px] uppercase tracking-wider mb-1 text-accent">
              {m.role === "user" ? "You" : "Producer"}
            </div>
            {m.content}
          </div>
        ))}
        {aiBusy && <div className="text-xs text-zinc-500 animate-pulse">Thinking…</div>}
      </div>
      {pendingActions.length > 0 && (
        <div className="border-t border-line p-3 bg-ink-800">
          <div className="text-[10px] uppercase tracking-wider text-warn mb-2">Preview actions</div>
          <ul className="text-xs space-y-1 max-h-32 overflow-auto font-mono text-zinc-400">
            {pendingActions.map((a, i) => (
              <li key={i}>{a.type}</li>
            ))}
          </ul>
          <div className="flex gap-2 mt-2">
            <button onClick={() => void applyAI()} className="flex-1 bg-mint text-black text-xs py-1.5 rounded font-semibold">
              Apply
            </button>
            <button onClick={rejectAI} className="flex-1 bg-ink-700 text-xs py-1.5 rounded">
              Reject
            </button>
          </div>
        </div>
      )}
      <form
        className="p-2 border-t border-line flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void chatAI(text.trim());
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the producer…"
          className="flex-1 bg-ink-800 border border-line rounded px-2 py-1.5 text-sm"
        />
        <button className="px-3 rounded bg-accent text-black text-xs font-semibold">Send</button>
      </form>
    </aside>
  );
}
