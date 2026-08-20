const API = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "pf_token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function withAuth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

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
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

function j(url: string, method: string, body?: unknown) {
  return fetch(
    `${API}${url}`,
    withAuth({
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export const api = {
  health: () => fetch(`${API}/api/health`).then((r) => r.json()),
  shutdown: async () => {
    const res = await fetch(`${API}/api/shutdown`, withAuth({ method: "POST" }));
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
      const detail = body.detail;
      throw new Error(typeof detail === "string" ? detail : "Shutdown is only allowed from this computer");
    }
    return { ok: true as const };
  },
  auth: {
    register: (email: string, name: string, password: string) =>
      parse<{ access_token: string; user: { id: string; email: string; name: string } }>(
        j("/api/auth/register", "POST", { email, name, password }),
      ),
    login: (email: string, password: string) =>
      parse<{ access_token: string; user: { id: string; email: string; name: string } }>(
        j("/api/auth/login", "POST", { email, password }),
      ),
    me: () => parse<{ id: string; email: string; name: string }>(fetch(`${API}/api/auth/me`, withAuth())),
  },
  presets: {
    effects: () => parse<Array<{ id: string; name: string; effect_type: string; params: Record<string, number> }>>(fetch(`${API}/api/presets/effects`, withAuth())),
    saveEffect: (name: string, params: Record<string, number>, effect_type = "fx") =>
      parse(j("/api/presets/effects", "POST", { name, params, effect_type })),
    kits: () => parse<Array<{ id: string; name: string; pads: unknown[] }>>(fetch(`${API}/api/presets/kits`, withAuth())),
    saveKit: (name: string, pads: unknown[]) => parse(j("/api/presets/kits", "POST", { name, pads })),
    midi: () => parse<Array<{ id: string; name: string; bindings: { cc: Record<string, string>; notes: Record<string, string> } }>>(fetch(`${API}/api/presets/midi`, withAuth())),
    saveMidi: (name: string, bindings: Record<string, unknown>) => parse(j("/api/presets/midi", "POST", { name, bindings })),
  },
  projects: {
    list: () => parse<Array<{ id: string; name: string; bpm: number; updated_at: string }>>(fetch(`${API}/api/projects`, withAuth())),
    get: (id: string) => parse<import("../types").ProjectDetail>(fetch(`${API}/api/projects/${id}`, withAuth())),
    create: (name: string, bpm = 120) => parse<import("../types").ProjectDetail>(j("/api/projects", "POST", { name, bpm })),
    save: (id: string, patch: Record<string, unknown>) => parse(j(`/api/projects/${id}`, "PUT", patch)),
    remove: (id: string) => fetch(`${API}/api/projects/${id}`, withAuth({ method: "DELETE" })).then((r) => r.json()),
    duplicate: (id: string) => parse<import("../types").ProjectDetail>(fetch(`${API}/api/projects/${id}/duplicate`, withAuth({ method: "POST" }))),
    render: (id: string, format = "wav") => parse(j(`/api/projects/${id}/render`, "POST", { format })),
    uploadRender: async (id: string, blob: Blob) => {
      const body = new FormData();
      body.append("file", blob, "mix.wav");
      return parse(fetch(`${API}/api/projects/${id}/render/upload`, withAuth({ method: "POST", body })));
    },
    addTrack: (id: string, name: string, kind = "audio") => parse(j(`/api/projects/${id}/tracks`, "POST", { name, kind })),
    savePattern: (id: string, body: Record<string, unknown>) => parse(j(`/api/projects/${id}/patterns`, "POST", body)),
    saveSynth: (id: string, name: string, params: Record<string, unknown>) =>
      parse(j(`/api/projects/${id}/synth-presets`, "POST", { name, params })),
    share: (id: string) => parse<{ token: string; path: string }>(j(`/api/projects/${id}/share`, "POST")),
  },
  share: {
    get: (token: string) =>
      parse<{ name: string; bpm: number; musical_key: string; has_mix: boolean; token: string }>(
        fetch(`${API}/api/share/${token}`),
      ),
    mixUrl: (token: string) => `${API}/api/share/${token}/mix`,
  },
  audio: {
    list: () => parse<import("../types").AudioFile[]>(fetch(`${API}/api/audio`, withAuth())),
    get: (id: string) => parse<import("../types").AudioFile>(fetch(`${API}/api/audio/${id}`, withAuth())),
    analysis: (id: string) =>
      parse<{ id: string; status: string; analysis: import("../types").AudioAnalysis | null }>(
        fetch(`${API}/api/audio/${id}/analysis`, withAuth()),
      ),
    streamUrl: (id: string) => `${API}/api/audio/${id}/stream`,
    stemUrl: (id: string, stem: string) => `${API}/api/audio/${id}/stems/${stem}/stream`,
    splitStems: (id: string) => parse(fetch(`${API}/api/audio/${id}/stems`, withAuth({ method: "POST" }))),
    compatible: (bpm?: number, key?: string) => {
      const q = new URLSearchParams();
      if (bpm) q.set("bpm", String(bpm));
      if (key) q.set("key", key);
      return parse(fetch(`${API}/api/audio/compatible?${q}`, withAuth()));
    },
    upload: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return parse<import("../types").AudioFile>(fetch(`${API}/api/audio/upload`, withAuth({ method: "POST", body })));
    },
  },
  ai: {
    chat: (projectId: string, message: string, context: Record<string, unknown> = {}, conversationId?: string) =>
      parse<{ conversation_id: string; message: string; actions: import("../types").AIAction[]; reasoning?: string }>(
        j("/api/ai/chat", "POST", { project_id: projectId, message, context, conversation_id: conversationId }),
      ),
    apply: (projectId: string, actions: import("../types").AIAction[]) =>
      parse(j("/api/ai/actions/apply", "POST", { project_id: projectId, actions })),
  },
};
