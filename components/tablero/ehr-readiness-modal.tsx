"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updatePaciente } from "@/lib/api/pacientes";
import { type EhrReadinessField } from "@/lib/api/ehr-integration";
import type { EhrGateCtx } from "@/components/tablero/flujo-atencion";
import { toastError } from "@/lib/api/errors";
import { todayPR } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/kit/form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Modal BLOQUEANTE que exige los datos que el EHR necesita ANTES de marcar Presente. Pinta SOLO los
// `faltantes` que reporta el readiness, con el mismo campo que el alta de paciente, los guarda con el PUT
// de siempre y solo entonces deja seguir. Cancelar = no se marca Presente. Handoff be-ehr-integration-presente.
const ID_TYPES = ["drivers_license", "passport", "green_card", "state_id"] as const;

export function EhrReadinessModal({
  pacienteId,
  faltantes,
  centroId,
  onCancel,
  onCompleted,
  cancelLabel,
}: {
  pacienteId: string;
  faltantes: EhrReadinessField[];
  centroId?: string;
  onCancel: () => void;
  onCompleted: () => void;
  // §1b: un paciente de seguimiento no bloquea — el botón dice "Seguir sin completar" en vez de
  // "Cancelar", porque `onCancel` SÍ avanza (no se queda sin marcar). Omitido = candado normal.
  cancelLabel?: string;
}) {
  const t = useTranslations("patients.form");
  const te = useTranslations("ehrIntegration");
  const tRoot = useTranslations();
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Fecha de nacimiento futura = dato imposible, nunca un valor válido que el EHR pueda recibir.
  // El `max` del input ya lo impide en la mayoría de navegadores, pero esto es el respaldo real
  // (alguien puede pegar un valor a mano) — mismo criterio que paciente-form-sheet.tsx.
  const fechaNacimientoValida = !form.fechaNacimiento || form.fechaNacimiento <= todayPR();
  // Todos los faltantes tienen valor con contenido.
  const completo = faltantes.every((f) => (form[f] ?? "").trim() !== "") && fechaNacimientoValida;

  // Orden de presentación: PRIMERO el tipo de ID, LUEGO el ID (regla del dueño 30-sep) — el número de ID sin
  // saber de qué documento es no sirve. El resto conserva un orden estable. `faltantes` puede venir en
  // cualquier orden desde el BE, así que se ordena aquí, no se asume.
  const FIELD_ORDER: EhrReadinessField[] = ["idType", "docId", "fechaNacimiento", "sexo", "zipcode"];
  const ordered = [...faltantes].sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b));
  // El ID no se puede escribir hasta elegir el tipo (solo cuando el tipo también se está pidiendo aquí).
  const idTypeMissing = faltantes.includes("idType");
  const docIdBloqueado = (f: EhrReadinessField) => f === "docId" && idTypeMissing && !form.idType;

  async function guardar() {
    if (!completo || busy) return;
    setBusy(true);
    try {
      // Solo los campos que faltaban. `idType` aún no está en el DTO tipado (esquema por regenerar) → cast.
      const payload: Record<string, string> = {};
      for (const f of faltantes) payload[f] = form[f].trim();
      await updatePaciente(pacienteId, payload as never, centroId);
      onCompleted();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{te("modalTitle")}</DialogTitle>
          <DialogDescription>{te("modalHelp")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ordered.map((f) => (
            <Field key={f} label={t(f)}>
              {f === "idType" ? (
                <Select value={form[f] || undefined} onValueChange={(v) => set(f, v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={t("idTypePlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {ID_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>{t(`idType_${v}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f === "sexo" ? (
                <Select value={form[f] || undefined} onValueChange={(v) => set(f, v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={t("sexoPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="femenino">{t("sexoFemenino")}</SelectItem>
                    <SelectItem value="masculino">{t("sexoMasculino")}</SelectItem>
                    <SelectItem value="otro">{t("sexoOtro")}</SelectItem>
                    <SelectItem value="desconocido">{t("sexoDesconocido")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    type={f === "fechaNacimiento" ? "date" : "text"}
                    value={form[f] ?? ""}
                    max={f === "fechaNacimiento" ? todayPR() : undefined}
                    aria-invalid={f === "fechaNacimiento" && !fechaNacimientoValida ? true : undefined}
                    onChange={(e) => set(f, e.target.value)}
                    disabled={docIdBloqueado(f)}
                    placeholder={docIdBloqueado(f) ? t("idTypeFirst") : undefined}
                  />
                  {f === "fechaNacimiento" && !fechaNacimientoValida && (
                    <p className="text-xs text-destructive">{t("fechaNacimientoFutura")}</p>
                  )}
                </>
              )}
            </Field>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>{cancelLabel ?? tRoot("common.cancel")}</Button>
          <Button onClick={guardar} disabled={!completo || busy}>{busy ? te("saving") : te("saveAndContinue")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// El wiring de "si hay gate, pintar el modal; cancelar o completar lo cierra y sigue" se repetía
// idéntico en cada pantalla que lo adoptó (tablero-dinamico.tsx, dia-view.tsx ×2, frontdesk-board.tsx)
// — una sola pieza, en vez de 4 copias del mismo bloque (handoff quejas-de-mostrador-2026-10-20 §1).
export function EhrGateHost({
  gate,
  centroId,
  onClose,
}: {
  gate: EhrGateCtx | null;
  centroId?: string;
  onClose: () => void;
}) {
  const te = useTranslations("ehrIntegration");
  if (!gate) return null;
  return (
    <EhrReadinessModal
      pacienteId={gate.pacienteId}
      faltantes={gate.faltantes}
      centroId={centroId}
      cancelLabel={gate.skip ? te("skipLabel") : undefined}
      onCancel={() => {
        onClose();
        gate.skip?.();
      }}
      onCompleted={() => {
        onClose();
        gate.onCompleted();
      }}
    />
  );
}
