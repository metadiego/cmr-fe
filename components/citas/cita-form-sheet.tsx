"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createCita, getTiposCita, type Cita, type TipoCita, type CanalCita } from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import type { Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PacienteSelect } from "@/components/citas/paciente-select";

const CANALES: CanalCita[] = ["atencion", "callcenter", "webhook", "ia"];

// Slide-in form to schedule a new appointment.
export function CitaFormSheet({
  open,
  defaultFecha,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  defaultFecha: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: Cita) => void;
}) {
  const t = useTranslations("appointments.form");
  const tc = useTranslations("common");

  const tipos = useResource<TipoCita[]>(() => getTiposCita());
  const medicos = useResource<Personal[]>(() => getMedicos());
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];

  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [tipoCitaId, setTipoCitaId] = React.useState("");
  const [medicoId, setMedicoId] = React.useState("");
  const [fecha, setFecha] = React.useState(defaultFecha);
  const [hora, setHora] = React.useState("");
  const [canal, setCanal] = React.useState<CanalCita>("atencion");
  const [esPrimeraVez, setEsPrimeraVez] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [centroSel, setCentroSel] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const tipoList = tipos.state.kind === "ok" ? tipos.state.data : [];
  const tipo = tipoList.find((x) => x.id === tipoCitaId);
  const needsMedico = !!tipo?.requiereMedico;
  const needsCentro = centros.length > 1;
  const effectiveCentro =
    centroSel || getActiveCentro() || (centros.length === 1 ? centros[0].id : "");

  function reset() {
    setPaciente(null);
    setTipoCitaId("");
    setMedicoId("");
    setFecha(defaultFecha);
    setHora("");
    setCanal("atencion");
    setEsPrimeraVez(false);
    setMotivo("");
    setNotas("");
    setCentroSel("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const canSubmit =
    !!paciente &&
    !!tipoCitaId &&
    !!fecha &&
    (!needsMedico || !!medicoId) &&
    (!needsCentro || !!effectiveCentro) &&
    !submitting;

  async function onSubmit() {
    if (!paciente || !tipoCitaId || !fecha) return;
    if (needsMedico && !medicoId) return;
    setSubmitting(true);
    try {
      const saved = await createCita(
        {
          pacienteId: paciente.id,
          tipoCitaId,
          medicoId: medicoId || undefined,
          fecha,
          hora: hora || undefined,
          canal,
          esPrimeraVez,
          motivo: motivo.trim() || undefined,
          notas: notas.trim() || undefined,
        },
        effectiveCentro || undefined,
      );
      if (effectiveCentro) setActiveCentro(effectiveCentro);
      toast.success(t("created"));
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("help")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {needsCentro && (
            <FieldRow label={t("centro")} required>
              <Select value={effectiveCentro || undefined} onValueChange={setCentroSel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("centroPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <FieldRow label={t("patient")} required>
            <PacienteSelect value={paciente} onChange={setPaciente} />
          </FieldRow>

          <FieldRow label={t("type")} required>
            <Select value={tipoCitaId || undefined} onValueChange={setTipoCitaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {tipoList.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {needsMedico && (
            <FieldRow label={t("doctor")} required>
              <Select value={medicoId || undefined} onValueChange={setMedicoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("doctorPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(medicos.state.kind === "ok" ? medicos.state.data : []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {[m.nombre, m.apellido].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label={t("date")} required>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </FieldRow>
            <FieldRow label={t("time")}>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </FieldRow>
          </div>

          <FieldRow label={t("channel")}>
            <Select value={canal} onValueChange={(v) => setCanal(v as CanalCita)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANALES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`channels.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={esPrimeraVez}
              onCheckedChange={(v) => setEsPrimeraVez(v === true)}
            />
            {t("firstVisit")}
          </label>

          <FieldRow label={t("reason")}>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </FieldRow>
          <FieldRow label={t("notes")}>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </FieldRow>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : t("submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
