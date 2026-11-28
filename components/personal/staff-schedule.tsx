"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  createScheduleRow,
  createScheduleRows,
  deactivateScheduleRow,
  getStaffSchedule,
  updateScheduleRow,
} from "@/lib/api/staff-schedule";
import { WEEK, byDay, hoursProblem, moveCenterSteps, splitRows, type ScheduleRow } from "@/lib/personal/schedule";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, EmptyState, ErrorState } from "@/components/kit/panel";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useConfirm } from "@/components/kit/confirm-host";

type Center = { id: string; name: string };

// «Horario» on the staff record = the person's agenda, the ONE schedule (owner, 27-nov; cmr-be handoff
// §2.3). Each row has its own center, chosen here and always sent: a row without one used to land in
// the session's center. Writes save at once and need staff.update at the row's center. The centers'
// general rows (staffId null) the GET fills in are shown apart, never as the person's own.
export function StaffSchedule({
  staffId,
  readCenters,
  editableCenters,
}: {
  staffId: string;
  /** Centers whose agenda the viewer may read (staff.read). */
  readCenters: Center[];
  /** Centers where the viewer may edit people's agendas (staff.update). */
  editableCenters: Center[];
}) {
  const t = useTranslations("staffSchedule");
  const tRoot = useTranslations();
  const readIds = readCenters.map((c) => c.id);
  const res = useResource<ScheduleRow[]>(() => getStaffSchedule(staffId, readIds), [staffId, readIds.join(",")]);
  const rows = res.state.kind === "ok" ? res.state.data : [];
  const { own, general } = splitRows(rows, staffId);
  const ownByDay = byDay(own);
  const generalByDay = byDay(general);
  const editable = new Set(editableCenters.map((c) => c.id));
  const [dialog, setDialog] = React.useState<{ row: ScheduleRow | null; day: number } | null>(null);

  return (
    <Panel
      title={t("title")}
      description={editableCenters.length ? t("help") : t("readOnly")}
      actions={
        editableCenters.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setDialog({ row: null, day: 1 })}>
            + {t("add")}
          </Button>
        )
      }
    >
      {res.state.kind === "fail" ? (
        <div className="p-5"><ErrorState message={res.state.message} /></div>
      ) : res.state.kind === "loading" ? (
        <div className="divide-y" aria-hidden>
          {WEEK.map((d) => (
            <div key={d} className="flex items-center gap-4 px-5 py-3">
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-6 w-40 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {own.length === 0 && <EmptyState>{t("empty")}</EmptyState>}
          <ul className="divide-y">
            {WEEK.map((d) => {
              const mine = ownByDay.get(d) ?? [];
              const centerRows = generalByDay.get(d) ?? [];
              return (
                <li key={d} className="flex flex-col gap-2 px-5 py-2.5 sm:flex-row sm:items-start">
                  <span className="w-28 shrink-0 pt-1 text-sm font-medium">{tRoot(`medicoHub.dow.${d}`)}</span>
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {mine.length === 0 && <span className="pt-1 text-xs text-muted-foreground">{t("dayOff")}</span>}
                    {mine.map((r) => {
                      const canEdit = editable.has(r.clinicId);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setDialog({ row: r, day: r.dayOfWeek })}
                          title={canEdit ? t("edit") : t("noEditHere")}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tabular-nums transition-colors",
                            canEdit ? "hover:bg-accent" : "cursor-default opacity-80",
                          )}
                        >
                          <span className="font-medium">{r.clinicName ?? "—"}</span>
                          <span className="text-muted-foreground">{r.startTime}–{r.endTime}</span>
                        </button>
                      );
                    })}
                    {centerRows.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground tabular-nums"
                        title={t("generalHelp")}
                      >
                        {r.clinicName ?? "—"} · {r.startTime}–{r.endTime} · {t("general")}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {dialog && (
        <ScheduleRowDialog
          staffId={staffId}
          row={dialog.row}
          day={dialog.day}
          centers={editableCenters}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); res.reload(); }}
        />
      )}
    </Panel>
  );
}

// Add (several days of one center at once) or change one row: hours with a PUT, another center with
// create-then-deactivate (a PUT never moves a row). Removing deactivates the row.
function ScheduleRowDialog({
  staffId,
  row,
  day,
  centers,
  onClose,
  onSaved,
}: {
  staffId: string;
  row: ScheduleRow | null;
  day: number;
  centers: Center[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("staffSchedule");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const [center, setCenter] = React.useState(row?.clinicId ?? (centers.length === 1 ? centers[0].id : ""));
  const [days, setDays] = React.useState<Set<number>>(new Set([day]));
  const [start, setStart] = React.useState(row?.startTime ?? "");
  const [end, setEnd] = React.useState(row?.endTime ?? "");
  const problem = hoursProblem(start, end);
  const missing = missingFields([
    [t("center"), !!center],
    [t("days"), !!row || days.size > 0],
    [t("start"), !!start],
    [t("end"), !!end],
  ]);
  const unchanged = !!row && row.clinicId === center && row.startTime === start && row.endTime === end;

  const save = useSubmit(async () => {
    if (!row) {
      await createScheduleRows({ staffId, centerId: center, daysOfWeek: [...days], startTime: start, endTime: end });
      return;
    }
    const move = moveCenterSteps({ ...row, startTime: start, endTime: end }, center, staffId);
    if (move) {
      await createScheduleRow(move.create);
      await deactivateScheduleRow(move.deactivate.id, move.deactivate.centerId);
    } else {
      await updateScheduleRow(row.id, row.clinicId, { startTime: start, endTime: end });
    }
  }, { successMessage: t("saved"), onSuccess: onSaved });

  const remove = useSubmit(async () => {
    if (!row) throw new Error("nothing to remove");
    await deactivateScheduleRow(row.id, row.clinicId);
  }, { successMessage: t("removed"), onSuccess: onSaved });

  const toggleDay = (d: number) =>
    setDays((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={row ? t("editTitle", { day: tRoot(`medicoHub.dow.${row.dayOfWeek}`) }) : t("addTitle")}
      description={row ? undefined : t("addHelp")}
      missing={missing}
      blocked={unchanged || (problem !== null && problem !== "missing")}
      reason={unchanged ? t("unchanged") : problem && problem !== "missing" ? t(`problem.${problem}`) : null}
      submitting={save.submitting || remove.submitting}
      submitLabel={t("save")}
      onSubmit={() => save.submit()}
      extra={
        row ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={save.submitting || remove.submitting}
            onClick={async () => {
              if (await confirm({ title: t("removeConfirm"), description: t("removeHelp"), destructive: true, confirmLabel: t("remove") })) remove.submit();
            }}
          >
            {t("remove")}
          </Button>
        ) : undefined
      }
    >
      <Field label={t("center")} htmlFor="sched-center" required>
        <Select value={center} onValueChange={setCenter}>
          <SelectTrigger id="sched-center" className="w-full"><SelectValue placeholder={t("pickCenter")} /></SelectTrigger>
          <SelectContent>
            {centers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {!row && (
        <Field label={t("days")} required>
          <div className="flex flex-wrap gap-1.5">
            {WEEK.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.has(d)}
                onClick={() => toggleDay(d)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  days.has(d) ? "border-primary/40 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {tRoot(`medicoHub.dow.${d}`)}
              </button>
            ))}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("start")} htmlFor="sched-start" required>
          <TimePicker id="sched-start" value={start} onChange={setStart} />
        </Field>
        <Field label={t("end")} htmlFor="sched-end" required>
          <TimePicker id="sched-end" value={end} onChange={setEnd} />
        </Field>
      </div>
    </FormDialog>
  );
}
