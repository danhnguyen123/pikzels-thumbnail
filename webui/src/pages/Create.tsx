import { useEffect, useState } from "react";
import { Download, Star, Save, Loader2, AlertTriangle, Pencil, Sparkles, Upload } from "lucide-react";
import { api, type Pikzonality } from "../api";
import { useConfig, useNav } from "../App";
import { imgSrc, fileToDataUrl } from "../lib";
import { Button, Field, Input, Textarea, Select, Card, Spinner, Lightbox, useToast } from "../ui";
import { useI18n } from "../i18n";
import { createStore, useCreateStore, editTarget, refTarget } from "../store";

function usePersisted<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    const s = localStorage.getItem(key);
    return s !== null ? (JSON.parse(s) as T) : init;
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)); }, [key, v]);
  return [v, setV];
}

export default function Create() {
  const cfg = useConfig();
  const toast = useToast();
  const nav = useNav();
  const { t } = useI18n();
  const store = useCreateStore();

  const [source, setSource] = usePersisted("c_source", "Text");
  const [model, setModel] = usePersisted("c_model", "pkz_4_5");
  const [fmt, setFmt] = usePersisted("c_fmt", "16:9");
  const [count, setCount] = usePersisted("c_count", 1);
  const [prompt, setPrompt] = usePersisted("c_prompt", "");
  const [persona, setPersona] = usePersisted<string>("c_persona", "");
  const [style, setStyle] = usePersisted<string>("c_style", "");
  const [folder, setFolder] = usePersisted("c_folder", "");

  const [supUrl, setSupUrl] = useState("");
  const [supB64, setSupB64] = useState("");
  const [supPreview, setSupPreview] = useState<string | null>(null);
  const [supOpen, setSupOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [imgB64, setImgB64] = useState("");

  const [pikz, setPikz] = useState<Pikzonality[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { api.listPikz().then(setPikz).catch(() => {}); }, []);

  // Nhận ảnh reference từ Gallery.
  useEffect(() => {
    const d = refTarget.consume();
    if (d) { setSupB64(d); setSupPreview(d); setSupOpen(true); }
  }, []);

  const supportsPS = model === "pkz_4" || model === "pkz_4_5";
  const personas = pikz.filter((p) => p.mode === "persona");
  const styles = pikz.filter((p) => p.mode === "style");
  const running = store.status === "running";

  function generate() {
    if (source === "Text" && !prompt.trim()) return toast(t("create.needPrompt"), "error");
    if (source === "Image" && !imgUrl && !imgB64) return toast(t("create.needSource"), "error");
    const meta = { prompt, format: fmt, style: supportsPS ? style || null : null, persona: supportsPS ? persona || null : null };
    createStore.reset(count, meta);

    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/generate`);
    ws.onopen = () => ws.send(JSON.stringify({
      source, prompt, model, format: fmt, count,
      persona: supportsPS ? persona : "", style: supportsPS ? style : "",
      support_image_url: supUrl, support_image_base64: supB64,
      image_url: imgUrl, image_base64: imgB64,
    }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "item")
        createStore.setItem(m.index, { loading: false, output: m.output, request_id: m.request_id, model: m.model, prompt_compacted: m.prompt_compacted });
      else if (m.type === "item_error")
        createStore.setItem(m.index, { loading: false, error: m.message });
      else if (m.type === "done") { createStore.done(); ws.close(); }
      else if (m.type === "error") { toast(m.message, "error"); createStore.done(); ws.close(); }
    };
    ws.onerror = () => toast(t("create.wsError"), "error");
  }

  async function download(url: string, i: number) {
    const r = await fetch(imgSrc(url));
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `thumbnail_${i + 1}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    // Lưu vào Gallery (1 lần / ảnh) để ảnh vừa tải xuất hiện trong Gallery.
    const it = store.items[i];
    if (it && !it.saved) {
      try {
        await api.save({ image_url: url, folder: null, kind: "create",
          meta: { ...store.meta, request_id: it.request_id, model: it.model, score: it.score?.main_score ?? null } });
        createStore.setItem(i, { saved: true });
      } catch { /* ignore */ }
    }
  }

  async function scoreItem(url: string, i: number) {
    createStore.setItem(i, { scoring: true });
    try {
      const sc = await api.score({ image_url: url });
      createStore.setItem(i, { score: sc, scoring: false });
      const rid = store.items[i]?.request_id;
      if (rid) api.setHistoryScore(rid, sc.main_score).catch(() => {}); // cập nhật nếu đã lưu
    } catch (e: any) { createStore.setItem(i, { scoring: false }); toast(e.message, "error"); }
  }

  async function saveAll() {
    const done = store.items.filter((it) => it.output);
    try {
      for (const it of done)
        await api.save({ image_url: it.output, folder: folder || null, kind: "create",
          meta: { ...store.meta, request_id: it.request_id, model: it.model, score: it.score?.main_score ?? null } });
      toast(t("create.savedN", { n: done.length }), "success");
    } catch (e: any) { toast(e.message, "error"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("create.title")}</h1>

      <Card className="mb-4">
        <div className="flex gap-2 mb-3">
          {["Text", "Image"].map((s) => (
            <button key={s} onClick={() => setSource(s)}
              className={`btn ${source === s ? "btn-primary" : "btn-ghost"}`}>{s}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label={t("create.model")}>
            <Select value={model} onChange={(e) => setModel(e.target.value)}
              options={(cfg?.models || ["pkz_4_5"]).map((m) => {
                const table = cfg?.pricing ? (source === "Image" ? cfg.pricing.recreate : cfg.pricing.thumbnail) : null;
                const p = table?.[m];
                return { value: m, label: p != null ? `${m} · $${p.toFixed(2)}` : m };
              })} />
          </Field>
          <Field label={t("create.format")}>
            <Select value={fmt} onChange={(e) => setFmt(e.target.value)}
              options={(cfg?.formats || ["16:9"]).map((f) => ({ value: f, label: f }))} />
          </Field>
          <Field label={t("create.count")}>
            <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}
              options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
          </Field>
        </div>

        <Field label={`${t("create.prompt")} (${t("create.chars", { n: prompt.length })}${prompt.length > 750 ? t("create.willTrim") : ""})`}>
          <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("create.promptPh")} />
        </Field>

        {supportsPS ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("create.persona")}>
              <Select value={persona} onChange={(e) => setPersona(e.target.value)}
                options={[{ value: "", label: "(none)" }, ...personas.map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
            <Field label={t("create.style")}>
              <Select value={style} onChange={(e) => setStyle(e.target.value)}
                options={[{ value: "", label: "(none)" }, ...styles.map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
          </div>
        ) : <p className="text-xs text-muted mb-2">{t("create.psOnly")}</p>}

        {source === "Image" && (
          <div className="grid grid-cols-1 gap-2 mb-2">
            <Field label={t("create.srcImage")}>
              <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder={t("create.srcImagePh")} />
            </Field>
            <FileRow label={t("common.upload")} onData={setImgB64} />
          </div>
        )}

        <details className="mb-3" open={supOpen} onToggle={(e) => setSupOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="text-sm text-muted cursor-pointer">{t("create.support")}</summary>
          <div className="mt-2">
            <Input value={supUrl} onChange={(e) => setSupUrl(e.target.value)}
              onBlur={() => setSupPreview(supUrl.trim() ? imgSrc(supUrl.trim()) : null)}
              placeholder={t("create.supportUrlPh")} />
            <div className="mt-2"><FileRow label={t("common.upload")} onData={(b) => { setSupB64(b); setSupPreview(b); }} /></div>
            {supPreview && (
              <img src={supPreview} onClick={() => setPreview(supPreview)}
                className="mt-2 rounded-lg max-h-40 border border-border cursor-zoom-in" />
            )}
          </div>
        </details>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={generate} disabled={running}>
            {running ? <><Spinner /> {t("create.generating")}</> : <><Sparkles size={16} /> {t("create.generate", { n: count })}</>}
          </Button>
          {(() => {
            const table = cfg?.pricing ? (source === "Image" ? cfg.pricing.recreate : cfg.pricing.thumbnail) : null;
            const unit = table?.[model];
            return unit != null ? <span className="text-sm font-medium text-muted">${(unit * count).toFixed(2)}</span> : null;
          })()}
        </div>
      </Card>

      {store.items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {t("create.results", { done: store.items.filter((i) => i.output).length, total: store.total })}
            </h2>
            {store.status !== "running" && (
              <div className="flex items-center gap-2">
                <Input placeholder={t("create.folder")} value={folder}
                  onChange={(e) => setFolder(e.target.value)} className="w-80" />
                <Button onClick={saveAll}><Save size={16} /> {t("create.saveAll")}</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {store.items.map((it) => (
              <Card key={it.index} className="p-3">
                <div className="aspect-video rounded-lg overflow-hidden bg-panel border border-border flex items-center justify-center mb-2">
                  {it.loading ? (
                    <div className="flex flex-col items-center text-muted text-sm gap-2">
                      <Loader2 className="animate-spin" size={22} /> {t("create.genItem", { n: it.index + 1 })}
                    </div>
                  ) : it.error ? (
                    <div className="flex flex-col items-center text-red-400 text-xs gap-1 p-2 text-center">
                      <AlertTriangle size={20} /> {it.error}
                    </div>
                  ) : (
                    <img src={imgSrc(it.output!)} onClick={() => setPreview(imgSrc(it.output!))}
                      className="w-full h-full object-cover cursor-zoom-in" />
                  )}
                </div>
                {it.prompt_compacted && <p className="text-xs text-amber-400 mb-1">{t("common.promptCompacted")}</p>}
                {it.output && (
                  <div className="flex gap-2">
                    <Button className="!py-1.5" title={t("nav.edit")}
                      onClick={() => { editTarget.set(it.output!); nav("Edit"); }}><Pencil size={15} /> {t("nav.edit")}</Button>
                    <Button className="flex-1 !py-1.5" onClick={() => download(it.output!, it.index)}><Download size={15} /> {t("common.download")}</Button>
                    <Button className="flex-1 !py-1.5" disabled={it.scoring}
                      onClick={() => scoreItem(it.output!, it.index)}>
                      {it.scoring ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />} {t("score.run")}
                    </Button>
                  </div>
                )}
                {it.score && (
                  <div className="mt-2 text-xs">
                    <div className="text-2xl font-bold text-accent">{it.score.main_score}</div>
                    <div className="text-muted">{Object.entries(it.score.subscores).map(([k, v]) => `${k}:${v}`).join(" · ")}</div>
                    {it.score.suggestion && <div className="text-muted mt-1">{it.score.suggestion}</div>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function FileRow({ label, onData }: { label: string; onData: (b64: string) => void }) {
  const [name, setName] = useState("");
  return (
    <label className="btn btn-ghost cursor-pointer text-sm">
      <Upload size={15} /> {name || label}
      <input type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { setName(f.name); onData(await fileToDataUrl(f)); }
        }} />
    </label>
  );
}
