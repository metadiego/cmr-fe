"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  validarCita,
  crearCitaAgenda,
  actualizarCitaAgenda,
  type Cita,
  type TipoCita,
  type CitaConflicto,
} from "@/lib/api/citas";
import type { Personal } from "@/lib/api/personal";
import type { Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useMe } from "@/hooks/use-me";
import { useEstados } from "@/hooks/use-estados";
import { Badge } from "@/components/ui/badge";
import { addMinutes, todayISO } from "@/lib/agenda/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PacienteSelect } from "@/components/citas/paciente-select";

// Centinela "Sin médico" para que el Select nunca quede en vacío (Radix no admite value="").
const NONE_MEDICO = "__sin_medico__";

export function CitaModal({
  open,
  fecha,
  cita,
  pacienteInicial,
  centroId,
  horaInicial,
  tipoCitaIdInicial,
  tipos,
  medicos,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  fecha: string; // ISO prefilled
  cita?: Cita | null;
  pacienteInicial?: Paciente | null;
  centroId?: string; // prefill center (e.g. from the day-view slot)
  horaInicial?: string; // prefill start time from the block
  tipoCitaIdInicial?: string; // prefill appointment type from the block
  tipos: TipoCita[];
  medicos: Personal[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("agenda.modal");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const isEdit = !!cita;

  const me = useMe();
  const callcenterId = me.kind === "ok" ? me.me.personalId ?? undefined : undefined;
  const { map: estadosMap, estados } = useEstados();
  // On create the state is the catalog's initial one; on edit it's the cita's.
  const estadoClave = cita?.estado ?? estados.find((e) => e.esInicial)?.clave ?? "programada";
  const estadoDef = estadosMap.get(estadoClave);

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const needsCentro = !isEdit && centros.length > 1;
  const [centroSel, setCentroSel] = React.useState(centroId ?? "");
  const effectiveCentro =
    centroSel || cita?.clinicId || centroId || getActiveCentro() || (centros.length === 1 ? centros[0].id : "");

  const [paciente, setPaciente] = React.useState<Paciente | null>(pacienteInicial ?? null);
  const [tipoCitaId, setTipoCitaId] = React.useState(cita?.tipoCitaId ?? tipoCitaIdInicial ?? "");
  const [medicoId, setMedicoId] = React.useState(cita?.medicoId ?? "");
  const [hora, setHora] = React.useState(cita?.hora ?? horaInicial ?? "09:00");
  const [horaFin, setHoraFin] = React.useState(() => {
    if (cita?.horaFin) return cita.horaFin;
    const tp = tipos.find((x) => x.id === (cita?.tipoCitaId ?? tipoCitaIdInicial));
    const start = cita?.hora ?? horaInicial ?? "09:00";
    return tp ? addMinutes(start, tp.duracionMin) : "09:30";
  });
  const [esPrimeraVez, setEsPrimeraVez] = React.useState(cita?.esPrimeraVez ?? false);
  // Estado con el que NACE la cita (solo al crear; BE allowlist = programada|confirmada). Una cita solo
  // entra al tablero de Atención si está confirmada, así que para una cita de HOY nace "confirmada" por
  // defecto (lo que se quiere el 99% de las veces). Handoff citas-medico-y-confirmada.
  const [estadoCrear, setEstadoCrear] = React.useState<"programada" | "confirmada">(
    fecha === todayISO() ? "confirmada" : "programada",
  );
  const [motivo, setMotivo] = React.useState(cita?.motivo ?? "");
  const [notas, setNotas] = React.useState(cita?.notas ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [warn, setWarn] = React.useState<CitaConflicto[] | null>(null);

  const tipo = tipos.find((x) => x.id === tipoCitaId);
  // "Primera vez" es un HECHO del historial, no una preferencia: si el paciente ya fue atendido
  // (`atendidoPor`), es de seguimiento y el BE rechaza crearlo como nuevo (400
  // CITA_PACIENTE_YA_ES_SEGUIMIENTO). No ofrecemos la opción para no dejar elegir algo que se va a
  // rechazar. Handoff HANDOFF-vitales-en-atencion-e-imprimir-emite.
  const yaSeguimiento = !!(paciente as { atendidoPor?: string | null } | null)?.atendidoPor;
  const esPrimeraVezEff = yaSeguimiento ? false : esPrimeraVez;
  const medicoRequired = !!tipo?.requiereMedico && !esPrimeraVezEff;

  // Pick a type → auto-fill end time (start + duración), reset any prior warning.
  function onTipoChange(id: string) {
    setTipoCitaId(id);
    const tp = tipos.find((x) => x.id === id);
    if (tp) setHoraFin(addMinutes(hora, tp.duracionMin));
    setWarn(null);
  }
  function onHoraChange(value: string) {
    setHora(value);
    if (tipo) setHoraFin(addMinutes(value, tipo.duracionMin));
    setWarn(null);
  }

  const canSubmit =
    !!paciente &&
    !!tipoCitaId &&
    !!fecha &&
    !!hora &&
    !!horaFin &&
    (!medicoRequired || !!medicoId) &&
    (!needsCentro || !!effectiveCentro) &&
    !submitting;

  async function onSubmit() {
    if (!paciente || !tipoCitaId) return;
    setSubmitting(true);
    try {
      // Validate overlap first (unless the user already confirmed past a warning).
      if (warn === null) {
        const res = await validarCita(
          {
            medicoId: medicoId || undefined,
            fecha,
            hora,
            horaFin,
            tipoCitaId,
            excluirCitaId: cita?.id,
          },
          effectiveCentro || undefined,
        );
        if (res.conflictos.length > 0) {
          setWarn(res.conflictos); // show warning; a second Guardar confirms
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        pacienteId: paciente.id,
        tipoCitaId,
        medicoId: medicoId || undefined,
        fecha,
        hora,
        horaFin,
        canal: "callcenter" as const,
        esPrimeraVez: esPrimeraVezEff,
        motivo: motivo.trim() || undefined,
        notas: notas.trim() || undefined,
      };
      const { advertencias } = isEdit
        ? await actualizarCitaAgenda(cita!.id, payload, effectiveCentro || undefined)
        : await crearCitaAgenda({ ...payload, estado: estadoCrear, callcenterId }, effectiveCentro || undefined);
      if (effectiveCentro) setActiveCentro(effectiveCentro);
      toast.success(isEdit ? t("updated") : t("created"));
      for (const a of advertencias) {
        if (a.labelKey) toast.warning(tRoot(a.labelKey));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {needsCentro && (
            <Field label={t("centro")} required>
              <Select value={effectiveCentro || undefined} onValueChange={setCentroSel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("centroPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("date")} required>
              <Input type="date" value={fecha} readOnly className="bg-muted/40" />
            </Field>
            <Field label={t("start")} required>
              <Input type="time" value={hora} onChange={(e) => onHoraChange(e.target.value)} />
            </Field>
            <Field label={t("end")} required>
              <Input type="time" value={horaFin} onChange={(e) => { setHoraFin(e.target.value); setWarn(null); }} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("patient")} required>
              <PacienteSelect value={paciente} onChange={setPaciente} />
            </Field>
            {/* El selector NUNCA sale vacío: si no hay médico, queda en "Sin médico" (no bloquea el
                guardado salvo que el TIPO exija médico). Handoff citas-medico-y-confirmada. */}
            <Field label={t("doctor")} required={medicoRequired}>
              <Select value={medicoId || NONE_MEDICO} onValueChange={(v) => { setMedicoId(v === NONE_MEDICO ? "" : v); setWarn(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_MEDICO}>{t("noDoctor")}</SelectItem>
                  {medicos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {[m.nombre, m.apellido].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("type")} required>
              <Select value={tipoCitaId || undefined} onValueChange={onTipoChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                        {x.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("status")}>
              {isEdit ? (
                <div className="flex h-9 items-center">
                  <Badge
                    variant="secondary"
                    style={estadoDef ? { backgroundColor: `${estadoDef.color}20`, color: estadoDef.color } : undefined}
                  >
                    {estadoDef ? tRoot(estadoDef.labelKey) : t("statusScheduled")}
                  </Badge>
                </div>
              ) : (
                // Al crear: elegir con qué estado nace (allowlist BE). Confirmada = entra al tablero de
                // Atención de una vez. Colores/etiquetas del catálogo (data-driven).
                <Select value={estadoCrear} onValueChange={(v) => setEstadoCrear(v as "programada" | "confirmada")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["programada", "confirmada"] as const).map((clave) => {
                      const d = estadosMap.get(clave);
                      return (
                        <SelectItem key={clave} value={clave}>
                          <span className="inline-flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: d?.color ?? "#999" }} />
                            {d ? tRoot(d.labelKey) : clave}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          {yaSeguimiento ? (
            // Paciente con historial: no se ofrece "primera vez" (es de seguimiento). Solo informa.
            <p className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              {t("followUpPatient")}
            </p>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={esPrimeraVez} onCheckedChange={(v) => setEsPrimeraVez(v === true)} />
              {t("firstVisit")}
            </label>
          )}

          <Field label={t("reason")}>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </Field>
          <Field label={t("notes")}>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </Field>

          {warn && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">{t("overlapWarn")}</p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {warn.map((c) => (
                  <li key={c.citaId}>· {c.hora}–{c.horaFin}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : warn ? t("saveAnyway") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
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
