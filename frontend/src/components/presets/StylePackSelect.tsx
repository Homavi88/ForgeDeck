import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useStudio } from "../../store/useStudio";
import type { StylePack, StylePackParts } from "../../types";

export function StylePackSelect({ parts, label }: { parts: StylePackParts; label: string }) {
  const [packs, setPacks] = useState<StylePack[]>([]);

  useEffect(() => {
    void api.presets
      .styles()
      .then(setPacks)
      .catch(() => undefined);
  }, []);

  return (
    <select
      className="bg-ink-800 border border-line rounded px-2 py-1 text-xs max-w-[14rem]"
      defaultValue=""
      aria-label={label}
      onChange={(e) => {
        const pack = packs.find((p) => p.id === e.target.value);
        e.currentTarget.value = "";
        if (pack) void useStudio.getState().applyStylePack(pack, parts);
      }}
    >
      <option value="">{label}</option>
      {packs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {p.bpm}
        </option>
      ))}
    </select>
  );
}
