"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockedIcon } from "@hugeicons/core-free-icons";

import { ejecutarAccion, type EstadoTablero, type Transicion } from "@/lib/api/tablero";
import type { CitaFila } from "@/lib/api/agenda-dia";
import { readAllowedActions } from "@/lib/lifecycle/allowed-actions";
import { labelText } from "@/lib/lifecycle/stage-labels";
import type { StagedRow } from "@/lib/lifecycle/stage-groups";
import { statusSelect } from "@/lib/board/status-select";
import { toastError } from "@/lib/api/errors";
import { datosFaltantesDe } from "@/lib/api/ehr-gate";
import type { EhrGateCtx } from "@/components/tablero/flujo-atencion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Inline status selector for a medical board row (the call center's day sheet). Options come from the
// board definition's statuses; the row's place and the move are read by stage group
// (lib/board/status-select.ts), under both definition shapes. Applied via POST /board/action; the change
// propagates live over SSE.
export function EstadoSelect({
  tablero,
  entidadId,
  fila,
  estados,
  transiciones,
  centroId,
  pacienteId,
  onDone,
  onEhrGate,
}: {
  tablero: string;
  entidadId: string;
  /** The row: its stages (and old value) say where it is; its `allowedActions` narrow the moves. */
  fila: CitaFila;
  estados: EstadoTablero[];
  transiciones: Transicion[];
  centroId?: string;
  pacienteId?: string;
  onDone: () => void;
  // Igual que en CeldaToggleHora: el candado PACIENTE_DATOS_REQUERIDOS abre el modal en el PADRE,
  // nunca aquí (esta fila puede desmontarse al refrescar). Sin esta prop, solo un toast (handoff
  // quejas-de-mostrador-2026-10-20).
  onEhrGate?: (ctx: EhrGateCtx) => void;
}) {
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);

  const view = statusSelect("medical", estados, transiciones, fila as StagedRow, readAllowedActions(fila));
  const def = view.current;

  async function change(nuevo: string) {
    const target = estados.find((e) => e.slug === nuevo);
    if (!target || target === def || busy) return;
    const tr = view.transitionTo(target);
    if (!tr) {
      toast.error(tRoot("tableroBoard.transitionNotAllowed"));
      return;
    }
    setBusy(true);
    try {
      await ejecutarAccion({ boardSlug: tablero, entityId: entidadId, action: tr.slug, payload: {} }, centroId);
      onDone();
    } catch (err) {
      const faltantes = datosFaltantesDe(err);
      if (faltantes && pacienteId && onEhrGate) {
        onEhrGate({ pacienteId, faltantes, onCompleted: () => void change(nuevo) });
        return;
      }
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  // Authority: a row whose stage group has no status on this board (the care board moved it on) is
  // read-only here, labelled by its stage (not served reads as such); no status at all shows a dash.
  if (!def) {
    const raw = typeof fila.estado === "string" ? fila.estado : "";
    const label = labelText(tRoot, "medical", view.label, raw) || "—";
    return (
      <span
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        title={tRoot("tableroBoard.managedByAtencion")}
      >
        <HugeiconsIcon icon={LockedIcon} className="size-3.5" />
        {label}
      </span>
    );
  }

  return (
    <Select value={def.slug} onValueChange={change} disabled={busy}>
      <SelectTrigger className="h-8 w-36" style={{ color: def.color }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {estados.map((e) => (
          <SelectItem key={e.slug} value={e.slug}>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} />
              {tRoot(e.labelKey)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
