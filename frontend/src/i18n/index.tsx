import { create } from "zustand";
import { en, type Dict, type Locale } from "./en";
import { ru } from "./ru";

const KEY = "fd_locale";
const dicts: Record<Locale, Dict> = { en, ru };

function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ru") return saved;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ru")) return "ru";
  return "en";
}

type NestedKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends Record<string, unknown> ? `${K}.${NestedKey<T[K]>}` : never;
}[keyof T & string];

export type MsgKey = NestedKey<Dict>;

function lookup(dict: Dict, path: string): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return path;
  }
  return typeof cur === "string" ? cur : path;
}

function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function t(path: MsgKey, vars?: Record<string, string | number>): string {
  const locale = useI18n.getState().locale;
  return fill(lookup(dicts[locale], path), vars);
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18n = create<I18nState>((set) => ({
  locale: detect(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(KEY, locale);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = locale;
    set({ locale });
  },
}));

if (typeof document !== "undefined") {
  document.documentElement.lang = detect();
}

export function LanguageSelect({ compact = false, segmented = false }: { compact?: boolean; segmented?: boolean }) {
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const label = t("lang.label");
  if (segmented) {
    return (
      <div className="flex items-center rounded-md bg-ink-800 p-0.5" role="group" aria-label={label}>
        {(["ru", "en"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`h-7 px-2 rounded text-[11px] font-medium ${
              locale === code ? "bg-ink-600 text-white" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {t(code === "ru" ? "lang.ruShort" : "lang.enShort")}
          </button>
        ))}
      </div>
    );
  }
  return (
    <label className={`flex items-center gap-1 ${compact ? "text-[10px] uppercase tracking-wider text-zinc-400" : "text-xs text-zinc-400"}`}>
      {!compact && <span>{label}</span>}
      <select
        aria-label={label}
        className="bg-ink-800 border border-line rounded px-1.5 py-1 text-zinc-200"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="ru">{t("lang.ru")}</option>
        <option value="en">{t("lang.en")}</option>
      </select>
    </label>
  );
}

export type { Locale, Dict };
