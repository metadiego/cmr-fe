"use client";

import * as React from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { QrCode01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sheetPath } from "@/lib/format-sheet/sheet";

// Above a fillable sheet in the formats modal (patient-desk row → GLP-1): open it on this screen, or show
// its QR for the iPad camera to scan. «Enviar al iPad» (cmr-be #661) was tried and removed — this is the
// only way to reach a visit's sheet.
export function SheetSendBar({ slug, sessionId }: { slug: string; sessionId: string }) {
  const t = useTranslations("formSheet.send");
  const [qrOpen, setQrOpen] = React.useState(false);
  const path = sheetPath(slug, sessionId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
      <Button asChild size="sm">
        <Link href={path}>{t("fill")}</Link>
      </Button>
      <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}>
        <HugeiconsIcon icon={QrCode01Icon} className="size-4" />
        {t("qr")}
      </Button>
      <QrDialog open={qrOpen} onOpenChange={setQrOpen} path={path} />
    </div>
  );
}

function QrDialog({ open, onOpenChange, path }: { open: boolean; onOpenChange: (o: boolean) => void; path: string }) {
  const t = useTranslations("formSheet.send");
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(`${window.location.origin}${path}`, { width: 320, margin: 1 }).then(
      (url) => alive && setSrc(url),
      () => alive && setSrc(null),
    );
    return () => {
      alive = false;
    };
  }, [open, path]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("qrTitle")}</DialogTitle>
          <DialogDescription>{t("qrHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          {src ? (
            // A data: URL generated here; next/image adds nothing for it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={t("qrTitle")} width={320} height={320} className="rounded-lg bg-white p-2" />
          ) : (
            <div className="size-80 animate-pulse rounded-lg bg-muted" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
