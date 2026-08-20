const API = import.meta.env.VITE_API_URL || "";

async function parse<T>(res: Response | Promise<Response>): Promise<T> {
  res = await res;
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${API}/api/health`).then((r) => r.json()),
  projects: {
    list: () => parse<Array<{ id: string; name: string; bpm: number; updated_at: string }>>(fetch(`${API}/api/projects`)),
    get: (id: string) => parse<import("../types").ProjectDetail>(fetch(`${API}/api/projects/${id}`)),
    create: (name: string, bpm = 120) =>
      parse<import("../types").ProjectDetail>(
        fetch(`${API}/api/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, bpm }),
        }),
      ),
    save: (id: string, patch: Record<string, unknown>) =>
      parse(
        fetch(`${API}/api/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
      ),
    remove: (id: string) => fetch(`${API}/api/projects/${id}`, { method: "DELETE" }).then((r) => r.json()),
    duplicate: (id: string) =>
      parse<import("../types").ProjectDetail>(fetch(`${API}/api/projects/${id}/duplicate`, { method: "POST" })),
    render: (id: string, format = "wav") =>
      parse(fetch(`${API}/api/projects/${id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      })),
    addTrack: (id: string, name: string, kind = "audio") =>
      parse(fetch(`${API}/api/projects/${id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      })),
    savePattern: (id: string, body: Record<string, unknown>) =>
      parse(fetch(`${API}/api/projects/${id}/patterns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })),
    saveSynth: (id: string, name: string, params: Record<string, unknown>) =>
      parse(fetch(`${API}/api/projects/${id}/synth-presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, params }),
      })),
  },
  audio: {
    list: () => parse<import("../types").AudioFile[]>(fetch(`${API}/api/audio`)),
    get: (id: string) => parse<import("../types").AudioFile>(fetch(`${API}/api/audio/${id}`)),
    analysis: (id: string) => parse<{ id: string; status: string; analysis: import("../types").AudioAnalysis | null }>(fetch(`${API}/api/audio/${id}/analysis`)),
    streamUrl: (id: string) => `${API}/api/audio/${id}/stream`,
    stemUrl: (id: string, stem: string) => `${API}/api/audio/${id}/stems/${stem}/stream`,
    splitStems: (id: string) => parse(fetch(`${API}/api/audio/${id}/stems`, { method: "POST" })),
    compatible: (bpm?: number, key?: string) => {
      const q = new URLSearchParams();
      if (bpm) q.set("bpm", String(bpm));
      if (key) q.set("key", key);
      return parse(fetch(`${API}/api/audio/compatible?${q}`));
    },
    upload: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return parse<import("../types").AudioFile>(fetch(`${API}/api/audio/upload`, { method: "POST", body }));
    },
  },
  ai: {
    chat: (projectId: string, message: string, context: Record<string, unknown> = {}, conversationId?: string) =>
      parse<{ conversation_id: string; message: string; actions: import("../types").AIAction[]; reasoning?: string }>(
        fetch(`${API}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, message, context, conversation_id: conversationId }),
        }),
      ),
    apply: (projectId: string, actions: import("../types").AIAction[]) =>
      parse(fetch(`${API}/api/ai/actions/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, actions }),
      })),
  },
};
