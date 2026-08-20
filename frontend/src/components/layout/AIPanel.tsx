import { useState } from "react";
import { collabName, getCollabId, sendCollab } from "../../store/useProjectSync";
import { useStudio } from "../../store/useStudio";

const QUICK = [
  { label: "Analyze this track", msg: "Analyze this track and suggest cues" },
  { label: "Create DJ transition", msg: "Create a DJ transition between decks" },
  { label: "Compatible tracks", msg: "Suggest compatible tracks by BPM and Camelot" },
  { label: "Make drum pattern", msg: "Make a house drum pattern" },
  { label: "Bassline", msg: "Create a bassline in the project key" },
  { label: "Melody", msg: "Create a melody in the project key" },
  { label: "Chords", msg: "Create a chord progression" },
  { label: "Suggest mix settings", msg: "Suggest mix settings and gain staging" },
  { label: "Generate arrangement", msg: "Generate arrangement structure intro buildup drop" },
  { label: "Create synth preset", msg: "Create a dark bass synth preset" },
  { label: "Split stems", msg: "Separate stems from this track" },
];

export function AIPanel() {
  const { chat, chatAI, aiBusy, pendingActions, applyAI, rejectAI, compatible, loadToDeck, library, peers, roomChat, locks } =
    useStudio();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"ai" | "room">("ai");
  const [roomText, setRoomText] = useState("");

  return (
    <aside className="w-[320px] border-l border-line bg-ink-900 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-line flex gap-2 text-[10px] tracking-[0.25em] uppercase">
        <button className={tab === "ai" ? "text-cyan" : "text-zinc-500"} onClick={() => setTab("ai")}>
          AI Producer
        </button>
        <button className={tab === "room" ? "text-cyan" : "text-zinc-500"} onClick={() => setTab("room")}>
          Room {peers.length ? `(${peers.length})` : ""}
        </button>
      </div>
      {tab === "room" ? (
        <>
          <div className="p-3 border-b border-line text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">On decks</div>
            {peers.length === 0 && <div className="text-zinc-600">Only you here</div>}
            {peers.map((p) => (
              <div key={p.clientId} className="flex justify-between text-zinc-300">
                <span>{p.name}</span>
                <span className="text-accent">{p.deck ? `Deck ${p.deck}` : "—"}</span>
              </div>
            ))}
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Locks</div>
            {Object.keys(locks).length === 0 && <div className="text-zinc-600">No exclusive edits</div>}
            {Object.entries(locks).map(([res, owner]) => (
              <div key={res} className="text-zinc-400">
                {res} → {owner.name}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2 text-sm">
            {roomChat.map((m, i) => (
              <div key={i}>
                <div className="text-[10px] uppercase text-accent">{m.name}</div>
                <div className="text-zinc-300">{m.text}</div>
              </div>
            ))}
          </div>
          <form
            className="p-2 border-t border-line flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const line = roomText.trim();
              if (!line) return;
              sendCollab({ type: "chat", text: line, ts: Date.now() });
              useStudio.setState({
                roomChat: [
                  ...useStudio.getState().roomChat,
                  { clientId: getCollabId(), name: collabName(), text: line, ts: Date.now() },
                ].slice(-80),
              });
              setRoomText("");
            }}
          >
            <input
              value={roomText}
              onChange={(e) => setRoomText(e.target.value)}
              placeholder="Room chat…"
              className="flex-1 bg-ink-800 border border-line rounded px-2 py-1.5 text-sm"
            />
            <button className="px-3 rounded bg-accent text-black text-xs font-semibold">Send</button>
          </form>
        </>
      ) : (
        <>
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
        {compatible.length > 0 && (
          <div className="border border-line rounded p-2">
            <div className="text-[10px] uppercase tracking-wider text-cyan mb-1">Compatible</div>
            {compatible.map((t) => (
              <button
                key={t.id}
                className="block w-full text-left text-xs py-1 text-zinc-300 hover:text-white"
                onClick={() => {
                  const file = library.find((f) => f.id === t.id);
                  if (file) void loadToDeck("B", file);
                }}
              >
                {(t.original_filename || t.name) as string} · {t.bpm} · {t.key}
              </button>
            ))}
          </div>
        )}
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
        </>
      )}
    </aside>
  );
}
