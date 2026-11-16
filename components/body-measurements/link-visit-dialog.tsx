"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listSesionesRango } from "@/lib/api/frontdesk";
import { getServicios } from "@/lib/api/servicios";
import { linkMeasurement } from "@/lib/api/body-measurements";
import { rankCandidates, type LinkCandidate, type UnlinkedReading } from "@/lib/body-measurements/unlinked";
import { missingFields } from "@/lib/forms/missing";
import { FormDialog } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Pick the visit a loose reading belongs to: the frontdesk sessions of the reading's day in its center,
// the reading's own patient first (handoff: «las sesiones del día del frontdesk, igual que en la ficha»).
// Linking moves the reading to that visit's patient and day, which fixes a wrong record.
// Mount it keyed by the reading so each one starts with a fresh search and selection.
export function LinkVisitDialog({
  reading,
  onClose,
  onLinked,
}: {
  reading: UnlinkedReading | null;
  onClose: () => void;
  onLinked: () => void;
}) {
  const t = useTranslations("bodyMeasurements");
  const [list, setList] = React.useState<LinkCandidate[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!reading) return;
    let alive = true;
    Promise.all([
      listSesionesRango({ desde: reading.date, hasta: reading.date, centroId: reading.clinicId }),
      getServicios(reading.clinicId).catch(() => []),
    ])
      .then(([sessions, services]) => {
        if (!alive) return;
        const names = new Map(services.map((s) => [s.id, s.name]));
        setList(
          sessions.map((s) => ({
            id: s.id,
            patientId: s.patientId ?? null,
            patientName: s.patient?.name ?? null,
            record: s.patient?.medicalRecordNumber ?? null,
            serviceName: names.get(s.serviceId) ?? null,
            time: s.time ?? null,
            status: s.status,
          })),
        );
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [reading]);

  const shown = React.useMemo(
    () => rankCandidates(list ?? [], { patientId: reading?.patient?.id, query: q }),
    [list, reading, q],
  );

  // A pick hidden by the search does not count: Enter in the search box must never link an off-screen visit.
  const visiblePick = picked && shown.some((c) => c.id === picked) ? picked : null;
  const missing = missingFields([[t("visit"), !!visiblePick]]);
  const { submitting, submit } = useSubmit(
    async () => {
      // The dialog only opens with a reading and the button needs a pick: never "succeed" without linking.
      if (!reading || !visiblePick) throw new Error(t("visit"));
      await linkMeasurement(reading.kind, reading.id, visiblePick, reading.clinicId);
    },
    { successMessage: t("linked"), onSuccess: onLinked },
  );

  return (
    <FormDialog
      open={!!reading}
      onOpenChange={(v) => !v && onClose()}
      size="xl"
      title={t("linkTitle")}
      description={t("linkHint", { date: reading?.date ?? "", center: reading?.clinicName ?? "" })}
      onSubmit={() => submit()}
      submitLabel={t("link")}
      submittingLabel={t("linking")}
      cancelLabel={t("cancel")}
      submitting={submitting}
      missing={missing}
    >
      <p className="text-xs text-muted-foreground">{t("glp1Only")}</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchVisit")} autoFocus />
      <div className="max-h-[50vh] overflow-y-auto rounded-md ring-1 ring-foreground/10">
        {failed ? (
          <p className="p-4 text-sm text-destructive">{t("visitsError")}</p>
        ) : !list ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : shown.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("noVisits")}</p>
        ) : (
          <ul className="divide-y">
            {shown.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setPicked(c.id)}
                  className={
                    "grid w-full grid-cols-[4rem_minmax(0,1fr)_minmax(0,12rem)_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 " +
                    (picked === c.id ? "bg-primary/10" : "")
                  }
                  aria-pressed={picked === c.id}
                >
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.time ?? "—"}</span>
                  <span className="truncate">
                    <span className="font-medium">{c.patientName ?? "—"}</span>
                    {c.record && <span className="ml-2 text-xs text-muted-foreground">#{c.record}</span>}
                  </span>
                  <span className="truncate text-muted-foreground">{c.serviceName ?? "—"}</span>
                  {reading?.patient?.id && c.patientId === reading.patient.id ? (
                    <Badge variant="secondary">{t("samePatient")}</Badge>
                  ) : (
                    <span />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormDialog>
  );
}
