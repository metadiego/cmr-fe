"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { editarCelda, type Opcion } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  onSaved,
}: {
  tablero: string;
  entidadId: string;
  columna: string;
  value: unknown;
  options: Opcion[];
  centroId?: string;
  onSaved?: () => void;
}) {
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);

  const label = value == null || value === "" ? "" : String(value);
  // No options wired yet → don't block the cell, just show the text.
  if (options.length === 0) {
    return <span className={label ? undefined : "text-muted-foreground"}>{label || "—"}</span>;
  }
  const current = options.find((o) => o.label === label)?.value ?? "";

  async function onChange(next: string) {
    if (next === current) return;
    setBusy(true);
    try {
      await editarCelda({ tablero, entidadId, columna, valor: next }, centroId);
      onSaved?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select value={current} onValueChange={onChange} disabled={busy}>
      <SelectTrigger className="h-8 w-full min-w-[9rem] border-transparent bg-transparent px-2 hover:bg-muted/60 focus:bg-background">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
