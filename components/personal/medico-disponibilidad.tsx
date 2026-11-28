"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listDoctorAbsences,
  createDoctorAbsence,
  deleteDoctorAbsence,
  getNextAvailableDate,
  type DoctorAbsence,
} from "@/lib/api/disponibilidad";
import { toastError } from "@/lib/api/errors";
import { Panel } from "@/components/kit/panel";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Absences (vacation / leave) and the next-valid-date checker, under the staff record's «Horario» tab.
// The weekly agenda itself is components/personal/staff-schedule.tsx (one row per center, staff.update).
// Absence writes are gated by `citas.config`. Handoff ficha-del-medico-hub / agenda-dias-bloqueados-por-medico.

export function MedicoDisponibilidad({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <ProximaFecha doctorId={doctorId} centro={centro} />
      </div>
      <div className="space-y-6">
        <Ausencias doctorId={doctorId} centro={centro} />
      </div>
      <p className="text-xs text-muted-foreground xl:col-span-2">{t("holidaysNote")}</p>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Panel title={title} actions={action}>
      <div className="px-5 py-4">{children}</div>
    </Panel>
  );
}

function Ausencias({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  const format = useFormatter();
  const dia = (iso?: string | null) => { const d = iso ? parseDayUTC(iso) : null; return d ? format.dateTime(d, "dayMonthYear") : (iso ?? "—"); };
  const { can } = useCan();
  const puedeConfig = can("citas.config");
  const { state, reload } = useResource<DoctorAbsence[]>(() => listDoctorAbsences(doctorId, undefined, undefined, centro), [doctorId, centro]);
  const ausencias = state.kind === "ok" ? state.data : [];
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState<{ kind: "vacation" | "leave"; startDate: string; endDate: string; startTime: string; endTime: string; reason: string } | null>(null);
  const rangoInvalido = !!form && !!form.startDate && !!form.endDate && form.endDate < form.startDate;
  // Both hours given: the end must come after the start (BE answers disponibilidad.ausencia.horas_invalidas).
  const horasInvalidas = !!form && !!form.startTime && !!form.endTime && form.endTime <= form.startTime;

  async function crear() {
    if (!form || !form.startDate || !form.endDate || rangoInvalido || horasInvalidas || busy) return;
    setBusy(true);
    try {
      await createDoctorAbsence(
        {
          doctorId, kind: form.kind, startDate: form.startDate, endDate: form.endDate,
          ...(form.startTime ? { startTime: form.startTime } : {}), ...(form.endTime ? { endTime: form.endTime } : {}),
          reason: form.reason.trim() || undefined,
        },
        centro,
      );
      setForm(null);
      reload();
      toast.success(t("saved"));
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  async function quitar(id: string) {
    setBusy(true);
    try { await deleteDoctorAbsence(id, centro); reload(); } catch (e) { toastError(e); } finally { setBusy(false); }
  }

  return (
    <Card
      title={t("absencesTitle")}
      action={puedeConfig && !form ? (
        <Button type="button" size="sm" onClick={() => setForm({ kind: "vacation", startDate: "", endDate: "", startTime: "", endTime: "", reason: "" })}>{t("addAbsence")}</Button>
      ) : undefined}
    >
      {puedeConfig && form && (
        <div className="mb-3 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>{t("kind")}</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "vacation" | "leave" })}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">{t("vacation")}</SelectItem>
                  <SelectItem value="leave">{t("leave")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ab-from">{t("from")}</Label>
              <DatePicker id="ab-from" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} className="h-8 w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ab-to">{t("to")}</Label>
              <DatePicker id="ab-to" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} className="h-8 w-40" aria-invalid={rangoInvalido || undefined} />
            </div>
            {/* Part of the day (optional): away from «Desde la hora», until «Hasta la hora». */}
            <div className="space-y-1">
              <Label>{t("fromTime")}</Label>
              <TimePicker clearable value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} className="h-8 w-32" />
            </div>
            <div className="space-y-1">
              <Label>{t("toTime")}</Label>
              <TimePicker clearable value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} className="h-8 w-32" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ab-reason">{t("reason")}</Label>
            <Input id="ab-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("reasonPh")} />
          </div>
          {rangoInvalido && <p className="text-xs text-destructive">{t("rangeInvalid")}</p>}
          {horasInvalidas && <p className="text-xs text-destructive">{t("hoursInvalid")}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button type="button" size="sm" disabled={!form.startDate || !form.endDate || rangoInvalido || horasInvalidas || busy} onClick={crear}>{t("save")}</Button>
          </div>
        </div>
      )}
      {state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : ausencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAbsences")}</p>
      ) : (
        <ul className="space-y-1.5">
          {ausencias.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-sm">
              <Badge kind={a.kind} t={t} />
              <span className="flex-1 tabular-nums">
                {dia(a.startDate)} – {dia(a.endDate)}
                {a.startTime || a.endTime ? ` · ${a.startTime ?? ""}–${a.endTime ?? ""}` : ""}
                {a.reason ? ` · ${a.reason}` : ""}
              </span>
              {puedeConfig && (
                <button type="button" onClick={() => quitar(a.id)} disabled={busy} className="shrink-0 text-destructive hover:underline" aria-label={t("remove")}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Badge({ kind, t }: { kind: string; t: ReturnType<typeof useTranslations> }) {
  const es = kind === "vacation";
  return (
    <span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " + (es ? "bg-info text-info-foreground" : "bg-warning text-warning-foreground")}>
      {es ? t("vacation") : t("leave")}
    </span>
  );
}

function ProximaFecha({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  const tRoot = useTranslations();
  const [date, setDate] = React.useState("");
  const [res, setRes] = React.useState<Awaited<ReturnType<typeof getNextAvailableDate>> | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function probar() {
    if (!date || busy) return;
    setBusy(true); setRes(null);
    try { setRes(await getNextAvailableDate(doctorId, date, centro)); } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  return (
    <Card title={t("nextDateTitle")}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="nd-date">{t("date")}</Label>
          <DatePicker id="nd-date" value={date} onChange={setDate} className="h-8 w-40" />
        </div>
        <Button type="button" size="sm" className="h-8" disabled={!date || busy} onClick={probar}>{t("check")}</Button>
      </div>
      {res && (
        <p className={"mt-3 text-sm " + (res.moved ? "text-warning-foreground" : "text-success-foreground")}>
          {!res.moved
            ? t("dateOk")
            : res.exhausted
              ? `${res.labelKey && tRoot.has(res.labelKey) ? tRoot(res.labelKey) : res.reason} · ${t("noSlot")}`
              : `${res.labelKey && tRoot.has(res.labelKey) ? tRoot(res.labelKey) : res.reason} · ${t("suggested")}: ${res.date}`}
        </p>
      )}
    </Card>
  );
}
