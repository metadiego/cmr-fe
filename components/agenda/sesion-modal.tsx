"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { crearSesion } from "@/lib/api/frontdesk";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import type { Servicio } from "@/lib/api/servicios";
import type { Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Schedule a service session (frontdesk). Day-based: no time. Technician is
// assigned later on the day-of board, so it's not requested here.
export function SesionModal({
  open,
  fecha,
  servicios,
  servicioInicial,
  pacienteInicial,
  centroInicial,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  fecha: string;
  servicios: Servicio[];
  servicioInicial?: string;
  pacienteInicial?: Paciente | null;
  centroInicial?: string; // centro preseleccionado (el que se está mirando en la pantalla)
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("agenda.sesion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const needsCentro = centros.length > 1;
  const [centroSel, setCentroSel] = React.useState("");
  const effectiveCentro =
    centroSel || centroInicial || getActiveCentro() || (centros.length === 1 ? centros[0].id : "");

  const [paciente, setPaciente] = React.useState<Paciente | null>(pacienteInicial ?? null);
  const [servicioId, setServicioId] = React.useState(servicioInicial ?? "");
  const [cantidad, setCantidad] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit =
    !!paciente && !!servicioId && !!fecha && (!needsCentro || !!effectiveCentro) && !submitting;

  async function onSubmit() {
    if (!paciente || !servicioId) return;
    setSubmitting(true);
    try {
      const { warnings } = await crearSesion(
        {
          pacienteId: paciente.id,
          servicioId,
          fecha,
          cantidad: cantidad > 0 ? cantidad : 1,
        },
        effectiveCentro || undefined,
      );
      if (effectiveCentro) setActiveCentro(effectiveCentro);
      toast.success(t("created"));
      mostrarAvisos(warnings, tRoot); // cupo excedido / sin cupo — no bloquea
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {needsCentro && (
            <Field label={t("centro")} required>
              <Select value={effectiveCentro || undefined} onValueChange={setCentroSel}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("centroPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label={t("date")} required>
            <Input type="date" value={fecha} readOnly className="bg-muted/40" />
          </Field>

          <Field label={t("patient")} required>
            <PacienteSelect value={paciente} onChange={setPaciente} />
          </Field>

          <Field label={t("service")} required>
            <Select value={servicioId || undefined} onValueChange={setServicioId}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("servicePlaceholder")} /></SelectTrigger>
              <SelectContent>
                {servicios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color ?? "#4a90d9" }} />
                      {s.nombre}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("quantity")}>
            <Input
              type="number"
              min={1}
              value={String(cantidad)}
              onChange={(e) => setCantidad(Number(e.target.value) || 1)}
              className="w-28"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : t("save")}
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
