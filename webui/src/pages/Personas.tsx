import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2, Save, History, RotateCcw, Upload, Plus, Dna } from "lucide-react";
import { api, type Pikzonality } from "../api";
import { fileToDataUrl, imgSrc } from "../lib";
import { Button, Card, Field, Input, Textarea, Chip, Spinner, Lightbox, useToast } from "../ui";
import { useConfig } from "../App";
import { useI18n } from "../i18n";
import { personasState } from "../store";

export default function Personas() {
  const toast = useToast();
  const cfg = useConfig();
  const { t } = useI18n();
  const s = personasState.use();
  const [items, setItems] = useState<Pikzonality[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const cost = cfg?.pricing.pikzonality ?? 0;

  const reload = () => api.listPikz().then(setItems).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  // Preview 3 ảnh: ưu tiên file upload, nếu không thì lấy từ 3 dòng URL.
  const filePreviews = useMemo(() => s.files.map((f) => URL.createObjectURL(f)), [s.files]);
  useEffect(() => () => filePreviews.forEach((u) => URL.revokeObjectURL(u)), [filePreviews]);
  const urlPreviews = s.urls.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3);
  const previews: { src: string; full: string }[] = filePreviews.length
    ? filePreviews.map((u) => ({ src: u, full: u }))
    : urlPreviews.map((u) => ({ src: imgSrc(u), full: imgSrc(u) }));

  async function create() {
    const urlList = s.urls.split("\n").map((x) => x.trim()).filter(Boolean);
    const body: any = { mode: s.mode, name: s.name, special_instructions: s.instr || null };
    if (s.files.length === 3) body.image_base64s = await Promise.all(s.files.map(fileToDataUrl));
    else if (urlList.length === 3) body.image_urls = urlList;
    else return toast(t("pk.need3"), "error");
    if (!s.name.trim()) return toast(t("pk.needName"), "error");
    personasState.set({ busy: true });
    try {
      await api.createPikz(body);
      toast(t("pk.created"), "success");
      personasState.set({ name: "", urls: "", files: [], instr: "", busy: false });
      reload();
    } catch (e: any) { personasState.set({ busy: false }); toast(e.message, "error"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("pk.title")}</h1>

      <Card className="mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Plus size={16} /> {t("pk.createNew")}</h2>
        <div className="flex gap-2 mb-3">
          {(["style", "persona"] as const).map((m) => (
            <button key={m} onClick={() => personasState.set({ mode: m })} className={`btn ${s.mode === m ? "btn-primary" : "btn-ghost"}`}>
              {m === "style" ? "Style" : "Persona"}
            </button>
          ))}
        </div>
        <Field label={t("pk.name")}><Input value={s.name} onChange={(e) => personasState.set({ name: e.target.value })} /></Field>
        <Field label={t("pk.urls")}><Textarea rows={3} value={s.urls} onChange={(e) => personasState.set({ urls: e.target.value })} placeholder="https://...&#10;https://...&#10;https://..." /></Field>
        <label className="btn btn-ghost cursor-pointer text-sm mb-3">
          <Upload size={15} /> {s.files.length ? t("pk.nSelected", { n: s.files.length }) : t("pk.upload3")}
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => personasState.set({ files: Array.from(e.target.files || []) })} />
        </label>
        {previews.length > 0 && (
          <div className="flex gap-2 mb-3">
            {previews.map((p, i) => (
              <img key={i} src={p.src} onClick={() => setPreview(p.full)}
                className="w-24 h-24 rounded-lg object-cover border border-border cursor-zoom-in" />
            ))}
          </div>
        )}
        <Field label={t("pk.instr")}><Textarea rows={2} value={s.instr} onChange={(e) => personasState.set({ instr: e.target.value })} /></Field>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={create} disabled={s.busy}>
            {s.busy ? <><Spinner /> {t("pk.sending")}</> : <><Dna size={16} /> {t("pk.train")}</>}
          </Button>
          <span className="text-sm font-medium text-muted">${cost.toFixed(2)}</span>
        </div>
      </Card>

      <h2 className="font-semibold mb-3">{t("pk.list")}</h2>
      {loading ? <Spinner /> : items.length === 0 ? <p className="text-muted text-sm">{t("pk.empty")}</p> : (
        <div className="space-y-3">
          {items.map((it) => <PikzCard key={it.id} it={it} onChange={reload} />)}
        </div>
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function PikzCard({ it, onChange }: { it: Pikzonality; onChange: () => void }) {
  const toast = useToast();
  const { t } = useI18n();
  const [instr, setInstr] = useState(it.special_instructions || "");
  const [showHist, setShowHist] = useState(false);
  const versions = it.instruction_versions || [];

  const act = async (fn: () => Promise<any>, ok?: string) => {
    try { await fn(); if (ok) toast(ok, "success"); onChange(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const tone = it.status === "completed" ? "green" : it.status === "failed" ? "red" : "amber";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          {it.portrait_url && <img src={it.portrait_url} className="w-24 h-24 rounded-lg object-cover" />}
          <div>
            <div className="font-semibold">{it.name} <Chip>{it.mode}</Chip> <Chip tone={tone as any}>{it.status}</Chip></div>
            <div className="text-xs text-muted mt-1">{it.id}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="!py-1.5" onClick={() => act(() => api.refreshPikz(it.id))}><RefreshCw size={15} /> {t("common.refresh")}</Button>
          <Button className="!py-1.5" onClick={() => act(() => api.deletePikz(it.id))}><Trash2 size={15} /> {t("common.delete")}</Button>
        </div>
      </div>

      <div className="mt-3">
        <label className="label">{t("pk.instrLabel")}</label>
        <Textarea rows={3} value={instr} onChange={(e) => setInstr(e.target.value)} />
        <div className="flex gap-2 mt-2">
          <Button className="!py-1.5" onClick={() => act(() => api.updateInstr(it.id, instr), t("pk.updated"))}>
            <Save size={15} /> {t("pk.saveVersion")}
          </Button>
          {versions.length > 0 && (
            <Button className="!py-1.5" onClick={() => setShowHist((x) => !x)}>
              <History size={15} /> {t("pk.history", { n: versions.length })}
            </Button>
          )}
        </div>
      </div>

      {showHist && (
        <div className="mt-3 space-y-2">
          {versions.map((v, vi) => (
            <div key={vi} className="card p-3 text-xs">
              <div className="text-muted mb-1">
                v{vi + 1} · {v.at}{v.restored_from !== undefined ? ` (${t("pk.restoredFrom", { n: v.restored_from + 1 })})` : ""}
              </div>
              <div className="whitespace-pre-wrap">{v.text || t("pk.empty2")}</div>
              {vi !== versions.length - 1 && (
                <Button className="!py-1 mt-2" onClick={() => act(() => api.restoreInstr(it.id, vi), t("pk.restored"))}>
                  <RotateCcw size={13} /> {t("pk.restore")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
