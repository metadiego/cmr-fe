"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

  return (
    <Select value={estado} onValueChange={change} disabled={busy}>
      <SelectTrigger
        className="h-8 w-36"
        style={def ? { color: def.color } : undefined}
      >
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
