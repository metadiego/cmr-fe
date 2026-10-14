"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { editarCabeceraFactura, type EditarCabeceraPayload, type FacturaConItems } from "@/lib/api/facturas";
import { listMedicos, listMedios, type MedicoOpcion, type MedioFacturacion } from "@/lib/api/facturacion-config";
import { patientDoctorOption } from "@/lib/medicos/patient-doctor-option";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ControlSkeleton } from "@/components/kit/skeletons";

// Extracted from app/(app)/billing/invoices/[id]/page.tsx (its line ceiling only goes down).

function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>;
}

// Editar la CABECERA de un borrador sin descartar (médico / referido / tercero) → PUT /facturas/:id/cabecera.
// Reusa los mismos catálogos que el alta (listMedicos/listMedios). El paciente se cambia aparte (tiene buscador).
const NONE = "__none__";
export function InvoiceHeaderDialog({
  open,
  onOpenChange,
  centro,
  factura,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  centro?: string;
  factura: FacturaConItems;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("facturacion");
  const tRoot = useTranslations();
  const f = factura as unknown as {
    doctorId?: string | null; sourceId?: string | null; doctor?: { id?: string; name?: string } | null;
    doctorClinicId?: string | null; doctorClinicName?: string | null;
    billToName?: string | null; billToDocumentId?: string | null; billToType?: string | null;
  };
  const medicosRes = useResource<MedicoOpcion[]>(() => listMedicos(centro), [centro]);
  const mediosRes = useResource<MedioFacturacion[]>(() => listMedios(centro), [centro]);
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  const medios = mediosRes.state.kind === "ok" ? mediosRes.state.data : [];
  // The invoice's doctor shows even when no longer among the center's active doctors (handoff
  // facturacion-general-medico-del-paciente). The invoice carries the doctor's center at its root.
  const doctorExtra = patientDoctorOption(
    medicos.map((m) => m.id),
    f.doctorId
      ? { doctorId: f.doctorId, doctorName: f.doctor?.name, doctorClinicId: f.doctorClinicId, doctorClinicName: f.doctorClinicName }
      : null,
    centro,
  );

  // Sembrado con los valores actuales de la factura (el padre remonta por `key` al abrir → initializer fresco).
  const [medicoId, setMedicoId] = React.useState<string>(f.doctorId ?? NONE);
  const [medioId, setMedioId] = React.useState<string>(f.sourceId ?? NONE);
  const [terceroNombre, setTerceroNombre] = React.useState(f.billToName ?? "");
  const [terceroDoc, setTerceroDoc] = React.useState(f.billToDocumentId ?? "");
  const [terceroTipo, setTerceroTipo] = React.useState<"persona" | "empresa">(f.billToType === "empresa" ? "empresa" : "persona");
  const [saving, setSaving] = React.useState(false);

  async function guardar() {
    setSaving(true);
    const nombre = terceroNombre.trim();
    // ausente = no aplica; aquí somos autoritativos: null = limpiar cuando el campo va vacío.
    const payload: EditarCabeceraPayload = {
      doctorId: medicoId === NONE ? null : medicoId,
      sourceId: medioId === NONE ? null : medioId,
      billToName: nombre || null,
      billToDocumentId: nombre ? (terceroDoc.trim() || null) : null,
      billToType: nombre ? terceroTipo : null,
    };
    try {
      await editarCabeceraFactura(String(factura.id), payload, centro);
      await onSaved();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editarCabeceraTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <Lbl>{t("medico")}</Lbl>
            {medicosRes.state.kind === "loading" ? <ControlSkeleton /> : (
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("sinMedico")}</SelectItem>
                {doctorExtra && (
                  <SelectItem value={doctorExtra.id}>
                    {doctorExtra.name}
                    <Badge variant="warning" className="ml-2">
                      {doctorExtra.mark.kind === "retired"
                        ? t("general.doctorRetired")
                        : doctorExtra.mark.kind === "otherCenter" && doctorExtra.mark.center
                          ? doctorExtra.mark.center
                          : t("general.doctorNotListed")}
                    </Badge>
                  </SelectItem>
                )}
                {medicos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <Lbl>{t("referido")}</Lbl>
            {mediosRes.state.kind === "loading" ? <ControlSkeleton /> : (
            <Select value={medioId} onValueChange={setMedioId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("sinReferido")}</SelectItem>
                {medios.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            )}
          </label>
          <div className="space-y-2 rounded-lg border p-3">
            <Lbl>{t("tercero")}</Lbl>
            <Input value={terceroNombre} onChange={(e) => setTerceroNombre(e.target.value)} placeholder={t("terceroNombre")} />
            {terceroNombre.trim() && (
              <div className="flex gap-2">
                <Input value={terceroDoc} onChange={(e) => setTerceroDoc(e.target.value)} placeholder={t("terceroDoc")} className="flex-1" />
                <Select value={terceroTipo} onValueChange={(v) => setTerceroTipo(v as "persona" | "empresa")}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persona">{t("terceroPersona")}</SelectItem>
                    <SelectItem value="empresa">{t("terceroEmpresa")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>{tRoot("common.cancel")}</Button>
            <Button size="sm" onClick={guardar} disabled={saving}>{tRoot("common.save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
