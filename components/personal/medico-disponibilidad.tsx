"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getHorariosMedico,
  createHorario,
  deleteHorario,
  listDoctorAbsences,
  createDoctorAbsence,
  deleteDoctorAbsence,
  getNextAvailableDate,
  type HorarioMedico,
  type DoctorAbsence,
} from "@/lib/api/disponibilidad";
import { toastError } from "@/lib/api/errors";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Pestaña «Disponibilidad» del hub del médico: horarios (los días que trabaja; los vacíos son libres),
// ausencias (vacaciones/permisos) y festivos (compartidos, solo lectura), más el probador de próxima
// fecha válida. Escrituras gateadas por `citas.config`. Handoff ficha-del-medico-hub / agenda-dias-bloqueados-por-medico.
const DOW = [1, 2, 3, 4, 5, 6, 0]; // Lun→Dom (dayOfWeek 0=Dom, convención JS getDay)

export function MedicoDisponibilidad({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Horarios doctorId={doctorId} centro={centro} />
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
    <section className="rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Horarios({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  const { can } = useCan();
  const puedeConfig = can("citas.config");
  const { state, reload } = useResource<HorarioMedico[]>(() => getHorariosMedico(doctorId), [doctorId]);
  const horarios = state.kind === "ok" ? state.data : [];
  const [busy, setBusy] = React.useState(false);
  const [nuevo, setNuevo] = React.useState<{ dow: number; inicio: string; fin: string } | null>(null);

  async function agregar() {
    if (!nuevo || !nuevo.inicio || !nuevo.fin || busy) return;
    setBusy(true);
    try {
      await createHorario({ doctorId, dayOfWeek: nuevo.dow, startTime: nuevo.inicio, endTime: nuevo.fin }, centro);
      setNuevo(null);
      reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  async function quitar(id: string) {
    setBusy(true);
    try { await deleteHorario(id, centro); reload(); } catch (e) { toastError(e); } finally { setBusy(false); }
  }

  return (
    <Card title={t("scheduleTitle")}>
      {state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <div className="space-y-1.5">
          {DOW.map((d) => {
            const delDia = horarios.filter((h) => h.dayOfWeek === d);
            return (
              <div key={d} className="flex items-start gap-3 border-b py-1.5 last:border-b-0">
                <span className="w-24 shrink-0 text-sm font-medium">{t(`dow.${d}`)}</span>
                <div className="flex-1 space-y-1">
                  {delDia.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t("dayOff")}</span>
                  ) : (
                    delDia.map((h) => (
                      <span key={h.id} className="mr-2 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">
                        {h.startTime}–{h.endTime}
                        {puedeConfig && (
                          <button type="button" onClick={() => quitar(h.id)} disabled={busy} className="text-destructive hover:underline" aria-label={t("remove")}>×</button>
                        )}
                      </span>
                    ))
                  )}
                  {puedeConfig && nuevo?.dow === d && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Input type="time" step={60} value={nuevo.inicio} onChange={(e) => setNuevo({ ...nuevo, inicio: e.target.value })} className="h-8 w-28" aria-label={t("start")} />
                      <span className="text-muted-foreground">–</span>
                      <Input type="time" step={60} value={nuevo.fin} onChange={(e) => setNuevo({ ...nuevo, fin: e.target.value })} className="h-8 w-28" aria-label={t("end")} />
                      <Button type="button" size="sm" className="h-8" disabled={!nuevo.inicio || !nuevo.fin || busy} onClick={agregar}>{t("add")}</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setNuevo(null)}>{t("cancel")}</Button>
                    </div>
                  )}
                </div>
                {puedeConfig && nuevo?.dow !== d && (
                  <button type="button" onClick={() => setNuevo({ dow: d, inicio: "", fin: "" })} className="shrink-0 text-xs text-primary hover:underline">+ {t("add")}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
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
  const [form, setForm] = React.useState<{ kind: "vacation" | "leave"; startDate: string; endDate: string; reason: string } | null>(null);
  const rangoInvalido = !!form && !!form.startDate && !!form.endDate && form.endDate < form.startDate;

  async function crear() {
    if (!form || !form.startDate || !form.endDate || rangoInvalido || busy) return;
    setBusy(true);
    try {
      await createDoctorAbsence({ doctorId, kind: form.kind, startDate: form.startDate, endDate: form.endDate, reason: form.reason.trim() || undefined }, centro);
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
        <Button type="button" size="sm" onClick={() => setForm({ kind: "vacation", startDate: "", endDate: "", reason: "" })}>{t("addAbsence")}</Button>
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
              <Input id="ab-from" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-8 w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ab-to">{t("to")}</Label>
              <Input id="ab-to" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-8 w-40" aria-invalid={rangoInvalido || undefined} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ab-reason">{t("reason")}</Label>
            <Input id="ab-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("reasonPh")} />
          </div>
          {rangoInvalido && <p className="text-xs text-destructive">{t("rangeInvalid")}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button type="button" size="sm" disabled={!form.startDate || !form.endDate || rangoInvalido || busy} onClick={crear}>{t("save")}</Button>
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
              <span className="flex-1 tabular-nums">{dia(a.startDate)} – {dia(a.endDate)}{a.reason ? ` · ${a.reason}` : ""}</span>
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
          <Input id="nd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" />
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
