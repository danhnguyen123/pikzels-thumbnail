export interface Pricing {
  currency: string;
  updated: string;
  thumbnail: Record<string, number>;
  recreate: Record<string, number>;
  edit: number;
  score: number;
  titles: number;
  pikzonality: number;
}

export interface Config {
  key_ok: boolean;
  key_masked: string | null;
  base_url: string | null;
  key_error: string | null;
  models: string[];
  formats: string[];
  pricing: Pricing;
}

export interface ThumbResult {
  model: string;
  output: string;
  prompt_compacted: boolean;
  request_id: string;
}

export interface ScoreResult {
  main_score: number;
  subscores: Record<string, number>;
  suggestion?: string;
  request_id: string;
}

export interface HistoryItem {
  hid: number;
  kind: string;
  local_path?: string;
  model?: string;
  prompt?: string;
  format?: string;
  style?: string | null;
  persona?: string | null;
  created_at?: string;
  favorite?: boolean;
  score?: number | null;
}

export interface Pikzonality {
  id: string;
  name: string;
  mode: "style" | "persona";
  status: string;
  portrait_url?: string;
  special_instructions?: string;
  instruction_versions?: { text: string; at: string; restored_from?: number }[];
  created_at?: string;
}

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  config: () => req<Config>("/api/config"),
  thumbText: (b: any) => req<ThumbResult>("/api/thumbnail/text", { method: "POST", body: JSON.stringify(b) }),
  thumbImage: (b: any) => req<ThumbResult>("/api/thumbnail/image", { method: "POST", body: JSON.stringify(b) }),
  edit: (b: any) => req<ThumbResult>("/api/thumbnail/edit", { method: "POST", body: JSON.stringify(b) }),
  score: (b: any) => req<ScoreResult>("/api/thumbnail/score", { method: "POST", body: JSON.stringify(b) }),
  titles: (b: any) => req<{ outputs: string[]; reasoning?: string }>("/api/titles", { method: "POST", body: JSON.stringify(b) }),
  save: (b: any) => req<{ path: string }>("/api/save", { method: "POST", body: JSON.stringify(b) }),
  history: (p: { limit?: number; offset?: number; style?: string; persona?: string; favorite?: boolean; date_from?: string; date_to?: string }) => {
    const q = new URLSearchParams();
    if (p.limit != null) q.set("limit", String(p.limit));
    if (p.offset != null) q.set("offset", String(p.offset));
    if (p.style) q.set("style", p.style);
    if (p.persona) q.set("persona", p.persona);
    if (p.favorite) q.set("favorite", "1");
    if (p.date_from) q.set("date_from", p.date_from);
    if (p.date_to) q.set("date_to", p.date_to);
    return req<{ items: HistoryItem[]; total: number }>(`/api/history?${q.toString()}`);
  },
  historyImage: (hid: number) => `/api/history/${hid}/image`,
  setFavorite: (hid: number, favorite: boolean) =>
    req<{ favorite: boolean }>(`/api/history/${hid}/favorite`, { method: "POST", body: JSON.stringify({ favorite }) }),
  setHistoryScore: (request_id: string, score: number) =>
    req<{ ok: boolean }>("/api/history/score", { method: "POST", body: JSON.stringify({ request_id, score }) }),
  scoreHistory: (hid: number) =>
    req<ScoreResult>(`/api/history/${hid}/score`, { method: "POST" }),
  deleteHistory: (hid: number) =>
    req<{ ok: boolean }>(`/api/history/${hid}`, { method: "DELETE" }),
  deleteHistoryBulk: (hids: number[]) =>
    req<{ deleted: number }>("/api/history/delete", { method: "POST", body: JSON.stringify({ hids }) }),
  listPikz: () => req<Pikzonality[]>("/api/pikzonalities"),
  createPikz: (b: any) => req<Pikzonality>("/api/pikzonalities", { method: "POST", body: JSON.stringify(b) }),
  refreshPikz: (id: string) => req<Pikzonality>(`/api/pikzonalities/${id}/refresh`, { method: "POST" }),
  updateInstr: (id: string, special_instructions: string) =>
    req<Pikzonality>(`/api/pikzonalities/${id}`, { method: "PATCH", body: JSON.stringify({ special_instructions }) }),
  restoreInstr: (id: string, index: number) =>
    req<Pikzonality>(`/api/pikzonalities/${id}/restore/${index}`, { method: "POST" }),
  deletePikz: (id: string) => req<{ ok: boolean }>(`/api/pikzonalities/${id}`, { method: "DELETE" }),
};
