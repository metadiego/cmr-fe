"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";

import { getStatus, runNow, type ClinicStatus } from "@/lib/api/scheduling-bridge";
import { useResource } from "@/hooks/use-resource";
import { toastError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog, Field } from "@/components/kit/form-dialog";

// Overview cards, one per visible center — GET /status returns ALL requested
// centers in one call, independent of the single-center editor below.
// `reachable` is a single GLOBAL flag (external system health, not per-center);
// reused on every card's dot rather than invented per-clinic.
export function SchedulingBridgeStatusCards({
  centerIds,
  centroNombre,
  puedeRun,
}: {
  centerIds: string[];
  centroNombre: (id: string) => string;
  puedeRun: boolean;
}) {
  const t = useTranslations("schedulingBridge.status");
  const tc = useTranslations("common");
  const format = useFormatter();
  const depsKey = centerIds.join(",");
  const { state, reload } = useResource(
    () => (centerIds.length ? getStatus(centerIds) : Promise.resolve({ reachable: true, clinics: [] })),
    [depsKey],
  );
  const [runningFor, setRunningFor] = React.useState<ClinicStatus | null>(null);

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;
  if (state.data.clinics.length === 0) return null;

  const { reachable, clinics } = state.data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clinics.map((c) => (
          <div
            key={c.clinicId}
            className="rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{centroNombre(c.clinicId)}</span>
              <span
                className={cn("size-2.5 shrink-0 rounded-full", reachable ? "bg-success" : "bg-destructive")}
                title={reachable ? t("reachable") : t("unreachable")}
              />
            </div>
            <Badge variant={c.enabled ? "success" : "outline"} className="mt-2">
              {c.enabled ? t("enabled") : t("disabled")}
            </Badge>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("lastRun")}:{" "}
              {c.lastRun ? (
                <>
                  {format.dateTime(new Date(c.lastRun.startedAt), "dateAndTime")} ·{" "}
                  <span className={c.lastRun.ok ? "text-success" : "text-destructive"}>
                    {c.lastRun.ok ? t("ok") : t("failed")}
                  </span>
                  {" · "}
                  {t("created", { n: c.lastRun.created })} · {t("updated", { n: c.lastRun.updated })} ·{" "}
                  {t("cancelled", { n: c.lastRun.cancelled })}
                </>
              ) : (
                t("never")
              )}
            </p>
            {puedeRun && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setRunningFor(c)}>
                {t("runNow")}
              </Button>
            )}
          </div>
        ))}
      </div>

      {runningFor && (
        <RunNowDialog
          clinic={runningFor}
          centroNombre={centroNombre(runningFor.clinicId)}
          onClose={() => setRunningFor(null)}
          onDone={reload}
        />
      )}
    </>
  );
}

function RunNowDialog({
  clinic,
  centroNombre,
  onClose,
  onDone,
}: {
  clinic: ClinicStatus;
  centroNombre: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("schedulingBridge.status");
  const tRoot = useTranslations();
  const today = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = React.useState(today);
  const [hasta, setHasta] = React.useState(today);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      const dates: string[] = [];
      for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(`${hasta}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }
      const res = await runNow(clinic.clinicId, dates, clinic.clinicId);
      if (res.ok) toast.success(t("runNowOk"));
      else toast.error(res.reason ?? t("runNowNoCode"));
      onClose();
      onDone();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${t("runNowTitle")} — ${centroNombre}`}
      description={t("runNowHelp")}
      onSubmit={onSubmit}
      submitting={busy}
      submitLabel={t("runNowSubmit")}
    >
      <Field label={t("from")}>
        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </Field>
      <Field label={t("to")}>
        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
