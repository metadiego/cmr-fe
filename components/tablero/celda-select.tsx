"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { editarCelda, type Opcion } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { usePersistenciaToast } from "@/hooks/use-persistencia-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SIN_ASIGNAR = "__none__"; // Radix no admite value="" — handoff vaciar-recurso-asignado.

// Data-driven editable `select` cell. Options come from GET /tablero/opciones
// (fetched once per column at the board level and passed down). Writes via the
// generic cell endpoint (POST /tablero/celda) and lets SSE + onSaved refresh the
// row. The projected row value is the LABEL (e.g. "Christina Rosa"), so the
// current selection is matched by label; on change we send the option VALUE (id).
export function CeldaSelect({
  tablero,
  entidadId,
  columna,
  value,
  options,
  centroId,
  etiqueta,
  clearable,
  onSaved,
}: {
  tablero: string;
  entidadId: string;
  columna: string;
  value: unknown;
  options: Opcion[];
  centroId?: string;
  etiqueta?: string; // nombre humano de la columna para el toast de certificación
  clearable?: boolean; // ofrece «Sin asignar» (render.clearable de la columna)
  onSaved?: () => void;
}) {
  const tRoot = useTranslations();
  const notifyPersistencia = usePersistenciaToast();
  const [busy, setBusy] = React.useState(false);
  // Optimistic: reflect the pick INSTANTLY; server + SSE confirm.
  const [optimistic, setOptimistic] = React.useState<string | null>(null);

  const label = value == null || value === "" ? "" : String(value);
  // No options wired yet → don't block the cell, just show the text.
  if (options.length === 0) {
    return <span className={label ? undefined : "text-muted-foreground"}>{label || "—"}</span>;
  }
  const current = optimistic ?? (options.find((o) => o.label === label)?.value ?? "");

  async function onChange(next: string) {
    const picked = next === SIN_ASIGNAR ? "" : next;
    if (picked === current) return;
    setBusy(true);
    setOptimistic(picked); // instant feedback
    try {
      const { persistencia } = await editarCelda({ boardSlug: tablero, entityId: entidadId, column: columna, value: picked === "" ? null : picked }, centroId);
      // Certifica con la base. Si ok:false, soltamos el optimista y onSaved() re-lee la verdad.
      const ok = notifyPersistencia(persistencia, etiqueta);
      if (!ok) setOptimistic(null);
      onSaved?.();
    } catch (err) {
      setOptimistic(null); // revert on failure
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select value={current} onValueChange={onChange} disabled={busy}>
      <SelectTrigger className="h-8 w-full min-w-[9rem] border-transparent bg-transparent px-2 hover:bg-muted/60 focus:bg-background">
        {/* Si el valor no calza una opción, mostrar igual el nombre proyectado
            (fila.medico) para que SIEMPRE se vea al cargar, aunque no preseleccione. */}
        <SelectValue placeholder={label || "—"} />
      </SelectTrigger>
      <SelectContent>
        {clearable && <SelectItem value={SIN_ASIGNAR}>{tRoot("frontdesk.sinAsignar")}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
