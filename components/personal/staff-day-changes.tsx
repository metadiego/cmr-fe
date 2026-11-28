"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { deleteDayChange, getDayChanges, setDayChange, type DayChange } from "@/lib/api/day-changes";
import { NOT_COMING, dayChangeBody, dayChangeProblem, type DayChangeDraft } from "@/lib/personal/day-changes";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, EmptyState, ErrorState, RecordTable, Th, Td } from "@/components/kit/panel";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useConfirm } from "@/components/kit/confirm-host";

type Center = { id: string; name: string };

// «Cambios de un día» on the staff record (cmr-be handoff §2.4): for one date, another center or other
// hours, or «No viene». Nothing reads them yet (booking will, in the BE's PR 3). Listed from today;
// a past day can be neither set nor removed. Writes need staff.update at the person's home center.
export function StaffDayChanges({
  staffId,
  homeCenter,
  centers,
  canEdit,
}: {
  staffId: string;
  /** The person's home center: tenant of every call. */
  homeCenter?: string;
  /** Every active center (the destination is not limited to the editor's centers, owner 28-nov). */
  centers: Center[];
  canEdit: boolean;
}) {
  const t = useTranslations("staffDayChanges");
  const format = useFormatter();
  const confirm = useConfirm();
  const res = useResource<DayChange[]>(() => getDayChanges(staffId, homeCenter), [staffId, homeCenter]);
  const [adding, setAdding] = React.useState(false);
  const nameOf = (id: string | null) => (id ? (centers.find((c) => c.id === id)?.name ?? "—") : null);
  const remove = useSubmit((day: string) => deleteDayChange(staffId, day, homeCenter), {
    successMessage: t("removed"),
    onSuccess: () => res.reload(),
  });

  return (
    <Panel
      title={t("title")}
      description={t("help")}
      actions={canEdit && <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ {t("add")}</Button>}
    >
      {res.state.kind === "fail" ? (
        <div className="p-5"><ErrorState message={res.state.message} /></div>
      ) : res.state.kind === "loading" ? (
        <div className="space-y-2 px-5 py-4" aria-hidden>
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ) : res.state.data.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <RecordTable
            head={
              <tr>
                <Th>{t("day")}</Th>
                <Th>{t("where")}</Th>
                <Th>{t("hours")}</Th>
                <Th>{t("note")}</Th>
                {canEdit && <Th />}
              </tr>
            }
          >
            {res.state.data.map((c) => {
              const d = parseDayUTC(c.day);
              return (
                <tr key={c.day}>
                  <Td className="tabular-nums">{d ? format.dateTime(d, "dayMonthYear") : c.day}</Td>
                  <Td>{nameOf(c.centerId) ?? <span className="text-warning-foreground">{t("notComing")}</span>}</Td>
                  <Td className="tabular-nums">
                    {c.startTime && c.endTime ? `${c.startTime.slice(0, 5)}–${c.endTime.slice(0, 5)}` : c.centerId ? <span className="text-muted-foreground">{t("usualHours")}</span> : "—"}
                  </Td>
                  <Td>{c.note || <span className="text-muted-foreground">—</span>}</Td>
                  {canEdit && (
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={remove.submitting}
                        onClick={async () => {
                          if (await confirm({ title: t("removeConfirm"), destructive: true, confirmLabel: t("remove") })) remove.submit(c.day);
                        }}
                      >
                        {t("remove")}
                      </Button>
                    </Td>
                  )}
                </tr>
              );
            })}
          </RecordTable>
        </div>
      )}
      {adding && (
        <DayChangeDialog
          staffId={staffId}
          homeCenter={homeCenter}
          centers={centers}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); res.reload(); }}
        />
      )}
    </Panel>
  );
}

function DayChangeDialog({
  staffId, homeCenter, centers, onClose, onSaved,
}: {
  staffId: string;
  homeCenter?: string;
  centers: Center[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("staffDayChanges");
  const today = todayPR();
  const [d, setD] = React.useState<DayChangeDraft>({ day: "", center: "", startTime: "", endTime: "", note: "" });
  const set = (patch: Partial<DayChangeDraft>) => setD((x) => ({ ...x, ...patch }));
  const problem = dayChangeProblem(d, today);
  const missing = missingFields([[t("day"), !!d.day], [t("where"), !!d.center]]);
  const away = d.center === NOT_COMING;
  const save = useSubmit(() => setDayChange(staffId, d.day, dayChangeBody(d), homeCenter), {
    successMessage: t("saved"),
    onSuccess: onSaved,
  });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("addTitle")}
      description={t("addHelp")}
      missing={missing}
      reason={problem ? t(`problem.${problem}`) : null}
      submitting={save.submitting}
      submitLabel={t("save")}
      onSubmit={() => save.submit()}
    >
      <Field label={t("day")} htmlFor="dc-day" required>
        <DatePicker value={d.day} onChange={(v) => set({ day: v })} min={today} />
      </Field>
      <Field label={t("where")} htmlFor="dc-where" required>
        <Select value={d.center} onValueChange={(v) => set(v === NOT_COMING ? { center: v, startTime: "", endTime: "" } : { center: v })}>
          <SelectTrigger id="dc-where" className="w-full"><SelectValue placeholder={t("pickWhere")} /></SelectTrigger>
          <SelectContent>
            {centers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            <SelectItem value={NOT_COMING}>{t("notComing")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {!away && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("start")} htmlFor="dc-start" hint={t("hoursHint")}>
            <TimePicker id="dc-start" value={d.startTime} onChange={(v) => set({ startTime: v })} clearable />
          </Field>
          <Field label={t("end")} htmlFor="dc-end">
            <TimePicker id="dc-end" value={d.endTime} onChange={(v) => set({ endTime: v })} clearable />
          </Field>
        </div>
      )}
      <Field label={t("note")} htmlFor="dc-note">
        <Input id="dc-note" value={d.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} />
      </Field>
    </FormDialog>
  );
}
