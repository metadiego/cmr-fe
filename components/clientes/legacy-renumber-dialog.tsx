"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { renumberLegacy, type RenumberRow } from "@/lib/api/legacy-numbering";
import { changedCount, renumberCheck } from "@/lib/frontdesk/legacy-numbering-missing";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { useSettled } from "@/hooks/use-settled";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { RecordTable, Td, Th } from "@/components/kit/panel";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";

// «Renumerar serie»: rewrites the legacy «n/m» of a patient's migrated sessions of ONE service. Every
// change of a field re-asks the BE for a preview (Fecha · Antes · Después, changed rows highlighted);
// «Aplicar (N cambios)» repeats the call without preview. The BE decides; this only shows and confirms.
// Handoff docs/specs/numeracion-de-sesiones-migradas-handoff.md.
export function LegacyRenumberDialog({
  open,
  onOpenChange,
  patientId,
  service,
  centerId,
  day,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  service: { id: string; name: string };
  centerId: string;
  /** How a calendar day is printed on this record (MM/DD/YYYY). */
  day: (iso: string) => string;
  onDone: () => void;
}) {
  const t = useTranslations("legacyLabel");
  const [f, set] = useDialogForm(() => ({ total: "", startAt: "1", from: "", to: "", reason: "" }), open, service.id);
  const c = renumberCheck(f);
  const ready = c.filled.total && c.filled.reason && !c.invalid;
  const body = {
    total: c.total ?? 0,
    startAt: c.startAt ?? 1,
    ...(f.from ? { from: f.from } : {}),
    ...(f.to ? { to: f.to } : {}),
    reason: f.reason.trim(),
  };
  // Wait for the typing to settle before asking for the preview.
  const key = ready ? JSON.stringify(body) : "";
  const settled = useSettled(key, 350);
  const preview = useResource<RenumberRow[] | null>(
    () => (settled ? renumberLegacy(patientId, service.id, { ...(JSON.parse(settled) as typeof body), preview: true }, centerId).then((r) => r.rows ?? []) : Promise.resolve(null)),
    [settled, patientId, service.id, centerId],
  );
  const rows = preview.state.kind === "ok" ? preview.state.data : null;
  const n = rows ? changedCount(rows) : 0;
  const stale = settled !== key;

  const applying = useSubmit(() => renumberLegacy(patientId, service.id, body, centerId), {
    onSuccess: (r) => {
      toast.success(t("renumbered", { n: changedCount(r.rows ?? []) || n }));
      onOpenChange(false);
      onDone();
    },
  });
  const missing = missingFields([
    [t("total"), c.filled.total],
    [t("reason"), c.filled.reason],
  ]);
  const why = c.badRange
    ? t("rangeDates")
    : c.invalid
      ? t("rangeHint")
      : ready && (stale || preview.state.kind === "loading")
        ? t("previewing")
        : rows && n === 0
          ? t("nothingToChange")
          : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t("renumber")}
      description={service.name}
      onSubmit={() => {}}
      actions={[{ label: t("apply", { n }), onClick: () => applying.submit() }]}
      submitting={applying.submitting}
      missing={missing}
      reason={why}
      blocked={!!why}
    >
      <RequiredLegend />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("total")} htmlFor="renum-total" required>
          <Input id="renum-total" inputMode="numeric" value={f.total} onChange={(e) => set({ total: e.target.value })} className="tabular-nums" />
        </Field>
        <Field label={t("startAt")} htmlFor="renum-start">
          <Input id="renum-start" inputMode="numeric" value={f.startAt} onChange={(e) => set({ startAt: e.target.value })} className="tabular-nums" />
        </Field>
        <Field label={t("from")} htmlFor="renum-from">
          <DatePicker id="renum-from" value={f.from} onChange={(v) => set({ from: v })} />
        </Field>
        <Field label={t("to")} htmlFor="renum-to">
          <DatePicker id="renum-to" value={f.to} onChange={(v) => set({ to: v })} />
        </Field>
      </div>
      <Field label={t("reason")} htmlFor="renum-reason" required hint={t("reasonHint")}>
        <Input id="renum-reason" value={f.reason} maxLength={200} onChange={(e) => set({ reason: e.target.value })} />
      </Field>

      {preview.state.kind === "fail" && <p className="text-sm text-destructive">{preview.state.message}</p>}
      {rows && rows.length > 0 && (
        <div className="max-h-80 overflow-y-auto rounded-xl border">
          <RecordTable
            head={
              <>
                <Th>{t("date")}</Th>
                <Th>{t("before")}</Th>
                <Th>{t("after")}</Th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r.id} className={r.changed ? "bg-warning/10" : undefined}>
                <Td className="tabular-nums">{day(r.date)}</Td>
                <Td className="tabular-nums text-muted-foreground">{r.before ?? "—"}</Td>
                <Td className={r.changed ? "font-semibold tabular-nums" : "tabular-nums"}>{r.after}</Td>
              </tr>
            ))}
          </RecordTable>
        </div>
      )}
    </FormDialog>
  );
}
