"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getBackdateSettings, putBackdateSettings, type BackdateNegativePolicy, type BackdateSettings } from "@/lib/api/inventory-backdate";
import { maxDaysCheck } from "@/lib/inventory/backdate";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { Field } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { ErrorState, LoadingPanel, Panel } from "@/components/kit/panel";
import { useSubmit } from "@/components/kit/use-submit";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Per center: how far back an inventory adjustment may be dated and what a negative day does
// (cmr-be #646). Read with inventory.read; written only with inventory.backdate_settings (explicit grant).
export function InventoryBackdateSettings({ centerId, canWrite }: { centerId: string; canWrite: boolean }) {
  const t = useTranslations("inventoryBackdateSettings");
  const res = useResource<BackdateSettings[]>(() => getBackdateSettings(centerId), [centerId]);
  if (res.state.kind === "loading") return <LoadingPanel rows={2} />;
  if (res.state.kind === "fail") return <ErrorState message={res.state.message} />;
  const row = res.state.data.find((r) => r.clinicId === centerId) ?? res.state.data[0];
  if (!row) return <ErrorState message={t("none")} />;
  return <SettingsForm key={`${row.clinicId}|${row.maxDays}|${row.negativeBalance}`} row={row} canWrite={canWrite} centerId={centerId} onSaved={res.reload} />;
}

function SettingsForm({ row, canWrite, centerId, onSaved }: { row: BackdateSettings; canWrite: boolean; centerId: string; onSaved: () => void }) {
  const t = useTranslations("inventoryBackdateSettings");
  const [maxDays, setMaxDays] = React.useState(String(row.maxDays));
  const [policy, setPolicy] = React.useState<BackdateNegativePolicy>(row.negativeBalance);
  const c = maxDaysCheck(maxDays);
  const dirty = c.value !== row.maxDays || policy !== row.negativeBalance;
  const saving = useSubmit(() => putBackdateSettings({ clinicId: row.clinicId, maxDays: c.value ?? undefined, negativeBalance: policy }, centerId), {
    onSuccess: () => {
      toast.success(t("saved"));
      onSaved();
    },
  });
  const missing = missingFields([[t("maxDays"), c.filled]]);
  const reason = c.invalid ? t("maxDaysInvalid") : !dirty ? t("noChanges") : null;

  return (
    <Panel title={row.clinicName ?? t("title")} description={t("help")}>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <Field label={t("maxDays")} htmlFor="backdate-max-days" required hint={t("maxDaysHint")} error={c.invalid ? t("maxDaysInvalid") : undefined}>
          <Input id="backdate-max-days" inputMode="numeric" value={maxDays} disabled={!canWrite} onChange={(e) => setMaxDays(e.target.value)} className="tabular-nums" />
        </Field>
        <Field label={t("negativeBalance")} htmlFor="backdate-negative" hint={t(`policyHint.${policy}`)}>
          <Select value={policy} onValueChange={(v) => setPolicy(v as BackdateNegativePolicy)} disabled={!canWrite}>
            <SelectTrigger id="backdate-negative" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {row.negativeBalanceOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {t(`policy.${o}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {canWrite ? (
        <div className="border-t px-5 py-3">
          <FormFooter primary={{ label: t("save"), onClick: () => saving.submit() }} missing={missing} reason={reason} blocked={!!reason} submitting={saving.submitting} />
        </div>
      ) : (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">{t("readOnly")}</p>
      )}
    </Panel>
  );
}
