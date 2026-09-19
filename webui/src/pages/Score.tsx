import { useState } from "react";
import { Upload, Star } from "lucide-react";
import { api } from "../api";
import { fileToDataUrl, imgSrc } from "../lib";
import { Button, Card, Field, Input, Spinner, Lightbox, useToast } from "../ui";
import { useConfig } from "../App";
import { useI18n } from "../i18n";
import { scoreState } from "../store";

export default function Score() {
  const cfg = useConfig();
  const toast = useToast();
  const { t } = useI18n();
  const s = scoreState.use();
  const [preview, setPreview] = useState<string | null>(null);
  const cost = cfg?.pricing.score ?? 0;

  async function run() {
    if (!s.url && !s.b64) return toast(t("score.needImage"), "error");
    scoreState.set({ busy: true });
    try {
      const res = await api.score({ image_url: s.url || null, image_base64: s.b64 || null, title: s.title || null });
      scoreState.set({ res, busy: false });
    } catch (e: any) { scoreState.set({ busy: false }); toast(e.message, "error"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("score.title")}</h1>
      <Card className="mb-4">
        <Field label={t("score.imageUrl")}>
          <Input value={s.url} onChange={(e) => scoreState.set({ url: e.target.value })}
            onBlur={() => scoreState.set({ srcPreview: s.url.trim() ? imgSrc(s.url.trim()) : null })}
            placeholder="https://..." />
        </Field>
        <label className="btn btn-ghost cursor-pointer text-sm mb-3">
          <Upload size={15} /> {s.name || t("common.upload")}
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const b = await fileToDataUrl(f); scoreState.set({ b64: b, name: f.name, srcPreview: b }); } }} />
        </label>
        {s.srcPreview && (
          <div className="mb-3">
            <span className="label">{t("score.image")}</span>
            <img src={s.srcPreview} onClick={() => setPreview(s.srcPreview)}
              className="rounded-lg max-h-56 border border-border cursor-zoom-in" />
          </div>
        )}
        <Field label={t("score.titleOpt")}><Input value={s.title} onChange={(e) => scoreState.set({ title: e.target.value })} /></Field>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={run} disabled={s.busy}>
            {s.busy ? <><Spinner /> {t("score.running")}</> : <><Star size={16} /> {t("score.run")}</>}
          </Button>
          <span className="text-sm font-medium text-muted">${cost.toFixed(2)}</span>
        </div>
      </Card>

      {s.res && (
        <Card>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-5xl font-bold text-accent">{s.res.main_score}</span>
            <span className="text-muted">/ 100</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {Object.entries(s.res.subscores).map(([k, v]) => (
              <div key={k} className="card p-3 text-center">
                <div className="text-2xl font-semibold">{v}</div>
                <div className="text-xs text-muted capitalize">{k}</div>
              </div>
            ))}
          </div>
          {s.res.suggestion && <p className="text-sm text-muted">{s.res.suggestion}</p>}
        </Card>
      )}

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
