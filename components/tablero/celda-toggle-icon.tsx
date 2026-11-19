"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tv01Icon } from "@hugeicons/core-free-icons";

import type { ColumnaEfectiva, CitaFila } from "@/lib/api/agenda-dia";
import { updatePaciente } from "@/lib/api/pacientes";
import { useCan } from "@/hooks/use-can";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";

// Map the BE's FE-agnostic render.icon hint → this app's icon set. Legacy used a
// TV icon (bi-tv) for "posible testimonio"; "desktop_windows" is the Material hint.
const ICONS: Record<string, typeof Tv01Icon> = {
  desktop_windows: Tv01Icon,
  tv: Tv01Icon,
  monitor: Tv01Icon,
};

// Icon toggle for a metadata-driven column (tipo "toggle" with render.icon and a
// `writeBinding` to a PATIENT flag — e.g. "testimonio" → paciente.esTestimonio).
// Active state = the binding value (render.usarValorComoActivo). Click →
// (optional) confirm → PUT /pacientes/:id { <field>: !active } → refresh.
// Reusable: any patient-flag toggle column works without touching this code.
export function CeldaToggleIcon({
  col,
  fila,
  centroId,
  onSaved,
}: {
  col: ColumnaEfectiva;
  fila: CitaFila;
  centroId?: string;
  onSaved?: () => void;
}) {
  const tRoot = useTranslations();
  const { can } = useCan();
  const confirm = useConfirm();

  const render = (col.render as Record<string, unknown> | null) ?? {};
  const active = !!fila[col.clave]; // usarValorComoActivo: el binding = estado activo
  const icon = ICONS[String(render.icon ?? "")] ?? Tv01Icon;
  const needsConfirm = render.confirmacion === true;

  // The BE's tooltipKey may collide with labelKey in the nested message tree; fall
  // back to a defined key if it doesn't resolve. (Never a raw/humanized key.)
  const tooltipKey = String(render.tooltipKey ?? "");
  const tooltip =
    tooltipKey && tRoot.has(tooltipKey)
      ? tRoot(tooltipKey)
      : tRoot("tableroBoard.testimonioTooltip");

  // writeBinding "paciente.<campo>" → PUT /pacientes/:id { <campo>: !active }. The
  // flag lives on the PATIENT (not the cita), so it does NOT go through /tablero/celda.
  const writeBinding = String(render.writeBinding ?? "");
  const [scope, field] = writeBinding.split(".");
  const pacienteId = fila.pacienteId ? String(fila.pacienteId) : "";
  // Writing the patient flag = pacientes.update (same as the `record` column).
  const canWrite = scope === "paciente" && !!field && !!pacienteId && can("pacientes.update");

  const nombre = fila.paciente == null ? "" : String(fila.paciente);

  const { submitting, submit } = useSubmit(
    () => updatePaciente(pacienteId, { [field]: !active } as never, centroId),
    { onSuccess: () => onSaved?.() },
  );

  async function onClick() {
    if (!canWrite || submitting) return;
    if (needsConfirm) {
      const ok = await confirm({
        title: tooltip,
        description: tRoot(
          active ? "tableroBoard.testimonioConfirmOff" : "tableroBoard.testimonioConfirmOn",
          { name: nombre || "—" },
        ),
      });
      if (!ok) return;
    }
    await submit();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canWrite || submitting}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={active}
      className={
        "grid size-8 place-items-center rounded-md border transition-colors disabled:opacity-40 " +
        (active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      <HugeiconsIcon icon={icon} className="size-4" />
    </button>
  );
}
