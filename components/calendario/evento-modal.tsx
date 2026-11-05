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
  inicial, cats, catLabel, puedeEditar, puedeBorrar, createCenters, defaultClinicId, showClinic, clinicLabel, onClose, onSaved, tRoot, tc, t,
}: {
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
  const ev = inicial.evento;
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
      if (ev) await actualizarEvento(ev.id, payload);
      else await crearEvento(createClinic ? { ...payload, centerId: createClinic } : payload);
      toast.success(t("guardado"));
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ev ? t("editarTitulo") : t("nuevoTitulo")}</DialogTitle>
          <DialogDescription>{t("modalDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Campo label={t("field.titulo")}><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={soloLectura} autoFocus /></Campo>
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
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
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
