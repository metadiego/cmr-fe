"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getAgendaDia } from "@/lib/api/agenda-dia";
import { slotAvailability, type SlotAvailability } from "@/lib/agenda/slot-availability";

// Room for an appointment type at a time on a day, from the day agenda's slots. Says so when there is
// room, warns when the time is full and offers the next free hour. Never blocks: the BE does not enforce
// cupo on a reschedule and the desk decides (same rule as the reschedule dialog).
export function SlotAvailabilityHint({
  day,
  time,
  appointmentTypeId,
  centroId,
  onUseTime,
}: {
  day: string;
  time: string;
  appointmentTypeId?: string;
  centroId?: string;
  onUseTime: (time: string) => void;
}) {
  const t = useTranslations("nextAppointment");
  const [slots, setSlots] = React.useState<{ key: string; data: Parameters<typeof slotAvailability>[0] } | null>(null);
  const key = `${day}|${centroId ?? ""}`;

  React.useEffect(() => {
    if (!day) return;
    let active = true;
    getAgendaDia(day, { centroId })
      .then((a) => {
        const c = a.centers?.[0];
        if (active) setSlots({ key: `${day}|${centroId ?? ""}`, data: c?.slots ?? c?.franjas ?? [] });
      })
      .catch(() => active && setSlots({ key: `${day}|${centroId ?? ""}`, data: [] }));
    return () => {
      active = false;
    };
  }, [day, centroId]);

  if (!day || !appointmentTypeId || !slots || slots.key !== key || slots.data.length === 0) return null;
  const a: SlotAvailability = slotAvailability(slots.data, appointmentTypeId, time);

  // Untimed appointments (the Atención board books by day, in arrival order): the day's room is the answer.
  if (!time) {
    return a.freeDay > 0 ? (
      <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs">
        {t("freeDay", { n: a.freeDay })}
      </p>
    ) : (
      <p className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
        {t("noneThatDay")}
      </p>
    );
  }
  if (a.free > 0) {
    return (
      <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs">
        {t("freeAt", { time: time.slice(0, 5), n: a.free })}
      </p>
    );
  }
  return (
    <div className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
      {t("fullAt", { time: time.slice(0, 5) })}
      {a.next ? (
        <button type="button" className="ml-1 font-medium underline" onClick={() => onUseTime(a.next!)}>
          {t("useTime", { time: a.next })}
        </button>
      ) : (
        <span className="ml-1">{t("noneThatDay")}</span>
      )}
    </div>
  );
}
