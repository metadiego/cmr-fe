"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getCashCloseSetting, setCashCloseSetting } from "@/lib/api/caja";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Switch } from "@/components/ui/switch";

// Whether «Procesar cierre» shows on the cash screens of a center (BE #575; owner, 12-nov: hide it).
// Hidden while loading so it never flashes; on a failed read it shows, because the BE refuses the
// close anyway when the switch is off.
export function useCashCloseEnabled(centerId: string | null | undefined): boolean {
  const { state } = useResource(
    () => (centerId ? getCashCloseSetting([centerId]) : Promise.resolve([])),
    [centerId],
  );
  if (state.kind === "loading") return false;
  if (state.kind === "fail") return true;
  return state.data[0]?.closeEnabled ?? true;
}

// The Configuration card: one center, one switch. Without `canWrite`, read only.
export function CashCloseSettingAdmin({ centerId, canWrite }: { centerId?: string; canWrite: boolean }) {
  const t = useTranslations("cashCloseSetting");
  const tRoot = useTranslations();
  const { state, refresh } = useResource(() => getCashCloseSetting(centerId ? [centerId] : undefined), [centerId]);
  const [busy, setBusy] = React.useState(false);

  if (state.kind !== "ok" || !state.data[0]) return null;
  const row = state.data[0];

  async function change(next: boolean) {
    setBusy(true);
    try {
      await setCashCloseSetting(row.clinicId, next);
      toast.success(t("saved"));
      refresh();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex items-start justify-between gap-4 rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{tRoot("configuracion.panel.cash_close_enabled")}</h3>
        <p className="text-xs text-muted-foreground">{t("help")}</p>
      </div>
      <Switch checked={row.closeEnabled} disabled={!canWrite || busy} onCheckedChange={(v) => void change(v)} aria-label={tRoot("configuracion.panel.cash_close_enabled")} />
    </div>
  );
}
