"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { reagendarSesion, type Sesion } from "@/lib/api/frontdesk";
import { toastError } from "@/lib/api/errors";
import { formatFechaSolo } from "@/lib/format/fecha";
import { DatePicker } from "@/components/ui/date-picker";

// Shown under a service's mini card in TherapyDayScheduler when the patient ALREADY has pending sessions
// of that service: it makes the double booking visible (the real case behind it: one technician booked
// what another had already booked) and offers to move the date in place instead of creating another.
// It only moves the DATE: `ReagendarSesionDto` (lib/api/frontdesk.ts, reagendarSesion) now accepts an
// optional time too, but this badge does not offer one (the booking screen's move does).
export function ExistingSessionsBadge({
  sesiones,
  centro,
  onChanged,
}: {
  sesiones: Sesion[];
  centro?: string;
  onChanged: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tRoot = useTranslations();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [nuevaFecha, setNuevaFecha] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function mover(id: string) {
    if (!nuevaFecha || busy) return;
    setBusy(true);
    try {
      await reagendarSesion(id, nuevaFecha, centro);
      toast.success(t("rescheduled"));
      setEditing(null);
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  if (sesiones.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1 border-t pt-1.5" onClick={(e) => e.stopPropagation()}>
      {sesiones.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning-foreground">
            {t("alreadyScheduled")} · {formatFechaSolo(s.date)}
            {s.time ? ` ${s.time}` : ""}
          </span>
          {editing === s.id ? (
            <span className="flex items-center gap-1">
              <DatePicker
                value={nuevaFecha}
                onChange={setNuevaFecha}
                className="h-6 w-32 px-1 py-0 text-[11px]"
              />
              <button
                type="button"
                disabled={!nuevaFecha || busy}
                onClick={() => mover(s.id)}
                className="text-primary hover:underline disabled:opacity-40"
              >
                {busy ? tRoot("common.saving") : tRoot("common.save")}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground hover:underline">
                {tRoot("common.cancel")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing(s.id);
                setNuevaFecha(s.date.slice(0, 10));
              }}
              className="text-primary hover:underline"
            >
              {t("reschedule")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
