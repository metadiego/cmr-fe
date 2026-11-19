"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { getConfig, updateConfig, type BridgeConfig } from "@/lib/api/scheduling-bridge";
import { useResource } from "@/hooks/use-resource";
import { weekdayLabel, WEEKDAYS_MON_FIRST } from "@/lib/i18n/weekdays";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/kit/form-dialog";
import { FormFooter } from "@/components/kit/form-footer";
import { useSubmit } from "@/components/kit/use-submit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CODES = ["BAYAMON", "CAGUAS"] as const;

// Settings form for ONE center at a time (the picker above swaps `centroId`).
// `draft` is a local copy of the loaded config; Save PUTs it. A failed save keeps
// the draft as typed (error toast only): a failed save never loses input.
export function SchedulingBridgeConfigForm({
  centroId,
  puedeEscribir,
}: {
  centroId?: string; // undefined = the session's own active center
  puedeEscribir: boolean;
}) {
  const t = useTranslations("schedulingBridge.config");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { state } = useResource<BridgeConfig>(() => getConfig(centroId), [centroId]);

  const [draft, setDraft] = React.useState<BridgeConfig | null>(null);
  // Adjust state during render (not an effect, per react-hooks/set-state-in-effect): reseed ONLY
  // when this is the first load, or the center picker moved to a DIFFERENT center — never on a
  // same-center reload, which must not silently clobber an in-progress unsaved edit.
  const [seededFor, setSeededFor] = React.useState<{ centroId?: string } | null>(null);
  if (state.kind === "ok" && (seededFor === null || seededFor.centroId !== centroId)) {
    setSeededFor({ centroId });
    setDraft(state.data);
  }

  // Enter never saves this form: it changes the live connection to the external scheduler.
  const { submitting, submit } = useSubmit((d: BridgeConfig) => updateConfig(d, centroId), {
    successMessage: tc("saved"),
    onSuccess: (saved) => {
      setDraft(saved);
    },
  });

  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;
  if (state.kind === "loading" || !draft) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  function patch(p: Partial<BridgeConfig>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  function toggleDia(d: number) {
    if (!draft) return;
    // workDays puede llegar undefined/null de un centro que nunca se configuró — nunca asumir array.
    const dias = draft.workDays ?? [];
    const on = dias.includes(d);
    patch({ workDays: on ? dias.filter((x) => x !== d) : [...dias, d].sort() });
  }

  return (
    <div className="space-y-4 rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("title")}</h3>
        <label className="flex items-center gap-2 text-sm">
          {t("enabled")}
          <Switch checked={draft.enabled} onCheckedChange={(v) => patch({ enabled: v })} disabled={!puedeEscribir} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("pollInterval")}>
          <Input
            type="number"
            min={60}
            value={draft.pollIntervalSeconds}
            onChange={(e) => patch({ pollIntervalSeconds: Math.max(60, Number(e.target.value) || 60) })}
            disabled={!puedeEscribir}
          />
        </Field>
        <Field label={t("externalCode")}>
          <Select
            value={draft.externalClinicCode ?? "none"}
            onValueChange={(v) => patch({ externalClinicCode: v === "none" ? null : (v as BridgeConfig["externalClinicCode"]) })}
            disabled={!puedeEscribir}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder={t("selectCode")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("none")}</SelectItem>
              {CODES.map((code) => (
                <SelectItem key={code} value={code}>{code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("workStart")}>
          <TimePicker value={draft.workStartTime} onChange={(v) => patch({ workStartTime: v })} disabled={!puedeEscribir} />
        </Field>
        <Field label={t("workEnd")}>
          <TimePicker value={draft.workEndTime} onChange={(v) => patch({ workEndTime: v })} disabled={!puedeEscribir} />
        </Field>
      </div>

      <Field label={t("workDays")}>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS_MON_FIRST.map((d) => (
            <button
              key={d}
              type="button"
              disabled={!puedeEscribir}
              onClick={() => toggleDia(d)}
              className={cn(
                "min-w-11 rounded-md border px-2.5 py-1 text-sm capitalize transition-colors disabled:opacity-60",
                (draft.workDays ?? []).includes(d)
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {weekdayLabel(locale, d, "short")}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("sheetDownPolicy")} hint={t("sheetDownPolicyHelp")}>
        <Select
          value={draft.sheetDownPolicy}
          onValueChange={(v) => patch({ sheetDownPolicy: v as BridgeConfig["sheetDownPolicy"] })}
          disabled={!puedeEscribir}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="allow">{t("sheetDownPolicyAllow")}</SelectItem>
            <SelectItem value="block">{t("sheetDownPolicyBlock")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {puedeEscribir && (
        <FormFooter primary={{ label: tc("save"), onClick: () => submit(draft) }} submitting={submitting} />
      )}
    </div>
  );
}
