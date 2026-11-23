"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { CalendarMoving } from "@/components/appointments-booking/booking-calendar";
import { useAppointmentLabel } from "@/components/appointments-booking/patient-rail";
import type { PatientAppointment } from "@/lib/agenda/booking/patient-appointments";
import { reagendarCita } from "@/lib/api/citas";
import { apiErrorLabel } from "@/lib/api/errors";
import { reagendarSesion } from "@/lib/api/frontdesk";

/**
 * The booking screen's move commit (the day panel's "Move here?"): reschedules the rail's appointment
 * in its OWN center (X-Tenant-ID) and keeps it there: no `centerId` (omit = keep current) and no
 * `doctorId` on the medical reschedule. A medical move needs a reason. `onMoved` gets the old and new
 * dates once it is saved. Undefined while nothing is being moved.
 */
export function useBookingMove({
  movingItem,
  center,
  onMoved,
}: {
  movingItem: PatientAppointment | undefined;
  center: string | undefined;
  onMoved: (dates: string[]) => void;
}): CalendarMoving | undefined {
  const t = useTranslations("appointmentsBooking");
  const appointmentLabel = useAppointmentLabel();
  return (
    movingItem && {
      fromLabel: appointmentLabel(movingItem.date, movingItem.time),
      needsReason: movingItem.kind === "medical",
      onConfirm: async (to, reason) => {
        const a = movingItem;
        const tenant = a.centerId ?? center;
        const why = reason?.trim() ?? "";
        if (a.kind === "medical" && !why) {
          toast.error(t("toasts.moveReasonRequired"));
          return false;
        }
        try {
          if (a.kind === "medical") {
            await reagendarCita(a.id, { date: to.date, time: to.time, reason: why }, tenant);
          } else {
            await reagendarSesion(a.id, to.date, tenant, to.time);
          }
        } catch (err) {
          toast.error(t("toasts.moveFailed", { message: apiErrorLabel(err) }));
          return false;
        }
        toast.success(
          t("toasts.moved", { from: appointmentLabel(a.date, a.time), to: appointmentLabel(to.date, to.time) }),
        );
        onMoved([a.date, to.date]);
        return true;
      },
    }
  );
}
