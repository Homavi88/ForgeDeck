import { useStudio, type Toast } from "../../store/useStudio";

const KIND: Record<Toast["kind"], string> = {
  ok: "border-mint/40 text-mint",
  info: "border-cyan/40 text-cyan",
  warn: "border-warn/40 text-warn",
  err: "border-danger/50 text-danger",
};

export function ToastHost() {
  const toasts = useStudio((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-md border bg-ink-800/95 px-3 py-2 text-xs shadow-panel ${KIND[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
