import { useState, useEffect } from "react";
import { Download, Upload, Pencil, Star, Loader2 } from "lucide-react";
import { api } from "../api";
import { fileToDataUrl, imgSrc } from "../lib";
import { Button, Card, Field, Input, Textarea, Select, Spinner, Lightbox, useToast } from "../ui";
import { useConfig } from "../App";
import { useI18n } from "../i18n";
import { editTarget, editState } from "../store";

export default function Edit() {
  const cfg = useConfig();
  const toast = useToast();
  const { t } = useI18n();
  const s = editState.use();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const u = editTarget.consume();
    if (u) editState.set({ imgUrl: u, srcPreview: imgSrc(u), imgB64: "", srcName: "" });
  }, []);

  const cost = cfg?.pricing.edit ?? 0;

  async function run() {
    if (!s.imgUrl && !s.imgB64) return toast(t("edit.needSource"), "error");
    editState.set({ busy: true });
    try {
      const res = await api.edit({
        prompt: s.prompt, format: s.fmt, image_url: s.imgUrl || null, image_base64: s.imgB64 || null,
        mask_url: s.maskUrl || null, mask_base64: s.maskB64 || null, support_image_url: s.supUrl || null,
      });
      editState.set({ res, busy: false, resScore: null });
    } catch (e: any) { editState.set({ busy: false }); toast(e.message, "error"); }
  }

  async function download(url: string) {
    const b = await (await fetch(imgSrc(url))).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "edited.png"; a.click();
    URL.revokeObjectURL(a.href);
  }

  async function scoreResult(url: string) {
    editState.set({ resScoring: true });
    try { editState.set({ resScore: await api.score({ image_url: url }), resScoring: false }); }
    catch (e: any) { editState.set({ resScoring: false }); toast(e.message, "error"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("edit.title")}</h1>
      <Card className="mb-4">
        <Field label={t("edit.srcUrl")}>
          <Input value={s.imgUrl} onChange={(e) => editState.set({ imgUrl: e.target.value })}
            onBlur={() => editState.set({ srcPreview: s.imgUrl.trim() ? imgSrc(s.imgUrl.trim()) : null })}
            placeholder="https://..." />
        </Field>
        <label className="btn btn-ghost cursor-pointer text-sm mb-3">
          <Upload size={15} /> {s.srcName || t("common.upload")}
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const b = await fileToDataUrl(f); editState.set({ imgB64: b, srcPreview: b, srcName: f.name }); } }} />
        </label>
        {s.srcPreview && (
          <div className="mt-1 mb-3">
            <span className="label">{t("edit.srcImage")}</span>
            <img src={s.srcPreview} onClick={() => setPreview(s.srcPreview)}
              className="rounded-lg max-h-56 border border-border cursor-zoom-in" />
          </div>
        )}
        <Field label={t("edit.promptEdit")}><Textarea rows={3} value={s.prompt} onChange={(e) => editState.set({ prompt: e.target.value })} /></Field>
        <Field label={t("create.format")}>
          <Select value={s.fmt} onChange={(e) => editState.set({ fmt: e.target.value })}
            options={(cfg?.formats || ["16:9"]).map((f) => ({ value: f, label: f }))} />
        </Field>
        <details className="mb-3">
          <summary className="text-sm text-muted cursor-pointer">{t("edit.maskSupport")}</summary>
          <div className="mt-2 space-y-2">
            <Input value={s.maskUrl} onChange={(e) => editState.set({ maskUrl: e.target.value })} placeholder={t("edit.maskUrlPh")} />
            <label className="btn btn-ghost cursor-pointer text-sm">
              <Upload size={15} /> {t("common.upload")}
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) editState.set({ maskB64: await fileToDataUrl(f) }); }} />
            </label>
            <Input value={s.supUrl} onChange={(e) => editState.set({ supUrl: e.target.value })} placeholder={t("edit.supportUrlPh")} />
          </div>
        </details>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={run} disabled={s.busy}>
            {s.busy ? <><Spinner /> {t("edit.running")}</> : <><Pencil size={16} /> {t("edit.run")}</>}
          </Button>
          <span className="text-sm font-medium text-muted">${cost.toFixed(2)}</span>
        </div>
      </Card>

      {s.res && (
        <Card>
          {s.res.prompt_compacted && <p className="text-xs text-amber-400 mb-2">{t("common.promptCompacted")}</p>}
          <img src={imgSrc(s.res.output)} onClick={() => setPreview(imgSrc(s.res!.output))}
            className="rounded-lg w-full mb-3 cursor-zoom-in" />
          <div className="flex gap-2">
            <Button onClick={() => download(s.res!.output)}><Download size={16} /> {t("common.download")}</Button>
            <Button disabled={s.resScoring} onClick={() => scoreResult(s.res!.output)}>
              {s.resScoring ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />} {t("score.run")}
            </Button>
          </div>
          {s.resScore && (
            <div className="mt-3 text-sm">
              <span className="text-2xl font-bold text-accent">{s.resScore.main_score}</span>
              <div className="text-muted mt-1">{Object.entries(s.resScore.subscores).map(([k, v]) => `${k}:${v}`).join(" · ")}</div>
              {s.resScore.suggestion && <div className="text-muted mt-1">{s.resScore.suggestion}</div>}
            </div>
          )}
        </Card>
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
