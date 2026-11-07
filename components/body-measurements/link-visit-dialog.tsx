"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listSesionesRango } from "@/lib/api/frontdesk";
import { getServicios } from "@/lib/api/servicios";
import { linkMeasurement } from "@/lib/api/body-measurements";
import { toastError } from "@/lib/api/errors";
import { rankCandidates, type LinkCandidate, type UnlinkedReading } from "@/lib/body-measurements/unlinked";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const tRoot = useTranslations();
  const [list, setList] = React.useState<LinkCandidate[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

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

  async function link() {
    if (!reading || !picked) return;
    setBusy(true);
    try {
      await linkMeasurement(reading.kind, reading.id, picked, reading.clinicId);
      toast.success(t("linked"));
      onLinked();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!reading} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("linkTitle")}</DialogTitle>
          <DialogDescription>{t("linkHint", { date: reading?.date ?? "", center: reading?.clinicName ?? "" })}</DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={!picked || busy} onClick={link}>
            {busy ? t("linking") : t("link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
