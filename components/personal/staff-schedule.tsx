"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  createScheduleRows,
  deactivateScheduleRow,
  getStaffSchedule,
  updateScheduleRow,
} from "@/lib/api/staff-schedule";
import { WEEK, collapseRepeats, hoursProblem, moveCenterSteps, splitRows, summarizeWeek, weekGrid, type ScheduleRow } from "@/lib/personal/schedule";
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
// general rows (staffId null) the GET fills in for the days the person has none are summarized in one
// line under the grid, never shown as the person's own.
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
  const grid = weekGrid(own);
  const generalSummary = summarizeWeek(general);
  const editable = new Set(editableCenters.map((c) => c.id));
  const [dialog, setDialog] = React.useState<{ row: ScheduleRow | null; repeats?: ScheduleRow[]; day: number; center?: string } | null>(null);
  const dayName = (d: number) => t(`dowShort.${d}`);
  const span = (from: number, to: number) => (from === to ? dayName(from) : `${dayName(from)}–${dayName(to)}`);

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
        <div className="space-y-3 px-5 py-4" aria-hidden>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-8 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          {grid.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            // One line per center, one column per weekday: where and when, read at a glance.
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] table-fixed text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="w-36 px-5 py-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("center")}</th>
                    {WEEK.map((d) => (
                      <th key={d} className="px-1 py-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{dayName(d)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grid.map((line) => {
                    const canEdit = editable.has(line.clinicId);
                    return (
                      <tr key={line.clinicId}>
                        <td className="truncate px-5 py-2 font-medium" title={line.clinicName}>{line.clinicName}</td>
                        {WEEK.map((d) => {
                          const cell = line.days.get(d) ?? [];
                          return (
                            <td key={d} className="px-1 py-1.5 text-center align-middle">
                              <div className="flex flex-col items-center gap-1">
                                {collapseRepeats(cell).map(({ row: r, repeats }) => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => setDialog({ row: r, repeats, day: d })}
                                    title={repeats.length ? t("repeatedHelp", { count: repeats.length + 1 }) : canEdit ? t("edit") : t("noEditHere")}
                                    className={cn(
                                      "relative w-full rounded-md bg-primary/10 px-1 py-1 text-xs font-medium text-primary tabular-nums transition-colors",
                                      canEdit ? "hover:bg-primary/20" : "cursor-default",
                                      repeats.length > 0 && "ring-1 ring-warning",
                                    )}
                                  >
                                    {r.startTime}–{r.endTime}
                                    {repeats.length > 0 && (
                                      <span className="absolute -top-1.5 -right-1 rounded-full bg-warning px-1 text-[9px] leading-tight font-semibold text-warning-foreground">
                                        ×{repeats.length + 1}
                                      </span>
                                    )}
                                  </button>
                                ))}
                                {cell.length === 0 &&
                                  (canEdit ? (
                                    <button
                                      type="button"
                                      onClick={() => setDialog({ row: null, day: d, center: line.clinicId })}
                                      aria-label={t("addDay", { day: tRoot(`medicoHub.dow.${d}`), center: line.clinicName })}
                                      className="w-full rounded-md px-1 py-1 text-xs text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                      —
                                    </button>
                                  ) : (
                                    <span className="py-1 text-xs text-muted-foreground/60">—</span>
                                  ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {generalSummary.length > 0 && (
            <div className="space-y-1 border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
              <p>{grid.length === 0 ? t("generalWhenNone") : t("generalOtherDays")}</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {generalSummary.map((c) => (
                  <li key={c.clinicId} className="tabular-nums">
                    <span className="font-medium text-foreground/80">{c.clinicName}</span>{" "}
                    {c.spans.map((s) => `${span(s.from, s.to)} ${s.startTime}–${s.endTime}`).join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {dialog && (
        <ScheduleRowDialog
          staffId={staffId}
          row={dialog.row}
          repeats={dialog.repeats ?? []}
          day={dialog.day}
          initialCenter={dialog.center}
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
  repeats,
  day,
  initialCenter,
  centers,
  onClose,
  onSaved,
}: {
  staffId: string;
  row: ScheduleRow | null;
  /** Copies of `row` (same day, center and hours) saved twice by older screens: removed with it. */
  repeats: ScheduleRow[];
  day: number;
  /** Preselected center when adding from an empty cell. */
  initialCenter?: string;
  centers: Center[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("staffSchedule");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const [center, setCenter] = React.useState(row?.clinicId ?? initialCenter ?? (centers.length === 1 ? centers[0].id : ""));
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
  // Same values but saved twice: «Guardar» is the cleanup, so it is not "unchanged".
  const unchanged = !!row && repeats.length === 0 && row.clinicId === center && row.startTime === start && row.endTime === end;

  const save = useSubmit(async () => {
    if (!row) {
      await createScheduleRows({ staffId, centerId: center, daysOfWeek: [...days], startTime: start, endTime: end });
      return;
    }
    const move = moveCenterSteps({ ...row, startTime: start, endTime: end }, center, staffId);
    if (move) {
      // Upsert by day in the new center: no duplicate if the day already exists there, and a retry after
      // a failed deactivate does not create it twice.
      const { dayOfWeek, ...rest } = move.create;
      await createScheduleRows({ ...rest, daysOfWeek: [dayOfWeek] });
      await deactivateScheduleRow(move.deactivate.id, move.deactivate.centerId);
    } else {
      await updateScheduleRow(row.id, row.clinicId, { startTime: start, endTime: end });
    }
    // Saving the entry also clears its old copies, so the day ends with exactly one row.
    for (const r of repeats) await deactivateScheduleRow(r.id, r.clinicId);
  }, { successMessage: t("saved"), onSuccess: onSaved });

  const remove = useSubmit(async () => {
    if (!row) throw new Error("nothing to remove");
    for (const r of [row, ...repeats]) await deactivateScheduleRow(r.id, r.clinicId);
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
      blocked={unchanged}
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
      {repeats.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          {t("repeatedFix", { count: repeats.length + 1 })}
        </p>
      )}
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
