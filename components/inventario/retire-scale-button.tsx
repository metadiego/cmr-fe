"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { retireScaleDevice } from "@/lib/api/scale-live-stock";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// «Retirar balanza»: deletes every stock event of that scale in the center, after a confirmation that
// names the deviceId (handoff stock-live-balanzas.md). Book stock is never touched.
export function RetireScaleButton({ deviceId, centroId, onDone }: { deviceId: string; centroId?: string; onDone: () => void }) {
  const t = useTranslations("liveStock");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function retire() {
    setBusy(true);
    try {
      const res = await retireScaleDevice(deviceId, centroId);
      toast.success(t("retired", { deviceId: res.deviceId, n: res.deleted }));
      setOpen(false);
      onDone();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setOpen(true)}>
        {t("retire")}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("retireTitle", { deviceId })}</AlertDialogTitle>
            <AlertDialogDescription>{t("retireBody", { deviceId })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                retire();
              }}
            >
              {t("retire")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
