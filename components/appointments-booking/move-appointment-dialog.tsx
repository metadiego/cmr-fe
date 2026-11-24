"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/kit/field";
import { FormDialog } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import type { DayPanelMoving } from "@/components/appointments-booking/day-panel";
import { missingFields } from "@/lib/forms/missing";
import { cn } from "@/lib/utils";
import { shortTime } from "./booking-toolbar";
import { DateTile } from "./date-tile";

/** One side of the move: a label, the date tile and the time. `next` highlights the new slot. */
function Slot({ label, date, time, next = false }: { label: string; date: string; time: string | null; next?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 rounded-xl border p-3",
        next ? "border-primary/40 bg-primary/5" : "bg-muted/30",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-medium tracking-wide uppercase",
          next ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        <DateTile iso={date} muted={!next} />
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums",
            !next && "text-muted-foreground line-through decoration-1",
          )}
        >
          {time ? shortTime(time) : "—"}
        </span>
      </div>
    </div>
  );
}

// Moving a rail appointment to the picked hour (the owner's "like the create modal, adapted to moving"):
// the current slot and the new one side by side, the overbook warning, the reason (medical only).
// A move is an outward action (rule 8): Enter never fires it, only the button does. Closing it (Cancel,
// Esc, ×) only un-picks the hour: move mode stays on. `onConfirm` toasts its own failure and leaves the
// dialog open with the typed reason; on success the screen shows the booking success dialog.
export function MoveAppointmentDialog({
  moving,
  typeName,
  to,
  full,
  onClose,
}: {
  moving: DayPanelMoving;
  typeName: string;
  to: { date: string; time: string };
  full: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("appointmentsBooking.move");
  // A fresh reason for every target hour.
  const [f, set] = useDialogForm(() => ({ reason: "" }), true, `${to.date} ${to.time}`);
  const reason = f.reason.trim();
  const { submitting, submit } = useSubmit(() => moving.onConfirm(moving.needsReason ? reason : undefined));
  const missing = missingFields(moving.needsReason ? [[t("reasonLabel"), reason !== ""]] : []);

  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      size="lg"
      title={t("dialogTitle")}
      description={typeName}
      onSubmit={() => {}}
      actions={[{ label: t("confirm"), onClick: () => submit() }]}
      submitting={submitting}
      missing={missing}
    >
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Slot label={t("nowLabel")} date={moving.from.date} time={moving.from.time} />
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-5 shrink-0 self-center text-muted-foreground max-sm:rotate-90"
          aria-hidden
        />
        <Slot label={t("newLabel")} date={to.date} time={to.time} next />
      </div>

      {full && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <p>{t("fullWarning")}</p>
        </div>
      )}

      {moving.needsReason && (
        <Field label={t("reasonLabel")} htmlFor="booking-move-reason" required>
          <Textarea
            id="booking-move-reason"
            value={f.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder={t("reasonPlaceholder")}
            rows={3}
          />
        </Field>
      )}
    </FormDialog>
  );
}
