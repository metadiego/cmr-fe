"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockedIcon } from "@hugeicons/core-free-icons";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import { toastError } from "@/lib/api/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Inline state selector for a board row. Options come from the tablero
// definition's `estados` (data-driven — the FE invents nothing). Choosing a
// state finds the matching transition (aEstado + compatible desdeEstados) and
// applies it via POST /tablero/accion; the change propagates live over SSE.
export function EstadoSelect({
  tablero,
  entidadId,
  estado,
  estados,
  transiciones,
  centroId,
  onDone,
}: {
  tablero: string;
  entidadId: string;
  estado: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  centroId?: string;
  onDone: () => void;
}) {
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);

  async function change(nuevo: string) {
    if (nuevo === estado || busy) return;
    const tr = transiciones.find(
      (t) =>
        t.aEstado === nuevo &&
        (t.desdeEstados.length === 0 || t.desdeEstados.includes(estado)),
    );
    if (!tr) {
      toast.error(tRoot("tableroBoard.transitionNotAllowed"));
      return;
    }
    setBusy(true);
    try {
      await ejecutarAccion({ tablero, entidadId, accion: tr.clave, payload: {} }, centroId);
      onDone();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const def = estados.find((e) => e.clave === estado);

  // Authority: if the current state isn't in this board's editable set (e.g. the
  // AP board moved it to presente/atendida), CC can't change it → read-only.
  if (!def) {
    // Respaldo: nunca pintar una clave a medias ("citas.estado." con estado vacío). Con estado válido y
    // traducción, se usa; si falta la traducción, la clave cruda del estado; si viene vacío (dato ausente
    // del BE), un guion. Handoff citas-medico-y-confirmada / agenda-dia-estado-y-medico-nulos.
    const key = `citas.estado.${estado}`;
    const label = !estado ? "—" : tRoot.has(key) ? tRoot(key) : estado;
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
    <Select value={estado} onValueChange={change} disabled={busy}>
      <SelectTrigger className="h-8 w-36" style={{ color: def.color }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {estados.map((e) => (
          <SelectItem key={e.clave} value={e.clave}>
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
