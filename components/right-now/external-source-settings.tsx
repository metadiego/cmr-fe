"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";

import {
  getExternalSourceConfig,
  setExternalSourceConfig,
  type RightNowExternalSourceConfig,
} from "@/lib/api/right-now";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// El interruptor del enchufe del legado (handoff .personal/handoff-ahora-mismo-legado-bayamon.md):
// lejos de los usuarios de Ahora mismo a propósito — un botón aparte, visible solo con
// ahora-mismo.config (el padre ya lo gatea; este componente no se monta sin el permiso).
export function ExternalSourceSettingsButton({ centerIds }: { centerIds: string[] }) {
  const t = useTranslations("rightNow.externalSourceConfig");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={Settings02Icon} className="size-4" data-icon="inline-start" />
        {t("title")}
      </Button>
      {open && <ExternalSourceSettingsDialog centerIds={centerIds} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExternalSourceSettingsDialog({
  centerIds,
  onClose,
}: {
  centerIds: string[];
  onClose: () => void;
}) {
  const t = useTranslations("rightNow.externalSourceConfig");
  const tRoot = useTranslations();
  const format = useFormatter();
  const { state, refresh } = useResource<RightNowExternalSourceConfig[]>(
    () => getExternalSourceConfig(centerIds),
    [centerIds.join(",")],
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function toggle(row: RightNowExternalSourceConfig, enabled: boolean) {
    setBusyId(row.clinicId);
    try {
      await setExternalSourceConfig(row.clinicId, { enabled });
      toast.success(enabled ? t("enabled", { center: row.name }) : t("disabled", { center: row.name }));
      refresh();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
        {state.kind === "fail" && <p className="text-sm text-destructive">{state.message}</p>}
        {state.kind === "ok" && (
          <ul className="divide-y">
            {state.data.map((row) => (
              <li key={row.clinicId} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.lastSnapshot
                      ? t("lastReceived", { time: format.dateTime(new Date(row.lastSnapshot.receivedAt), "time") })
                      : t("neverReceived")}
                  </p>
                </div>
                <Switch
                  checked={row.enabled}
                  disabled={busyId === row.clinicId}
                  onCheckedChange={(v) => toggle(row, v)}
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
