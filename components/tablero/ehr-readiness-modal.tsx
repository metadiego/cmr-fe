"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updatePaciente } from "@/lib/api/pacientes";
import { type EhrReadinessField } from "@/lib/api/ehr-integration";
import { toastError } from "@/lib/api/errors";
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
}: {
  pacienteId: string;
  faltantes: EhrReadinessField[];
  centroId?: string;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const t = useTranslations("patients.form");
  const te = useTranslations("ehrIntegration");
  const tRoot = useTranslations();
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Todos los faltantes tienen valor con contenido.
  const completo = faltantes.every((f) => (form[f] ?? "").trim() !== "");

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
          {faltantes.map((f) => (
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
                <Input
                  type={f === "fechaNacimiento" ? "date" : "text"}
                  value={form[f] ?? ""}
                  onChange={(e) => set(f, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={guardar} disabled={!completo || busy}>{busy ? te("saving") : te("saveAndContinue")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
