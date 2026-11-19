"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  type CalendarioEvento,
  type CalendarioCategoria,
  type CrearEventoPayload,
} from "@/lib/api/calendario";
import { missingFields } from "@/lib/forms/missing";
import { suggestAbsence, type AbsenceSuggestion, type EventWithAbsence, type LinkedAbsence } from "@/lib/api/calendar-absences";
import { AbsenceChip } from "@/components/calendario/absence-chip";
import { CreateClinicField } from "@/components/kit/create-clinic-field";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { useSubmit } from "@/components/kit/use-submit";
import { useConfirm } from "@/components/kit/confirm-host";
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
  const [clinicPicked, setClinicPicked] = React.useState("");
  const createClinic = clinicPicked || defaultClinicId;
  // A new event on «Ambos» waits for its clinic (lib/create-clinic.ts); editing never moves it.
  const clinicReady = !!ev || createClinicReady(createClinic, createCenters.length, isClinicViewAll());
  const soloLectura = !puedeEditar;
  const confirm = useConfirm();

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

  // On a create, the clinic counts as missing only where a picker is shown; otherwise the button waits
  // and says why (the modal only opens for someone who can create somewhere, so this is a backstop).
  const clinicPicker = !ev && createCenters.length > 1;
  const clinicPending = !clinicReady && !clinicPicker;
  const missing = missingFields([
    [t("field.titulo"), !!titulo.trim()],
    [tRoot("createClinic.label"), clinicReady || !clinicPicker],
  ]);

  const save = useSubmit(
    async () => {
      // Backstops: the button is disabled while anything is missing or blocked.
      if (!titulo.trim()) throw new Error(t("field.titulo"));
      if (!clinicReady) throw new Error(tRoot("caja.sinCentro"));
      const payload: CrearEventoPayload = {
        day: dia, endDay: diaFin || null,
        time: todoDia ? null : (hora || null), endTime: todoDia ? null : (horaFin || null),
        title: titulo.trim(), description: descripcion.trim() || null,
        categoryId: categoriaId || null, isGlobal: esGlobal,
      };
      // The clinic travels only on CREATE; editing never moves an event to another clinic.
      return (ev ? await actualizarEvento(ev.id, payload) : await crearEvento(createClinic ? { ...payload, centerId: createClinic } : payload)) as EventWithAbsence;
    },
    {
      successMessage: t("guardado"),
      onSuccess: (saved) => {
        // A new event that reads like an absence: stay on it so the chip can be accepted (never blocks).
        if (!ev && !saved.absence && saved.absenceSuggestion) {
          setSavedEv(saved);
          setSuggestion(saved.absenceSuggestion);
          return;
        }
        onSaved();
      },
    },
  );
  const remove = useSubmit(
    async () => {
      if (!ev) throw new Error(t("borrarConfirm"));
      await eliminarEvento(ev.id);
    },
    { successMessage: t("borrado"), onSuccess: () => onSaved() },
  );
  const busy = save.submitting || remove.submitting;
  async function borrar() {
    if (!ev || busy) return;
    const ok = await confirm({ title: t("borrarConfirm"), confirmLabel: tc("delete"), destructive: true });
    if (ok) await remove.submit();
  }

  // Closing after a save that stayed open (absence chip) or after the chip was used refreshes the list.
  const close = () => (savedEv || absenceDone ? onSaved() : onClose());
  const deleteButton = ev && puedeBorrar && (
    <Button variant="outline" onClick={() => void borrar()} disabled={busy} className="text-destructive sm:mr-auto">{tc("delete")}</Button>
  );

  const fields = (
    <div className="space-y-3 text-sm">
      <Field label={t("field.titulo")} htmlFor="evento-titulo" required={!soloLectura}>
        <Input id="evento-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={soloLectura} autoFocus />
      </Field>
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
        <Field label={t("field.dia")} htmlFor="evento-dia"><DatePicker id="evento-dia" value={dia} onChange={setDia} disabled={soloLectura} /></Field>
        <Field label={t("field.diaFin")} htmlFor="evento-dia-fin"><DatePicker id="evento-dia-fin" value={diaFin} onChange={setDiaFin} disabled={soloLectura} clearable /></Field>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={todoDia} onChange={(e) => setTodoDia(e.target.checked)} disabled={soloLectura} />{t("field.todoDia")}</label>
      {!todoDia && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.hora")} htmlFor="evento-hora"><TimePicker id="evento-hora" clearable value={hora} onChange={setHora} disabled={soloLectura} /></Field>
          <Field label={t("field.horaFin")} htmlFor="evento-hora-fin"><TimePicker id="evento-hora-fin" clearable value={horaFin} onChange={setHoraFin} disabled={soloLectura} /></Field>
        </div>
      )}
      <Field label={t("field.categoria")} htmlFor="evento-categoria">
        <Select value={categoriaId} onValueChange={setCategoriaId} disabled={soloLectura}>
          <SelectTrigger id="evento-categoria"><SelectValue placeholder={t("field.selCategoria")} /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{catLabel(c)}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={t("field.descripcion")} htmlFor="evento-descripcion"><Textarea id="evento-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} disabled={soloLectura} /></Field>
      {ev ? (
        showClinic && <Field label={t("field.centro")}><span className="text-sm">{clinicLabel(ev)}</span></Field>
      ) : (
        <CreateClinicField centers={createCenters} value={createClinic} onChange={setClinicPicked} show={showClinic} disabled={busy} required />
      )}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={esGlobal} onChange={(e) => setEsGlobal(e.target.checked)} disabled={soloLectura} />{t("field.global")}</label>
    </div>
  );

  // Read-only (no edit permission): a viewer, with no save button — only delete (if allowed) and cancel.
  if (soloLectura) {
    return (
      <Dialog open onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ev ? t("editarTitulo") : t("nuevoTitulo")}</DialogTitle>
            <DialogDescription>{t("modalDesc")}</DialogDescription>
          </DialogHeader>
          {fields}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {deleteButton}
            <Button variant="outline" onClick={close} disabled={busy}>{tc("cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && close()}
      size="md"
      title={ev ? t("editarTitulo") : t("nuevoTitulo")}
      description={t("modalDesc")}
      onSubmit={() => save.submit()}
      submitLabel={tc("save")}
      submitting={busy}
      submittingLabel={remove.submitting ? tc("loading") : undefined}
      cancelLabel={savedEv ? tc("close") : undefined}
      missing={missing}
      blocked={clinicPending}
      reason={clinicPending ? tRoot("caja.sinCentro") : null}
      extra={deleteButton}
    >
      {fields}
    </FormDialog>
  );
}
