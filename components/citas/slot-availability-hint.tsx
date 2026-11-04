"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getAgendaDia } from "@/lib/api/agenda-dia";
import { slotAvailability, type AgendaSlot } from "@/lib/agenda/slot-availability";

// Room left for an appointment type on a DAY, from the day agenda (vacios = cupo of /scheduling/slots
// minus the appointments already given). Only the date is checked — owner's rule, 04-nov-2026. Never
// blocks: the desk decides.
export function SlotAvailabilityHint({
  day,
  appointmentTypeId,
  centroId,
}: {
  day: string;
  appointmentTypeId?: string;
  centroId?: string;
}) {
  const t = useTranslations("nextAppointment");
  const key = `${day}|${centroId ?? ""}`;
  const [slots, setSlots] = React.useState<{ key: string; data: AgendaSlot[] } | null>(null);

  React.useEffect(() => {
    if (!day) return;
    let active = true;
    const k = `${day}|${centroId ?? ""}`;
    getAgendaDia(day, { centroId })
      .then((a) => {
        const c = a.centers?.[0];
        if (active) setSlots({ key: k, data: c?.slots ?? c?.franjas ?? [] });
      })
      .catch(() => active && setSlots({ key: k, data: [] }));
    return () => {
      active = false;
    };
  }, [day, centroId]);

  if (!day || !appointmentTypeId || !slots || slots.key !== key || slots.data.length === 0) return null;
  const { freeDay } = slotAvailability(slots.data, appointmentTypeId, null);
  return freeDay > 0 ? (
    <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs">
      {t("freeDay", { n: freeDay })}
    </p>
  ) : (
    <p className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
      {t("noneThatDay")}
    </p>
  );
}
