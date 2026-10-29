"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Alert02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BackupPrintButton } from "@/components/facturacion/backup-print-button";
import { RECEIPT_STATUS_MESSAGE, type ReceiptStatusMessage } from "@/lib/print/receipt-status-message";

type Status = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

/**
 * The receipt viewer: an iframe to the dedicated page /print/invoice/:id?embed=1 (just the receipt, like
 * the legacy print.php) so the user never leaves billing, plus "Print" — which opens that same page in a
 * new tab, where it prints itself. The iframe reports back (postMessage) whether the receipt loaded; until
 * it does, Print stays disabled, and on failure the dialog shows the backend's reason with a retry
 * instead of a blank sheet.
 *
 * `centerId` is ALWAYS sent in the URL: the page lives in its own document with no state shared with this
 * screen, and without it the page falls back to the `cmr_active_centro` cookie — the last center picked in
 * the selector, which can be another center than this invoice's.
 */
export function ReceiptPrintDialog({
  open,
  onOpenChange,
  ...body
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<BodyProps, "onClose">) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[26rem]">
        {/* Mounted only while open (the dialog unmounts closed content), so every open starts "loading". */}
        <ReceiptPrintBody {...body} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type BodyProps = {
  invoiceId: string;
  centerId?: string;
  printLabel: string;
  buildBackupBytes: () => Promise<Uint8Array>;
  onClose: () => void;
};

function ReceiptPrintBody({ invoiceId, centerId, printLabel, buildBackupBytes, onClose }: BodyProps) {
  const t = useTranslations("receipt");
  const tc = useTranslations("common");
  const [status, setStatus] = React.useState<Status>({ kind: "loading" });
  // Bumped by "Retry": remounts the iframe, which loads the page (and asks the server) again.
  const [attempt, setAttempt] = React.useState(0);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only our own iframe, same origin.
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as ReceiptStatusMessage | null;
      if (!data || data.type !== RECEIPT_STATUS_MESSAGE) return;
      setStatus(data.status === "ready" ? { kind: "ready" } : { kind: "error", message: data.message ?? "" });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function retry() {
    setStatus({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  const query = new URLSearchParams(centerId ? { centro: centerId } : {});
  const pageUrl = `/print/invoice/${invoiceId}`;
  const print = () => window.open(`${pageUrl}${query.size ? `?${query}` : ""}`, "_blank", "noopener");
  query.set("embed", "1");

  return (
    <>
      <DialogHeader className="border-b px-4 py-3">
        <DialogTitle className="text-base">{t("print")}</DialogTitle>
      </DialogHeader>

      <div className="relative min-h-0 flex-1 bg-muted/40">
        <iframe
          key={attempt}
          ref={iframeRef}
          src={`${pageUrl}?${query}`}
          title={t("previewTitle")}
          className={"block h-[min(70svh,40rem)] w-full bg-white " + (status.kind === "error" ? "invisible" : "")}
        />
        {status.kind === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <HugeiconsIcon icon={Alert02Icon} className="size-8 text-destructive" />
            <p className="text-sm font-medium">{t("loadFailed")}</p>
            {status.message && <p className="max-w-xs text-xs text-muted-foreground">{status.message}</p>}
            <Button variant="outline" size="sm" onClick={retry}>
              {tc("retry")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-3">
        {/* Backup path, apart from the normal Print: raw ESC/POS through the print hub. */}
        <div className="rounded-md bg-muted/50 py-2">
          <BackupPrintButton centerId={centerId} buildBytes={buildBackupBytes} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>{tc("cancel")}</Button>
          <Button size="sm" onClick={print} disabled={status.kind !== "ready"}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {printLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
