import { useState } from "react";
import { api } from "../../api/client";
import { t, useI18n } from "../../i18n";

function goodbyeScreen(): void {
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    "font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0b10;color:#a1a1aa;" +
    'text-align:center;padding:24px">' +
    "<div><p style=\"letter-spacing:0.3em;text-transform:uppercase;font-size:11px;color:#f59e0b;margin:0 0 12px\">ForgeDeck</p>" +
    `<p style="margin:0;font-size:18px;color:#e4e4e7">${t("quit.goodbye")}</p></div></div>`;
}

export function PowerOffButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  useI18n((s) => s.locale);

  async function quit() {
    if (busy) return;
    if (!window.confirm(t("quit.confirm"))) return;
    setBusy(true);
    if (window.forgedeckDesktop) {
      await window.forgedeckDesktop.quit();
      return;
    }
    try {
      await api.shutdown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const network = /failed to fetch|networkerror|load failed|abort/i.test(msg);
      if (msg && !network) {
        window.alert(msg);
        setBusy(false);
        return;
      }
    }
    try {
      window.close();
    } catch {
      /* browsers block close() unless this tab was opened by script */
    }
    goodbyeScreen();
  }

  return (
    <button
      type="button"
      title={t("quit.title")}
      disabled={busy}
      onClick={() => void quit()}
      className={
        compact
          ? "text-[10px] uppercase tracking-wider text-danger hover:text-red-300 disabled:opacity-50"
          : "px-3 py-1.5 rounded border border-danger/40 text-danger text-xs uppercase tracking-wider hover:bg-danger/10 disabled:opacity-50"
      }
    >
      {busy ? "…" : t("quit.button")}
    </button>
  );
}
