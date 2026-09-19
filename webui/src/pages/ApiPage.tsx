import { useState } from "react";
import { Plug } from "lucide-react";
import { api } from "../api";
import { useConfig } from "../App";
import { useI18n } from "../i18n";
import { Button, Card, Field, Input, Chip, Spinner, useToast } from "../ui";

export default function ApiPage() {
  const cfg = useConfig();
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function test() {
    setBusy(true);
    try { await api.titles({ prompt: "test" }); toast(t("api.ok"), "success"); }
    catch (e: any) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("api.title")}</h1>
      <Card className="max-w-xl">
        {cfg?.key_ok ? (
          <>
            <div className="mb-3"><Chip tone="green">{t("api.loaded")}</Chip></div>
            <Field label={t("api.key")}><Input value={cfg.key_masked || ""} disabled /></Field>
            <Field label={t("api.baseUrl")}><Input value={cfg.base_url || ""} disabled /></Field>
            <Button variant="primary" onClick={test} disabled={busy}>
              {busy ? <><Spinner /> {t("api.testing")}</> : <><Plug size={16} /> {t("api.test")}</>}
            </Button>
          </>
        ) : (
          <div className="text-sm">
            <div className="mb-2"><Chip tone="red">{t("api.noKey")}</Chip></div>
            <p className="text-muted mb-2">{cfg?.key_error}</p>
            <p className="text-muted">{t("api.help")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
