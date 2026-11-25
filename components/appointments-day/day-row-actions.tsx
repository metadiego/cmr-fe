"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon, Tick02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSubmit } from "@/components/kit/use-submit";
import { useCan } from "@/hooks/use-can";
import { CancelAppointmentDialog } from "@/components/appointments-booking/cancel-appointment-dialog";
import { MoveSessionDialog } from "@/components/appointments-day/move-session-dialog";
import { EditMedicalRow } from "@/components/appointments-day/edit-medical-row";
import {
  cancelDayRow,
  confirmDayRow,
  unconfirmDayRow,
  type DayListRow,
} from "@/lib/api/appointments-day";
import { confirmToggle } from "@/lib/lifecycle/allowed-actions";
import { cancelMeaning, refusalRefreshesRow } from "@/lib/lifecycle/board-action-rules";

// A row's actions on the Citas screen, drawn ONLY from its `allowedActions` (the backend's decision for
// this user in the row's center: stage, date rule and permission). Confirmar is the row's one primary
// button (one click, no dialog; undone from the menu). Change, Book another and Cancel live in the ⋮ menu.
export function DayRowActions({ row, onChanged }: { row: DayListRow; onChanged: () => void }) {
  const t = useTranslations("appointmentsDay.actions");
  const tRoot = useTranslations();
  const { can } = useCan();
  const [dialog, setDialog] = React.useState<"cancel" | "move" | "edit" | null>(null);

  const { submitting, submit } = useSubmit((fn: () => Promise<unknown>) => fn(), {
    successMessage: t("done"),
    onSuccess: onChanged,
    // The row moved under us (stage or someone else): redraw it; the toast still says why.
    onError: (err) => {
      if (refusalRefreshesRow(err)) onChanged();
      return false;
    },
  });

  const toggle = confirmToggle(row.allowedActions);
  // Every day-list row carries its list, so the stored-status fallback never applies here.
  const cancel = cancelMeaning("", row.allowedActions);
  const canChange = row.allowedActions.includes(row.kind === "medical" ? "reschedule" : "move");
  const cancelLabel = cancel === "not_serve" ? tRoot("lifecycle.action.not_serve") : tRoot("lifecycle.action.cancel");
  const what = [row.time, row.typeLabel ?? row.serviceName, row.patient.name].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center justify-end gap-1">
      {toggle === "confirm" && (
        <Button size="sm" disabled={submitting} onClick={() => void submit(() => confirmDayRow(row))}>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} data-icon="inline-start" />
          {tRoot("lifecycle.action.confirm")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={submitting} aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {toggle === "unconfirm" && (
            <DropdownMenuItem onSelect={() => void submit(() => unconfirmDayRow(row))}>
              {tRoot("lifecycle.action.unconfirm")}
            </DropdownMenuItem>
          )}
          {canChange && (
            <DropdownMenuItem onSelect={() => setDialog(row.kind === "medical" ? "edit" : "move")}>
              {t("change")}
            </DropdownMenuItem>
          )}
          {can("citas.create") && (
            <DropdownMenuItem asChild>
              {/* In the row's center, like the other links into the booking screen (`?centro=`). */}
              <Link href={`/scheduling/appointments?${new URLSearchParams({ patient: row.patient.id, centro: row.centerId })}`}>
                {t("bookAnother")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/patients/${encodeURIComponent(row.patient.id)}`}>{t("openPatient")}</Link>
          </DropdownMenuItem>
          {cancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
                {cancelLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {cancel && (
        <CancelAppointmentDialog
          open={dialog === "cancel"}
          appointmentId={row.id}
          description={what}
          title={cancel === "not_serve" ? cancelLabel : undefined}
          confirmLabel={cancel === "not_serve" ? cancelLabel : undefined}
          onKeep={() => setDialog(null)}
          onCancel={async (reason) => {
            try {
              await cancelDayRow(row, reason);
            } catch (err) {
              if (refusalRefreshesRow(err)) {
                setDialog(null);
                onChanged();
              }
              throw err;
            }
            setDialog(null);
            onChanged();
          }}
        />
      )}
      {dialog === "move" && <MoveSessionDialog row={row} open onClose={() => setDialog(null)} onMoved={onChanged} />}
      {dialog === "edit" && <EditMedicalRow row={row} onClose={() => setDialog(null)} onSaved={onChanged} />}
    </div>
  );
}
