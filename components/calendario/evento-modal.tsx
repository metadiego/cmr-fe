"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  type CalendarioEvento,
  type CalendarioCategoria,
  type CrearEventoPayload,
} from "@/lib/api/calendario";
import { apiErrorLabel } from "@/lib/api/errors";
import { suggestAbsence, type AbsenceSuggestion, type EventWithAbsence, type LinkedAbsence } from "@/lib/api/calendar-absences";
import { AbsenceChip } from "@/components/calendario/absence-chip";
import { CreateClinicField } from "@/components/kit/create-clinic-field";
import { createClinicReady } from "@/lib/create-clinic";
import { isClinicViewAll } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// Create / view / edit one calendar event (components/calendario/calendario.tsx). A new event is born in
// ONE clinic (`createCenters` + `defaultClinicId`, hooks/use-create-clinic.ts); an existing one stays in
// its clinic, shown read-only when the screen spans several (`showClinic`).

export function EventoModal({
  inicial, cats, catLabel, puedeEditar, puedeBorrar, puedeAusencias, createCenters, defaultClinicId, showClinic, clinicLabel, onClose, onSaved, tRoot, tc, t,
}: {
  /** calendario.absences: accept / dismiss the absence chip (BE #558); without it the chip only informs. */
  puedeAusencias: boolean;
  inicial: { evento?: CalendarioEvento; dia: string };
  cats: CalendarioCategoria[];
  catLabel: (c?: CalendarioCategoria) => string;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  createCenters: { id: string; name: string }[];
  defaultClinicId: string;
  showClinic: boolean;
  /** The clinic shown for an existing event (its name, or "company-wide"). */
  clinicLabel: (ev: CalendarioEvento) => string;
  onClose: () => void;
  onSaved: () => void;
  tRoot: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
}) {
  // After saving a NEW event that reads like an absence, the modal stays open on it with the chip.
  const [savedEv, setSavedEv] = React.useState<EventWithAbsence | null>(null);
  const ev = (savedEv ?? inicial.evento) as EventWithAbsence | undefined;
  const [absence, setAbsence] = React.useState<LinkedAbsence | null>(ev?.absence ?? null);
  const [suggestion, setSuggestion] = React.useState<AbsenceSuggestion | null>(null);
  const [absenceDone, setAbsenceDone] = React.useState(false);
  const [titulo, setTitulo] = React.useState(ev?.title ?? "");
  const [dia, setDia] = React.useState(ev?.day ?? inicial.dia);
  const [diaFin, setDiaFin] = React.useState(ev?.endDay ?? "");
  const [todoDia, setTodoDia] = React.useState(ev ? !ev.time : true);
  const [hora, setHora] = React.useState(ev?.time ?? "");
  const [horaFin, setHoraFin] = React.useState(ev?.endTime ?? "");
  const [categoriaId, setCategoriaId] = React.useState(ev?.categoryId ?? "");
  const [descripcion, setDescripcion] = React.useState(ev?.description ?? "");
  const [esGlobal, setEsGlobal] = React.useState(!!ev?.isGlobal);
  const [busy, setBusy] = React.useState(false);
  const [clinicPicked, setClinicPicked] = React.useState("");
  const createClinic = clinicPicked || defaultClinicId;
  // A new event on «Ambos» waits for its clinic (lib/create-clinic.ts); editing never moves it.
  const clinicReady = !!ev || createClinicReady(createClinic, createCenters.length, isClinicViewAll());
  const soloLectura = !puedeEditar;

  // What the title seems to say (debounced; writes nothing). Not for a linked event or a company-wide one.
  React.useEffect(() => {
    if (absence || absenceDone || esGlobal || ev?.origin === "staff_absence" || titulo.trim().length < 3 || !dia) return;
    let alive = true;
    const h = setTimeout(() => {
      suggestAbsence({
        titulo: titulo.trim(), dia, diaFin: diaFin || null,
        hora: todoDia ? null : hora || null, horaFin: todoDia ? null : horaFin || null,
        centroId: ev?.clinicId ?? (createClinic || null),
      })
        .then((s) => alive && setSuggestion(s ?? null))
        .catch(() => alive && setSuggestion(null));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [titulo, dia, diaFin, todoDia, hora, horaFin, esGlobal, absence, absenceDone, ev?.origin, ev?.clinicId, createClinic]);

  async function guardar() {
    if (soloLectura || !titulo.trim() || busy || !clinicReady) return;
    setBusy(true);
    const payload: CrearEventoPayload = {
      day: dia, endDay: diaFin || null,
      time: todoDia ? null : (hora || null), endTime: todoDia ? null : (horaFin || null),
      title: titulo.trim(), description: descripcion.trim() || null,
      categoryId: categoriaId || null, isGlobal: esGlobal,
    };
    try {
      // The clinic travels only on CREATE; editing never moves an event to another clinic.
      const saved = (ev ? await actualizarEvento(ev.id, payload) : await crearEvento(createClinic ? { ...payload, centerId: createClinic } : payload)) as EventWithAbsence;
      toast.success(t("guardado"));
      // A new event that reads like an absence: stay on it so the chip can be accepted (never blocks).
      if (!ev && !saved.absence && saved.absenceSuggestion) {
        setSavedEv(saved);
        setSuggestion(saved.absenceSuggestion);
        return;
      }
      onSaved();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(false);
    }
  }
  async function borrar() {
    if (!ev || busy) return;
    if (!window.confirm(t("borrarConfirm"))) return;
    setBusy(true);
    try {
      await eliminarEvento(ev.id);
      toast.success(t("borrado"));
      onSaved();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && (savedEv || absenceDone ? onSaved() : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ev ? t("editarTitulo") : t("nuevoTitulo")}</DialogTitle>
          <DialogDescription>{t("modalDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Campo label={t("field.titulo")}><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={soloLectura} autoFocus /></Campo>
          <AbsenceChip
            eventId={ev?.origin === "staff_absence" ? null : (ev?.id ?? null)}
            centerId={ev?.clinicId ?? null}
            absence={absence}
            suggestion={absenceDone ? null : suggestion}
            canManage={puedeAusencias}
            onChanged={(linked) => {
              setAbsence(linked);
              setAbsenceDone(true);
              if (!linked) setSuggestion(null);
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo label={t("field.dia")}><DatePicker value={dia} onChange={setDia} disabled={soloLectura} /></Campo>
            <Campo label={t("field.diaFin")}><DatePicker value={diaFin} onChange={setDiaFin} disabled={soloLectura} clearable /></Campo>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={todoDia} onChange={(e) => setTodoDia(e.target.checked)} disabled={soloLectura} />{t("field.todoDia")}</label>
          {!todoDia && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label={t("field.hora")}><TimePicker clearable value={hora} onChange={setHora} disabled={soloLectura} /></Campo>
              <Campo label={t("field.horaFin")}><TimePicker clearable value={horaFin} onChange={setHoraFin} disabled={soloLectura} /></Campo>
            </div>
          )}
          <Campo label={t("field.categoria")}>
            <Select value={categoriaId} onValueChange={setCategoriaId} disabled={soloLectura}>
              <SelectTrigger><SelectValue placeholder={t("field.selCategoria")} /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{catLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label={t("field.descripcion")}><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} disabled={soloLectura} /></Campo>
          {ev ? (
            showClinic && <Campo label={t("field.centro")}><span className="text-sm">{clinicLabel(ev)}</span></Campo>
          ) : (
            <CreateClinicField centers={createCenters} value={createClinic} onChange={setClinicPicked} show={showClinic} disabled={busy} />
          )}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={esGlobal} onChange={(e) => setEsGlobal(e.target.checked)} disabled={soloLectura} />{t("field.global")}</label>
          <div className="flex justify-between gap-2 pt-1">
            <div>{ev && puedeBorrar && <Button variant="outline" size="sm" onClick={borrar} disabled={busy} className="text-destructive">{tc("delete")}</Button>}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={savedEv || absenceDone ? onSaved : onClose} disabled={busy}>{savedEv ? tc("close") : tc("cancel")}</Button>
              {!soloLectura && <Button size="sm" onClick={guardar} disabled={busy || !titulo.trim() || !clinicReady}>{busy ? tc("loading") : tc("save")}</Button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
