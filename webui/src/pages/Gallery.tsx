import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Heart, X, Star, Trash2 } from "lucide-react";
import { api, type HistoryItem, type Pikzonality } from "../api";
import { Card, Select, Button, Input, Lightbox, useToast } from "../ui";
import { useNav } from "../App";
import { useI18n } from "../i18n";
import { refTarget } from "../store";
import { cn } from "../lib";

const PAGE = 24;

function Tag({ kind, children }: { kind: "model" | "style" | "persona"; children: React.ReactNode }) {
  const map = {
    model: "bg-indigo-500/15 text-indigo-300",
    style: "bg-amber-500/15 text-amber-300",
    persona: "bg-pink-500/15 text-pink-300",
  } as const;
  return <span className={cn("chip", map[kind])}>{children}</span>;
}

function scoreClass(v: number) {
  if (v < 40) return "bg-red-500/20 text-red-300";
  if (v < 60) return "bg-amber-500/20 text-amber-300";
  if (v < 80) return "bg-blue-500/20 text-blue-300";
  return "bg-emerald-500/20 text-emerald-300";
}

export default function Gallery() {
  const toast = useToast();
  const nav = useNav();
  const { t } = useI18n();

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fStyle, setFStyle] = useState("");
  const [fPersona, setFPersona] = useState("");
  const [fFav, setFFav] = useState(false);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [pikz, setPikz] = useState<Pikzonality[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [scoring, setScoring] = useState<Record<number, boolean>>({});
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [confirmHids, setConfirmHids] = useState<number[] | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  useEffect(() => { api.listPikz().then(setPikz).catch(() => {}); }, []);
  const nameOf = (id?: string | null) => pikz.find((p) => p.id === id)?.name;

  async function load(reset: boolean) {
    if (loading) return;
    setLoading(true);
    try {
      const off = reset ? 0 : items.length;
      const r = await api.history({ limit: PAGE, offset: off, style: fStyle || undefined,
        persona: fPersona || undefined, favorite: fFav || undefined,
        date_from: fFrom || undefined, date_to: fTo || undefined });
      setTotal(r.total);
      setItems(reset ? r.items : [...items, ...r.items]);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(true); setSelected(new Set()); /* eslint-disable-next-line */ }, [fStyle, fPersona, fFav, fFrom, fTo]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !loading && items.length < total) load(false);
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, [loading, items.length, total, fStyle, fPersona, fFav, fFrom, fTo]);

  async function useAsRef(hid: number) {
    try {
      const blob = await (await fetch(api.historyImage(hid))).blob();
      const reader = new FileReader();
      reader.onload = () => { refTarget.set(reader.result as string); toast(t("gal.refUsed"), "success"); nav("Create"); };
      reader.readAsDataURL(blob);
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function scoreOne(hid: number) {
    setScoring((m) => ({ ...m, [hid]: true }));
    try {
      const sc = await api.scoreHistory(hid);
      setItems((xs) => xs.map((x) => (x.hid === hid ? { ...x, score: sc.main_score } : x)));
    } catch (e: any) { toast(e.message, "error"); }
    finally { setScoring((m) => ({ ...m, [hid]: false })); }
  }

  async function toggleFav(it: HistoryItem) {
    const next = !it.favorite;
    setItems((xs) => xs.map((x) => (x.hid === it.hid ? { ...x, favorite: next } : x)));
    try { await api.setFavorite(it.hid, next); }
    catch (e: any) { toast(e.message, "error"); setItems((xs) => xs.map((x) => (x.hid === it.hid ? { ...x, favorite: !next } : x))); }
  }

  async function doDelete(hids: number[]) {
    try {
      if (hids.length === 1) await api.deleteHistory(hids[0]);
      else await api.deleteHistoryBulk(hids);
      const set = new Set(hids);
      setItems((xs) => xs.filter((x) => !set.has(x.hid)));
      setSelected((s) => { const n = new Set(s); hids.forEach((h) => n.delete(h)); return n; });
      setTotal((n) => Math.max(0, n - hids.length));
    } catch (e: any) { toast(e.message, "error"); }
    finally { setConfirmHids(null); }
  }

  function toggleSel(hid: number) {
    setSelected((s) => { const n = new Set(s); n.has(hid) ? n.delete(hid) : n.add(hid); return n; });
  }

  // Kéo-thả chuột để chọn (rubber-band)
  function onGridDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("button,input,a,select")) return;
    const wrap = rootRef.current;
    if (!wrap) return;
    const startX = e.clientX, startY = e.clientY;
    const additive = e.shiftKey || e.ctrlKey;
    const onCardEl = targetEl.closest("[data-hid]") as HTMLElement | null;
    const isImg = !!targetEl.closest("img");
    const base = additive ? new Set(selected) : new Set<number>();
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      moved = true;
      const rect = { left: Math.min(startX, ev.clientX), top: Math.min(startY, ev.clientY), right: Math.max(startX, ev.clientX), bottom: Math.max(startY, ev.clientY) };
      const wr = wrap.getBoundingClientRect();
      setDragRect({ x: rect.left - wr.left, y: rect.top - wr.top, w: rect.right - rect.left, h: rect.bottom - rect.top });
      const next = new Set(base);
      wrap.querySelectorAll<HTMLElement>("[data-hid]").forEach((cel) => {
        const b = cel.getBoundingClientRect();
        if (!(b.right < rect.left || b.left > rect.right || b.bottom < rect.top || b.top > rect.bottom))
          next.add(Number(cel.dataset.hid));
      });
      setSelected(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragRect(null);
      if (moved) { suppressClick.current = true; setTimeout(() => (suppressClick.current = false), 50); }
      else if (onCardEl && !isImg) toggleSel(Number(onCardEl.dataset.hid)); // click vùng trống trong ô -> chọn/bỏ
      else if (!onCardEl && !additive) setSelected(new Set());              // click nền ngoài -> bỏ chọn
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const styles = pikz.filter((p) => p.mode === "style");
  const personas = pikz.filter((p) => p.mode === "persona");

  const groups: { date: string; items: HistoryItem[] }[] = [];
  for (const it of items) {
    const d = (it.created_at || "").slice(0, 10) || "—";
    const g = groups[groups.length - 1];
    if (g && g.date === d) g.items.push(it);
    else groups.push({ date: d, items: [it] });
  }

  return (
    <div ref={rootRef} className="relative select-none min-h-[80vh]" onMouseDown={onGridDown}>
      {dragRect && (
        <div className="absolute z-30 border border-brand bg-brand/20 pointer-events-none rounded"
          style={{ left: dragRect.x, top: dragRect.y, width: dragRect.w, height: dragRect.h }} />
      )}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t("gal.title")}</h1>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Select value={fStyle} onChange={(e) => setFStyle(e.target.value)} className="!w-36"
            options={[{ value: "", label: `${t("gal.style")}: ${t("gal.all")}` }, ...styles.map((s) => ({ value: s.id, label: s.name }))]} />
          <Select value={fPersona} onChange={(e) => setFPersona(e.target.value)} className="!w-36"
            options={[{ value: "", label: `${t("gal.persona")}: ${t("gal.all")}` }, ...personas.map((p) => ({ value: p.id, label: p.name }))]} />
          <span className="text-muted">{t("gal.from")}</span>
          <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="!w-36" />
          <span className="text-muted">{t("gal.to")}</span>
          <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="!w-36" />
          {(fFrom || fTo) && <Button className="!py-1.5" onClick={() => { setFFrom(""); setFTo(""); }}><X size={14} /> {t("gal.clear")}</Button>}
          <Button className={cn("!py-1.5", fFav && "!bg-brand !text-white")} onClick={() => setFFav((v) => !v)}>
            <Heart size={15} className={fFav ? "fill-current" : ""} /> {t("gal.favOnly")}
          </Button>
          {selected.size > 0 && (
            <Button className="!py-1.5 !bg-red-600 !text-white hover:!bg-red-700 !border-red-600" onClick={() => setConfirmHids([...selected])}>
              <Trash2 size={15} /> {t("gal.deleteN", { n: selected.size })}
            </Button>
          )}
        </div>
      </div>
      <div className="text-xs text-muted mb-4">{t("gal.loaded", { n: items.length, total })}</div>

      {items.length === 0 && !loading ? (
        <div className="card p-10 text-center text-muted flex flex-col items-center gap-2">
          <ImageIcon size={28} /> {t("gal.empty")}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.date}>
              <h2 className="text-sm font-semibold text-muted border-b border-border pb-1 mb-3">{g.date}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {g.items.map((it) => {
                  const sel = selected.has(it.hid);
                  return (
                    <div key={it.hid} data-hid={it.hid}>
                      <Card className={cn("p-2", sel && "!border-brand ring-1 ring-brand")}>
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-panel border border-border mb-2">
                          {broken.has(it.hid) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted text-xs gap-1 p-2 text-center">
                              <ImageIcon size={20} /> {t("gal.missing")}
                            </div>
                          ) : (
                            <img src={api.historyImage(it.hid)} loading="lazy"
                              onError={() => setBroken((s) => new Set(s).add(it.hid))}
                              onClick={() => { if (!suppressClick.current) setPreview(api.historyImage(it.hid)); }}
                              className="w-full h-full object-cover cursor-zoom-in" />
                          )}
                          <button onClick={() => toggleFav(it)} title={t("gal.favOnly")}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 hover:bg-black/70">
                            <Heart size={16} className={it.favorite ? "fill-red-500 text-red-500" : "text-white"} />
                          </button>
                        </div>
                        <div className="flex gap-1 flex-wrap mb-2">
                          {it.model && <Tag kind="model">{it.model}</Tag>}
                          {nameOf(it.style) && <Tag kind="style">{nameOf(it.style)}</Tag>}
                          {nameOf(it.persona) && <Tag kind="persona">{nameOf(it.persona)}</Tag>}
                          {it.score != null && <span className={cn("chip", scoreClass(it.score))}>{it.score}</span>}
                        </div>
                        {it.prompt && <div className="text-xs text-muted line-clamp-2 opacity-80 mb-2">{it.prompt}</div>}
                        <div className="flex gap-1.5">
                          <Button className="flex-1 !py-1.5 !px-2" onClick={() => useAsRef(it.hid)}>
                            <ImageIcon size={14} /> {t("gal.reference")}
                          </Button>
                          <Button className="!py-1.5 !px-2" disabled={scoring[it.hid]} onClick={() => scoreOne(it.hid)} title={t("gal.score")}>
                            {scoring[it.hid] ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                          </Button>
                          <Button className="!py-1.5 !px-2 !text-red-400 hover:!bg-red-500/15" onClick={() => setConfirmHids([it.hid])} title={t("gal.delete")}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={sentinel} className="h-10 flex items-center justify-center mt-4">
        {loading && <span className="text-muted text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> {t("gal.loading")}</span>}
      </div>

      {confirmHids && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => { e.stopPropagation(); setConfirmHids(null); }}>
          <div className="card p-6 max-w-sm w-full" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-red-400 font-semibold">
              <Trash2 size={18} /> {t("gal.delete")}
            </div>
            <p className="text-sm text-muted mb-5">{t("gal.confirmDel", { n: confirmHids.length })}</p>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setConfirmHids(null)}>{t("gal.cancel")}</Button>
              <Button className="!bg-red-600 !text-white hover:!bg-red-700 !border-red-600" onClick={() => doDelete(confirmHids)}>
                <Trash2 size={15} /> {t("gal.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
