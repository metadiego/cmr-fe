"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { retireScaleDevice } from "@/lib/api/scale-live-stock";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/kit/confirm-host";

// «Retirar balanza»: deletes every stock event of that scale in the center, after a confirmation that
// names the deviceId (handoff stock-live-balanzas.md). Book stock is never touched.
// The shared confirm prompt focuses Cancel, so a habitual Enter never retires the scale.
export function RetireScaleButton({ deviceId, centroId, onDone }: { deviceId: string; centroId?: string; onDone: () => void }) {
  const t = useTranslations("liveStock");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  // `asking` stops a second click / Enter auto-repeat from queueing a second confirm prompt.
  const asking = React.useRef(false);

  async function retire() {
    if (asking.current) return;
    asking.current = true;
    const ok = await confirm({
      title: t("retireTitle", { deviceId }),
      description: t("retireBody", { deviceId }),
      confirmLabel: t("retire"),
      destructive: true,
    }).finally(() => (asking.current = false));
    if (!ok) return;
    setBusy(true);
    try {
      const res = await retireScaleDevice(deviceId, centroId);
      toast.success(t("retired", { deviceId: res.deviceId, n: res.deleted }));
      onDone();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-destructive"
      disabled={busy}
      onClick={() => void retire()}
    >
      {t("retire")}
    </Button>
  );
}
