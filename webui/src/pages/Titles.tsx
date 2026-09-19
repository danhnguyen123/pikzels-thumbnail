import { useState } from "react";
import { Copy, Upload, FileText } from "lucide-react";
import { api } from "../api";
import { fileToDataUrl, imgSrc } from "../lib";
import { Button, Card, Field, Input, Textarea, Spinner, Lightbox, useToast } from "../ui";
import { useConfig } from "../App";
import { useI18n } from "../i18n";
import { titlesState } from "../store";

export default function Titles() {
  const cfg = useConfig();
  const toast = useToast();
  const { t } = useI18n();
  const s = titlesState.use();
  const [preview, setPreview] = useState<string | null>(null);
  const cost = cfg?.pricing.titles ?? 0;

  async function run() {
    if (!s.prompt.trim() && !s.url && !s.b64) return toast(t("titles.needInput"), "error");
    titlesState.set({ busy: true });
    try {
      const res = await api.titles({ prompt: s.prompt || null, support_image_url: s.url || null, support_image_base64: s.b64 || null });
      titlesState.set({ res, busy: false });
    } catch (e: any) { titlesState.set({ busy: false }); toast(e.message, "error"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("titles.title")}</h1>
      <Card className="mb-4">
        <Field label={t("titles.promptLabel")}><Textarea rows={3} value={s.prompt} onChange={(e) => titlesState.set({ prompt: e.target.value })} /></Field>
        <Field label={t("titles.refImage")}>
          <Input value={s.url} onChange={(e) => titlesState.set({ url: e.target.value })}
            onBlur={() => titlesState.set({ srcPreview: s.url.trim() ? imgSrc(s.url.trim()) : null })} />
        </Field>
        <label className="btn btn-ghost cursor-pointer text-sm mb-3">
          <Upload size={15} /> {s.name || t("common.upload")}
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const b = await fileToDataUrl(f); titlesState.set({ b64: b, name: f.name, srcPreview: b }); } }} />
        </label>
        {s.srcPreview && (
          <div className="mb-3">
            <span className="label">{t("titles.refImage")}</span>
            <img src={s.srcPreview} onClick={() => setPreview(s.srcPreview)}
              className="rounded-lg max-h-56 border border-border cursor-zoom-in" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={run} disabled={s.busy}>
            {s.busy ? <><Spinner /> {t("titles.running")}</> : <><FileText size={16} /> {t("titles.run")}</>}
          </Button>
          <span className="text-sm font-medium text-muted">${cost.toFixed(2)}</span>
        </div>
      </Card>

      {s.res && (
        <div className="space-y-2">
          {s.res.outputs.map((tt, i) => (
            <Card key={i} className="flex items-center justify-between">
              <span className="font-medium">{tt}</span>
              <Button className="!py-1.5" onClick={() => { navigator.clipboard.writeText(tt); toast(t("titles.copied"), "success"); }}>
                <Copy size={15} /> {t("common.copy")}
              </Button>
            </Card>
          ))}
          {s.res.reasoning && (
            <details className="card p-4"><summary className="text-sm text-muted cursor-pointer">{t("titles.reasoning")}</summary>
              <p className="text-sm mt-2 text-muted">{s.res.reasoning}</p></details>
          )}
        </div>
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
