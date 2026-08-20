import { useState } from "react";
import { t, useI18n } from "../../i18n";
import { collabName, getCollabId, sendCollab } from "../../store/useProjectSync";
import { useStudio } from "../../store/useStudio";

const QUICK = [
  { label: "ai.qAnalyze", msg: "ai.qAnalyzeM" },
  { label: "ai.qTrans", msg: "ai.qTransM" },
  { label: "ai.qComp", msg: "ai.qCompM" },
  { label: "ai.qDrum", msg: "ai.qDrumM" },
  { label: "ai.qBass", msg: "ai.qBassM" },
  { label: "ai.qMel", msg: "ai.qMelM" },
  { label: "ai.qChords", msg: "ai.qChordsM" },
  { label: "ai.qArr", msg: "ai.qArrM" },
  { label: "ai.qMix", msg: "ai.qMixM" },
  { label: "ai.qSynth", msg: "ai.qSynthM" },
  { label: "ai.qStems", msg: "ai.qStemsM" },
] as const;

export function AIPanel() {
  const { chat, chatAI, aiBusy, pendingActions, applyAI, rejectAI, compatible, loadToDeck, library, peers, roomChat, locks } =
    useStudio();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"ai" | "room">("ai");
  const [roomText, setRoomText] = useState("");
  useI18n((s) => s.locale);

  return (
    <aside className="w-[320px] border-l border-line bg-ink-900 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-line flex gap-2 text-[10px] tracking-[0.25em] uppercase">
        <button className={tab === "ai" ? "text-cyan" : "text-zinc-500"} onClick={() => setTab("ai")}>
          {t("ai.producer")}
        </button>
        <button className={tab === "room" ? "text-cyan" : "text-zinc-500"} onClick={() => setTab("room")}>
          {t("ai.room")} {peers.length ? `(${peers.length})` : ""}
        </button>
      </div>
      {tab === "room" ? (
        <>
          <div className="p-3 border-b border-line text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t("ai.onDecks")}</div>
            {peers.length === 0 && <div className="text-zinc-600">{t("ai.onlyYou")}</div>}
            {peers.map((p) => (
              <div key={p.clientId} className="flex justify-between text-zinc-300">
                <span>{p.name}</span>
                <span className="text-accent">{p.deck ? `Deck ${p.deck}` : "—"}</span>
              </div>
            ))}
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">{t("ai.locks")}</div>
            {Object.keys(locks).length === 0 && <div className="text-zinc-600">{t("ai.noLocks")}</div>}
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
              placeholder={t("ai.roomPh")}
              className="flex-1 bg-ink-800 border border-line rounded px-2 py-1.5 text-sm"
            />
            <button className="px-3 rounded bg-accent text-black text-xs font-semibold">{t("ai.send")}</button>
          </form>
        </>
      ) : (
        <>
      <div className="p-2 flex flex-wrap gap-1 border-b border-line">
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={() => void chatAI(t(q.msg))}
            className="text-[10px] px-2 py-1 rounded bg-ink-700 hover:bg-ink-600 text-zinc-300"
          >
            {t(q.label)}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {chat.length === 0 && (
          <div className="text-zinc-400">
            <div className="text-[10px] uppercase tracking-wider mb-1 text-accent">{t("ai.assistant")}</div>
            {t("ai.greeting")}
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-zinc-200" : "text-zinc-400"}>
            <div className="text-[10px] uppercase tracking-wider mb-1 text-accent">
              {m.role === "user" ? t("ai.you") : t("ai.assistant")}
            </div>
            {m.content}
          </div>
        ))}
        {aiBusy && <div className="text-xs text-zinc-500 animate-pulse">{t("ai.thinking")}</div>}
        {compatible.length > 0 && (
          <div className="border border-line rounded p-2">
            <div className="text-[10px] uppercase tracking-wider text-cyan mb-1">{t("ai.compatible")}</div>
            {compatible.map((track) => (
              <button
                key={track.id}
                className="block w-full text-left text-xs py-1 text-zinc-300 hover:text-white"
                onClick={() => {
                  const file = library.find((f) => f.id === track.id);
                  if (file) void loadToDeck("B", file);
                }}
              >
                {(track.original_filename || track.name) as string} · {track.bpm} · {track.key}
              </button>
            ))}
          </div>
        )}
      </div>
      {pendingActions.length > 0 && (
        <div className="border-t border-line p-3 bg-ink-800">
          <div className="text-[10px] uppercase tracking-wider text-warn mb-2">{t("ai.preview")}</div>
          <ul className="text-xs space-y-1 max-h-32 overflow-auto font-mono text-zinc-400">
            {pendingActions.map((a, i) => (
              <li key={i}>{a.type}</li>
            ))}
          </ul>
          <div className="flex gap-2 mt-2">
            <button onClick={() => void applyAI()} className="flex-1 bg-mint text-black text-xs py-1.5 rounded font-semibold">
              {t("ai.apply")}
            </button>
            <button onClick={rejectAI} className="flex-1 bg-ink-700 text-xs py-1.5 rounded">
              {t("ai.reject")}
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
          placeholder={t("ai.askPh")}
          className="flex-1 bg-ink-800 border border-line rounded px-2 py-1.5 text-sm"
        />
        <button className="px-3 rounded bg-accent text-black text-xs font-semibold">{t("ai.send")}</button>
      </form>
        </>
      )}
    </aside>
  );
}
