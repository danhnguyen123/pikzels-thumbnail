import { useSyncExternalStore } from "react";
import type { ThumbResult, ScoreResult } from "./api";

// Store module-level dùng chung: state sống ngoài React nên KHÔNG mất khi chuyển tab
// (kể cả khi request async đang chạy — kết quả về vẫn ghi vào store).
export function makeStore<T extends object>(initial: T) {
  let state: T = { ...initial };
  const listeners = new Set<() => void>();
  const get = () => state;
  const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  const set = (patch: Partial<T>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
  const use = () => useSyncExternalStore(subscribe, get);
  return { get, set, subscribe, use };
}

export const editState = makeStore({
  imgUrl: "", imgB64: "", maskUrl: "", maskB64: "", supUrl: "",
  prompt: "", fmt: "16:9", busy: false,
  res: null as ThumbResult | null, srcPreview: null as string | null, srcName: "",
  resScore: null as ScoreResult | null, resScoring: false,
});

export const scoreState = makeStore({
  url: "", b64: "", name: "", title: "", busy: false, res: null as ScoreResult | null,
  srcPreview: null as string | null,
});

export const titlesState = makeStore({
  prompt: "", url: "", b64: "", name: "", busy: false,
  res: null as { outputs: string[]; reasoning?: string } | null,
  srcPreview: null as string | null,
});

export const personasState = makeStore({
  mode: "style" as "style" | "persona", name: "", urls: "", instr: "",
  files: [] as File[], busy: false,
});

export interface GenItem {
  id: number;
  createdAt: string;       // ISO — dùng lọc "hôm nay"
  loading: boolean;
  output?: string;         // URL Pikzels (proxy khi hiển thị; hết hạn 24h)
  request_id?: string;
  model?: string;
  prompt?: string;
  format?: string;
  style?: string | null;
  persona?: string | null;
  prompt_compacted?: boolean;
  error?: string;
  scoring?: boolean;
  saved?: boolean;
  score?: { main_score: number; subscores: Record<string, number>; suggestion?: string };
}

export type BatchMeta = { prompt?: string; format?: string; model?: string; style?: string | null; persona?: string | null };

interface CreateState { items: GenItem[]; }

const LS_KEY = "create_items_v1";
const today = () => new Date().toISOString().slice(0, 10);

let state: CreateState = { items: [] };
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ date: today(), nextId, items: state.items })); } catch { /* ignore */ }
}

// Khôi phục khi F5: chỉ giữ nếu cùng ngày; bỏ item còn dở (loading) do WebSocket đã đứt.
(function restore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.date !== today()) { localStorage.removeItem(LS_KEY); return; } // sang ngày mới -> tự clear
    const items: GenItem[] = (d.items || []).filter((it: GenItem) => !it.loading)
      .map((it: GenItem) => ({ ...it, scoring: false }));
    state = { items };
    nextId = d.nextId || items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
  } catch { /* ignore */ }
})();

export const createStore = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  // Thêm 1 lô mới (không xoá lô cũ); trả về mảng id theo thứ tự để WebSocket map theo index.
  addBatch(count: number, meta: BatchMeta): number[] {
    const ts = new Date().toISOString();
    const ids: number[] = [];
    const fresh: GenItem[] = [];
    for (let k = 0; k < count; k++) {
      const id = nextId++;
      ids.push(id);
      fresh.push({ id, createdAt: ts, loading: true, ...meta });
    }
    state = { items: [...fresh, ...state.items] }; // lô mới lên đầu
    persist(); emit();
    return ids;
  },
  setItem(id: number, patch: Partial<GenItem>) {
    state = { items: state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    persist(); emit();
  },
  remove(id: number) {
    state = { items: state.items.filter((it) => it.id !== id) };
    persist(); emit();
  },
  clear() { state = { items: [] }; persist(); emit(); },
};

export function useCreateStore() {
  return useSyncExternalStore(createStore.subscribe, createStore.get);
}

// Chuyển ảnh sang tab Edit (dùng khi bấm nút Edit ở ô ảnh).
let editUrl = "";
const editListeners = new Set<() => void>();
export const editTarget = {
  get: () => editUrl,
  set(url: string) { editUrl = url; editListeners.forEach((l) => l()); },
  consume() { const u = editUrl; editUrl = ""; return u; },
  subscribe(l: () => void) { editListeners.add(l); return () => editListeners.delete(l); },
};

// Chuyển ảnh (data URL base64) sang Create làm reference/support image (từ Gallery).
let refData = "";
export const refTarget = {
  set(dataUrl: string) { refData = dataUrl; },
  consume() { const u = refData; refData = ""; return u; },
};
