"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { CashEmailSent } from "@/lib/api/caja";
import { getCentroPreferences, updateCentroPreferences } from "@/lib/api/preferences";
import { ApiError } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";
import { completeRecipients } from "@/lib/email/domains";
import { cashEmailFailure, parseRecipients, readDefaultRecipients, withDefaultRecipients } from "@/lib/caja/cash-email";
import type { ThemeConfig } from "@/lib/theme/config";
import { Button } from "@/components/ui/button";
import { EmailInput, useEmailDomains } from "@/components/email-input";
import { Label } from "@/components/ui/label";

// «Enviar por email» of a cash sheet (per cashier, consolidated or day total). Prefilled with the
// center's default list (preference caja.emailRecipients); empty = the BE uses that list. «Sent» is
// shown ONLY when the BE says the SMTP server accepted it; every failure shows its real reason inline.
export function CashEmailPanel({
  centerId,
  send,
}: {
  centerId?: string | null;
  send: (emails: string[]) => Promise<CashEmailSent>;
}) {
  const t = useTranslations("caja.emailPanel");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const centerConfig = React.useRef<ThemeConfig | null>(null);

  // Default list of the center. Reading center preferences may be admin-only: a failure just leaves
  // the field empty (the BE still falls back to the same list).
  React.useEffect(() => {
    if (!centerId) return;
    let alive = true;
    getCentroPreferences(centerId)
      .then((cfg) => {
        if (!alive) return;
        centerConfig.current = cfg;
        const list = readDefaultRecipients(cfg);
        if (list.length) setText((cur) => cur || list.join(", "));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [centerId]);

  // A bare user part counts as its completed address (house domain), so «larciles» is never «invalid».
  const domains = useEmailDomains();
  const { emails, invalid } = parseRecipients(completeRecipients(text, domains));

  async function onSend() {
    setBusy(true);
    setResult(null);
    try {
      const r = await send(emails);
      if (r?.sent) {
        const msg = t("sentTo", { to: (r.to ?? []).join(", ") });
        setResult({ ok: true, msg });
        toast.success(msg);
      } else {
        setResult({ ok: false, msg: t("notSent") });
      }
    } catch (err) {
      const kind = cashEmailFailure(err instanceof ApiError ? err : null);
      const msg = kind === "other" ? apiErrorMessage(err) : t(kind);
      setResult({ ok: false, msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDefault() {
    if (!centerId) return;
    try {
      const base = centerConfig.current ?? (await getCentroPreferences(centerId));
      const saved = await updateCentroPreferences(centerId, withDefaultRecipients(base, emails));
      centerConfig.current = saved ?? withDefaultRecipients(base, emails);
      toast.success(t("defaultSaved"));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm">
      <Label htmlFor="caja-email" className="text-xs">{t("recipients")}</Label>
      <EmailInput
        id="caja-email"
        multiple
        value={text}
        onValueChange={setText}
        className="h-9"
        placeholder={t("placeholder")}
      />
      <p className="text-[11px] text-muted-foreground">{t("hint")}</p>
      {invalid.length > 0 && <p className="text-xs text-destructive">{t("invalid", { list: invalid.join(", ") })}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || invalid.length > 0} onClick={onSend}>
          {busy ? t("sending") : t("send")}
        </Button>
        {centerId && (
          <Button size="sm" variant="ghost" disabled={busy || emails.length === 0 || invalid.length > 0} onClick={onSaveDefault}>
            {t("saveDefault")}
          </Button>
        )}
      </div>
      {result && (
        <p className={result.ok ? "text-xs font-medium text-success-foreground" : "text-xs font-medium text-destructive"}>{result.msg}</p>
      )}
    </div>
  );
}
