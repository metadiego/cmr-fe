"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getPrintHubForPrinting } from "@/lib/api/print-hub";
import { buildHubRequestUrls, hubOrigin, hubStatusUrl } from "@/lib/print/hub-target";
import { checkHubs, sendToHubs, type HubHealth } from "@/lib/print/hub";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

interface Props {
  // Center that OWNS the invoice (`?centro=` or the invoice's clinicId), not "the active one".
  centerId: string | undefined;
  // Builds the ESC/POS bytes of the receipt (marks it printed on the BE, rasterizes the logo, ...).
  buildBytes: () => Promise<Uint8Array>;
}

type Health = { kind: "checking" } | HubHealth;

// Backup print button of the receipt viewer: raw ESC/POS through the print hub, for when the normal
// browser path fails. Not rendered when the center has no usable hub configuration. When it is
// configured, the hub and the destination printer are checked first: all good → the button works; hub
// down or printer off → the button shows, disabled, with the reason and a retry. Hubs are tried in the
// stored order (central, then e.g. the printer's own machine), for the check and for printing alike.
export function BackupPrintButton({ centerId, buildBytes }: Props) {
  const t = useTranslations("facturacion.print");
  const tRoot = useTranslations();
  const [requestUrls, setRequestUrls] = React.useState<string[]>([]);
  const [health, setHealth] = React.useState<Health>({ kind: "checking" });
  const [busy, setBusy] = React.useState(false);
  const [round, setRound] = React.useState(0);

  React.useEffect(() => {
    if (!centerId) return;
    let active = true;
    getPrintHubForPrinting(centerId)
      .then((hub) => active && setRequestUrls(buildHubRequestUrls(hub)))
      .catch(() => active && setRequestUrls([]));
    return () => {
      active = false;
    };
  }, [centerId]);

  React.useEffect(() => {
    if (requestUrls.length === 0) return;
    let active = true;
    checkHubs(requestUrls.map(hubStatusUrl)).then((h) => active && setHealth(h));
    return () => {
      active = false;
    };
  }, [requestUrls, round]);

  if (requestUrls.length === 0) return <span />;

  function retry() {
    setHealth({ kind: "checking" });
    setRound((r) => r + 1);
  }

  async function print() {
    setBusy(true);
    try {
      const i = await sendToHubs(requestUrls, await buildBytes());
      toast.success(i === 0 ? t("backupHubDone") : t("backupHubDoneFallback", { hub: new URL(requestUrls[i]).host }));
    } catch (err) {
      toastError(err, tRoot);
      retry();
    } finally {
      setBusy(false);
    }
  }

  const ready = health.kind === "ready";
  const reason =
    health.kind === "hubDown"
      ? t("backupHubDown")
      : health.kind === "printerDown"
        ? t(`backupPrinter.${health.state}`)
        : null;
  const origin = hubOrigin(requestUrls[0]);
  // Answered by a fallback hub: the main one (usually the printer's own PC) is down or its certificate
  // is not accepted in THIS browser. Said out loud, because a fallback may not see the printer's power.
  const viaFallback = (health.kind === "ready" || health.kind === "printerDown") && health.hub > 0;

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={print}
        disabled={!ready || busy}
        title={health.kind === "printerDown" ? health.detail : undefined}
      >
        {busy ? tRoot("common.loading") : health.kind === "checking" ? t("backupHubChecking") : t("backupHub")}
      </Button>
      {reason && (
        <p className="flex flex-wrap items-center gap-x-2 px-3 text-[11px] text-destructive" role="status">
          <span>{reason}</span>
          <button type="button" onClick={retry} className="underline underline-offset-2">
            {t("backupHubRetry")}
          </button>
          {health.kind === "hubDown" && origin && (
            <a href={origin} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" title={t("backupHubCertHint")}>
              {t("backupHubOpen")}
            </a>
          )}
        </p>
      )}
      {viaFallback && origin && (
        <p className="flex flex-wrap items-center gap-x-2 px-3 text-[11px] text-warning-foreground" role="status">
          <span>{t("backupHubFallbackNote", { hub: new URL(origin).host })}</span>
          <a href={origin} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" title={t("backupHubCertHint")}>
            {t("backupHubOpenMain")}
          </a>
          <button type="button" onClick={retry} className="underline underline-offset-2">
            {t("backupHubRetry")}
          </button>
        </p>
      )}
    </div>
  );
}
